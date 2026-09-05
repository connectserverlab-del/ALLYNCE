/**
 * The loaded game data, indexed and checked.
 *
 * This is deliberately free of any file reading. `data.ts` owns getting the JSON off disk, which needs
 * node:fs and therefore cannot run in a browser; the sample page bundles the real engine and builds a
 * registry from JSON it already has inlined, so the class it constructs has to be reachable without
 * dragging the filesystem in behind it. Splitting the two is also just the honest division: one module
 * describes the data, the other fetches it.
 */
import type { UnitDef, AbilityDef, FactionDef } from "./types.js";
import type { RankLadder } from "./ranks.js";
import type { FusionRecipe } from "./fusion.js";
import type { DeckRules, SideCard } from "./cards.js";
import type { KingdomData, ResearchDef, BannerDef } from "./kingdom.js";
import type { WantedRules } from "./wanted.js";
import type { MarchRules } from "./march.js";

export interface CompositionRules {
  standardPlatoon: {
    slots: Record<string, number>; total: number;
    doctrine: {
      full: { atk: number; def: number; morale: number; minFoot: number };
      reduced: { atk: number; def: number; morale: number; minFoot: number };
      broken: { atk: number; def: number; morale: number };
    };
    continuityRounds: number;
  };
  themeCohesion: { perAdjacentAlly: number; maxConnections: number; disorderedCap: number };
  limits: { eliteSlotsPerPlatoon: number; uniqueCopiesPerArmy: number; bossDeityStartingDeployment: boolean; wizardsPerPlatoon: number };
}

export class Registry {
  readonly units = new Map<string, UnitDef>();
  readonly abilities = new Map<string, AbilityDef>();
  readonly factions = new Map<string, FactionDef>();
  readonly rules: CompositionRules;
  readonly ranks = new Map<string, RankLadder>();
  readonly fusions = new Map<string, FusionRecipe>();
  readonly sideCards = new Map<string, SideCard>();
  readonly deckRules: DeckRules;
  readonly kingdom: KingdomData;
  readonly research = new Map<string, ResearchDef>();
  readonly banners = new Map<string, BannerDef>();
  readonly wanted: WantedRules;
  readonly march: MarchRules;

  constructor(units: UnitDef[], abilities: AbilityDef[], factions: Record<string, FactionDef>, rules: CompositionRules, ladders: RankLadder[] = [], fusions: FusionRecipe[] = [], deckRules?: DeckRules, sideCards: SideCard[] = [], kingdom?: KingdomData, research: ResearchDef[] = [], banners: BannerDef[] = [], wanted?: WantedRules, march?: MarchRules) {
    this.kingdom = kingdom!;
    this.wanted = wanted!;
    this.march = march!;
    for (const r of research) this.research.set(r.id, r);
    for (const bn of banners) this.banners.set(bn.id, bn);
    this.deckRules = deckRules!;
    for (const c of sideCards) this.sideCards.set(c.id, c);
    for (const l of ladders) this.ranks.set(l.faction, l);
    for (const f of fusions) this.fusions.set(f.id, f);
    for (const u of units) this.units.set(u.id, u);
    for (const a of abilities) this.abilities.set(a.id, a);
    for (const f of Object.values(factions)) this.factions.set(f.id, f);
    this.rules = rules;
    this.validate();
  }

  unit(id: string): UnitDef {
    const u = this.units.get(id);
    if (!u) throw new Error(`Unknown unit ${id}`);
    return u;
  }
  ability(id: string): AbilityDef {
    const a = this.abilities.get(id);
    if (!a) throw new Error(`Unknown ability ${id}`);
    return a;
  }

  private validate(): void {
    for (const u of this.units.values()) {
      for (const id of [...u.passives, ...u.actives]) if (!this.abilities.has(id)) throw new Error(`${u.id} references missing ability ${id}`);
      if (u.faction !== "DIV" && !this.factions.has(u.faction)) throw new Error(`${u.id} references missing faction ${u.faction}`);
      if (u.factionRank) { const l = this.ranks.get(u.faction); if (!l || !l.ranks.some((r) => r.id === u.factionRank)) throw new Error(`${u.id} references unknown rank ${u.factionRank}`); }
    }
    for (const c of this.sideCards.values()) {
      if (c.kind === "ritual" && (!c.result || !this.units.has(c.result))) throw new Error(`Side card ${c.id} names a missing unit ${c.result}`);
      if (c.kind === "fusion" && (!c.recipe || !this.fusions.has(c.recipe))) throw new Error(`Side card ${c.id} names a missing recipe ${c.recipe}`);
    }
    for (const r of this.research.values()) for (const q of r.requires) if (!this.research.has(q)) throw new Error(`Research ${r.id} requires a missing study ${q}`);
    for (const f of this.factions.values()) {
      if (f.platoonOrder && !this.abilities.has(f.platoonOrder)) throw new Error(`Faction ${f.id} missing order ${f.platoonOrder}`);
      if (f.passiveDoctrine && !this.abilities.has(f.passiveDoctrine)) throw new Error(`Faction ${f.id} missing doctrine ${f.passiveDoctrine}`);
    }
    for (const r of this.fusions.values()) {
      for (const inp of r.inputs) if (inp.defId && !this.units.has(inp.defId)) throw new Error(`Fusion ${r.id} names a missing input ${inp.defId}`);
      if (r.result.defId && !this.units.has(r.result.defId)) throw new Error(`Fusion ${r.id} names a missing result unit ${r.result.defId}`);
      for (const id of r.result.passives ?? []) if (!this.abilities.has(id)) throw new Error(`Fusion ${r.id} grants missing ability ${id}`);
    }
  }
}

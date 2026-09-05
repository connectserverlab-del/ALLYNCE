import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { UnitDef, AbilityDef, FactionDef } from "./types.js";
import type { RankLadder } from "./ranks.js";
import type { FusionRecipe } from "./fusion.js";
import { existsSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_ROOT = resolve(here, "../../data");

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

  constructor(units: UnitDef[], abilities: AbilityDef[], factions: Record<string, FactionDef>, rules: CompositionRules, ladders: RankLadder[] = [], fusions: FusionRecipe[] = []) {
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
    for (const f of this.factions.values()) {
      if (f.platoonOrder && !this.abilities.has(f.platoonOrder)) throw new Error(`Faction ${f.id} missing order ${f.platoonOrder}`);
      if (f.passiveDoctrine && !this.abilities.has(f.passiveDoctrine)) throw new Error(`Faction ${f.id} missing doctrine ${f.passiveDoctrine}`);
    }
  }
}

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(resolve(DATA_ROOT, rel), "utf8")) as T;
}

export function loadRegistry(): Registry {
  return new Registry(
    readJson<UnitDef[]>("units/units.json"),
    readJson<AbilityDef[]>("abilities/abilities.json"),
    readJson<Record<string, FactionDef>>("factions/factions.json"),
    readJson<CompositionRules>("compositions/platoon.json"),
    ["SAM", "SHI", "KNI", "DRG", "RIT"].filter((f) => existsSync(resolve(DATA_ROOT, `factions/ranks/${f}.json`))).map((f) => readJson<RankLadder>(`factions/ranks/${f}.json`)),
    readJson<FusionRecipe[]>("abilities/fusions.json"),
  );
}

export function loadScenario<T = unknown>(name: string): T {
  return readJson<T>(`scenarios/${name}.json`);
}

import type { Hex, Facing } from "./hex.js";

export type Role =
  | "FootSoldier" | "Commander" | "Second" | "Elite" | "Cavalry" | "Ranged"
  | "Ritualist" | "PortalKeeper" | "Support" | "Siege" | "Boss" | "Deity";

export type SlotName = "Commander" | "Second" | "Elite" | "FootSoldier" | "Specialist";
export type Size = "Standard" | "Large" | "Colossal";

export interface RitualRatings { knowledge: number; language: number; affinity: number; channeling: number }
export interface DivineDef { manifestation: number; anchors: number; arrival: string }

export interface UnitDef {
  id: string; name: string; faction: string;
  themes: string[]; roles: Role[]; rank: string; size: Size;
  hp: number; atk: number; def: number; mov: number; range: number;
  initiative: number; morale: number; commandRadius?: number; capacityCost: number;
  passives: string[]; actives: string[]; slots: SlotName[];
  unique: boolean; summonOnly: boolean; ai: string; flying?: boolean;
  ritual?: RitualRatings; divine?: DivineDef;
  factionRank?: string;
  stars?: number;
  minRange?: number;
  siege?: { setupRequired: boolean; structureAtk: number };
  art?: Record<string, string>;
}

export type AbilityCategory = "Active" | "Passive" | "Reaction" | "Order" | "Succession" | "Objective";
export interface AbilityDef {
  id: string; name: string; category: AbilityCategory; faction?: string;
  apCost?: number; range?: number; cooldown?: number; target?: string;
  effect: { kind: string } & Record<string, unknown>;
  text: string;
}

export interface FactionDef {
  id: string; name: string; identity: string; palette: string[]; primaryTheme: string;
  platoonOrder: string | null; passiveDoctrine: string | null; weakness: string;
}

export type Status =
  | "Guarded" | "Exposed" | "Suppressed" | "Hidden" | "Revealed"
  | "Silenced" | "Routed" | "Unstable";

export type Terrain =
  | "Open" | "Forest" | "HighGround" | "Fortification" | "Smoke" | "AntiAir" | "Water"
  | "Mountain" | "Valley" | "Trench" | "Mud" | "Road" | "Ford" | "Ruins";

/** Per-terrain rules. Costs are movement points; null = impassable. All numbers live here, not in code paths. */
export interface TerrainRule {
  costFoot: number | null; costCavalry: number | null; costFlying: number | null;
  def: number; concealment: boolean; blocksSight: boolean; chargeBreaks: boolean; ranged: { atk: number; range: number };
}
export const TERRAIN_RULES: Record<Terrain, TerrainRule> = {
  Open:          { costFoot: 1, costCavalry: 1, costFlying: 1, def: 0,   concealment: false, blocksSight: false, chargeBreaks: false, ranged: { atk: 0, range: 0 } },
  Road:          { costFoot: 1, costCavalry: 1, costFlying: 1, def: -50, concealment: false, blocksSight: false, chargeBreaks: false, ranged: { atk: 0, range: 0 } },
  Forest:        { costFoot: 2, costCavalry: 3, costFlying: 2, def: 50,  concealment: true,  blocksSight: true,  chargeBreaks: true,  ranged: { atk: 0, range: 0 } },
  HighGround:    { costFoot: 2, costCavalry: 2, costFlying: 1, def: 50,  concealment: false, blocksSight: false, chargeBreaks: false, ranged: { atk: 100, range: 1 } },
  Mountain:      { costFoot: 5, costCavalry: 6, costFlying: 2, def: 0, concealment: false, blocksSight: true, chargeBreaks: true, ranged: { atk: 0, range: 0 } },
  Valley:        { costFoot: 1, costCavalry: 1, costFlying: 1, def: -50, concealment: false, blocksSight: false, chargeBreaks: false, ranged: { atk: 0, range: 0 } },
  Trench:        { costFoot: 2, costCavalry: null, costFlying: 1, def: 150, concealment: true, blocksSight: false, chargeBreaks: true, ranged: { atk: 0, range: 0 } },
  Mud:           { costFoot: 2, costCavalry: 3, costFlying: 1, def: -50, concealment: false, blocksSight: false, chargeBreaks: true, ranged: { atk: 0, range: 0 } },
  Fortification: { costFoot: 1, costCavalry: 2, costFlying: 1, def: 200, concealment: false, blocksSight: true, chargeBreaks: true, ranged: { atk: 0, range: 0 } },
  Ruins:         { costFoot: 2, costCavalry: 3, costFlying: 1, def: 100, concealment: true, blocksSight: true, chargeBreaks: true, ranged: { atk: 0, range: 0 } },
  Water:         { costFoot: null, costCavalry: null, costFlying: 1, def: 0, concealment: false, blocksSight: false, chargeBreaks: true, ranged: { atk: 0, range: 0 } },
  Ford:          { costFoot: 2, costCavalry: 2, costFlying: 1, def: -100, concealment: false, blocksSight: false, chargeBreaks: true, ranged: { atk: 0, range: 0 } },
  Smoke:         { costFoot: 1, costCavalry: 1, costFlying: 1, def: 0,   concealment: true,  blocksSight: true,  chargeBreaks: false, ranged: { atk: 0, range: 0 } },
  AntiAir:       { costFoot: 1, costCavalry: 1, costFlying: null, def: 0, concealment: false, blocksSight: false, chargeBreaks: false, ranged: { atk: 0, range: 0 } },
};

export interface StatusInstance { status: Status; roundsLeft: number; stacks?: number; source: string }

export interface UnitState {
  uid: string;             // runtime instance id
  defId: string;
  side: string;            // "A" | "B"
  platoonId: string | null;
  pos: Hex | null;         // null when not deployed / removed
  facing: Facing;
  hp: number;
  morale: number;
  ap: number;
  statuses: StatusInstance[];
  cooldowns: Record<string, number>;
  isClone: boolean;
  cloneOf?: string;
  cloneRoundsLeft?: number;
  /**
   * How many bodies this unit's attack and defence are currently divided across: itself plus its
   * living copies. 1 or undefined means whole. Set on the original and on every clone when they
   * are made, and walked back down as copies leave the field.
   */
  splitBodies?: number;
  defeated: boolean;
  promotedFromSecond: boolean;
  movedThisActivation: number;
  chargeMoved: number;
  attackedThisActivation: boolean;
  overwatch: boolean;
  defending: boolean;
  usedChargeLastRound: boolean;
  setUp: boolean;
  shadowStepped: boolean;
  freeMoveHexes: number;
  captured: boolean;
  fusedFrom?: string[];
  fusionRoundsLeft?: number;
  divine?: { manifestation: number; anchors: number };
}

export interface PlatoonState {
  id: string; side: string; faction: string;
  commanderUid: string | null; secondUid: string | null; eliteUid: string | null; footUids: string[];
  orderUsedThisRound: boolean;
  continuityRoundsLeft: number;   // Doctrine persists after commander falls until succession
  pendingSuccession: boolean;
  markedTarget?: { uid: string; atk: number } | null;
}

export type DoctrineState = "Full" | "Reduced" | "Broken";

export interface Modifier { source: string; stat: "ATK" | "DEF" | "MOV" | "RANGE"; value: number }
export interface StatBreakdown { base: number; modifiers: Modifier[]; final: number }

export interface GameEvent { round: number; phase: string; type: string; data: Record<string, unknown> }

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

export type Terrain = "Open" | "Forest" | "HighGround" | "Fortification" | "Smoke" | "AntiAir" | "Water";

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
  cloneAtk?: number;
  defeated: boolean;
  promotedFromSecond: boolean;
  movedThisActivation: number;
  attackedThisActivation: boolean;
  overwatch: boolean;
  defending: boolean;
  usedChargeLastRound: boolean;
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

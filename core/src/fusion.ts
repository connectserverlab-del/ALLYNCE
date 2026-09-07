import type { Battle } from "./state.js";
import type { UnitState, UnitDef, Role, Size, SlotName } from "./types.js";
import { platoonMembers } from "./morale.js";

export interface FusionInput { defId?: string; roles?: Role[] }
export interface FusionResult {
  defId?: string; nameFormat?: string; hp?: "sum" | "max"; atk?: string; def?: string; mov?: "min" | "max";
  roles?: Role[]; size?: Size; slot?: SlotName; passives?: string[]; rounds?: number;
}
export interface FusionRecipe { id: string; name: string; text: string; inputs: FusionInput[]; sameTheme: boolean; divine?: boolean; charges?: number; result: FusionResult }

function matches(b: Battle, u: UnitState, inp: FusionInput): boolean {
  const d = b.def(u);
  if (inp.defId && d.id !== inp.defId) return false;
  if (inp.roles && !inp.roles.every((r) => d.roles.includes(r))) return false;
  return true;
}

/** Which recipes could these exact units satisfy (any input order)? */
export function eligibleRecipes(b: Battle, units: UnitState[]): FusionRecipe[] {
  const out: FusionRecipe[] = [];
  for (const r of b.reg.fusions.values()) {
    if (r.inputs.length !== units.length) continue;
    if (!permutationMatches(b, units, r.inputs)) continue;
    if (r.sameTheme && new Set(units.map((u) => b.def(u).themes[0])).size !== 1) continue;
    out.push(r);
  }
  return out;
}
function permutationMatches(b: Battle, units: UnitState[], inputs: FusionInput[]): boolean {
  if (!units.length) return true;
  const [u, ...rest] = units;
  for (let i = 0; i < inputs.length; i++) if (matches(b, u!, inputs[i]!) && permutationMatches(b, rest, inputs.filter((_, j) => j !== i))) return true;
  return false;
}

function derive(expr: string | undefined, values: number[]): number {
  const max = Math.max(...values), sum = values.reduce((s, v) => s + v, 0), min = Math.min(...values);
  if (!expr || expr === "max") return max;
  if (expr === "sum") return sum;
  if (expr === "min") return min;
  const m = /^max\+([0-9.]+)$/.exec(expr);
  if (m) { const others = sum - max; return Math.round(max + others * parseFloat(m[1]!)); }
  throw new Error(`Bad fusion expression ${expr}`);
}

/**
 * Fuse units into one. Requirements: same side, all adjacent to the first unit (a chain around it), each has 1 AP, none is a clone,
 * a Fusion charge is available for the side (recipe may cost more), divine recipes only with divine inputs.
 * The result occupies the first unit's hex, inherits the strongest input's morale and platoon slot, and the platoon loses the other members.
 */
export function fuse(b: Battle, units: UnitState[], recipeId: string): UnitState {
  const r = b.reg.fusions.get(recipeId);
  if (!r) throw new Error(`Unknown fusion ${recipeId}`);
  if (!eligibleRecipes(b, units).some((x) => x.id === recipeId)) throw new Error("Units do not satisfy the recipe");
  const [anchor, ...others] = units;
  if (!anchor || !anchor.pos) throw new Error("Anchor not deployed");
  const side = b.sides.get(anchor.side)!;
  for (const u of units) {
    if (u.side !== anchor.side) throw new Error("Different sides");
    if (u.isClone) throw new Error("Clones cannot fuse");
    if (u.ap < 1) throw new Error(`${u.uid} lacks AP`);
    if (!!b.def(u).divine !== !!r.divine) throw new Error("Divine and mortal units cannot fuse");
    if (u !== anchor && b.distance(u, anchor) !== 1) throw new Error("All inputs must be adjacent to the anchor");
  }
  const cost = r.charges ?? 1;
  if ((side.fusionCharges ?? 0) < cost) throw new Error("No Fusion charge left");
  side.fusionCharges = (side.fusionCharges ?? 0) - cost;

  const defs = units.map((u) => b.def(u));
  let def: UnitDef;
  if (r.result.defId) def = b.reg.unit(r.result.defId);
  else {
    const strongest = defs.reduce((a, c) => (c.atk + c.def > a.atk + a.def ? c : a));
    def = {
      ...strongest,
      id: `FUSED_${r.id}_${b.newUid("f")}`,
      name: (r.result.nameFormat ?? "{a}").replace("{a}", strongest.name),
      hp: derive(r.result.hp ?? "sum", units.map((u) => u.hp)),
      atk: derive(r.result.atk, defs.map((d) => d.atk)),
      def: derive(r.result.def, defs.map((d) => d.def)),
      mov: derive(r.result.mov ?? "min", defs.map((d) => d.mov)),
      roles: r.result.roles ?? strongest.roles,
      size: r.result.size ?? strongest.size,
      slots: r.result.slot ? [r.result.slot] : strongest.slots,
      passives: [...new Set([...strongest.passives, ...(r.result.passives ?? [])])],
      unique: false, summonOnly: true,
    };
    b.reg.units.set(def.id, def);
  }
  const pos = anchor.pos;
  const platoonId = anchor.platoonId;
  const morale = Math.max(...units.map((u) => u.morale));
  for (const u of units) { b.remove(u); u.defeated = true; u.hp = 0; }
  const fused = b.spawn(def.id, anchor.side, null, { platoonId, facing: anchor.facing, uidPrefix: "fused" });
  fused.hp = r.result.defId ? def.hp : def.hp; // derived def.hp already holds the summed current HP for mortal fusions
  fused.morale = b.def(fused).divine ? 100 : morale;
  fused.ap = Math.min(...units.map((u) => u.ap)) - 1;
  fused.fusedFrom = units.map((u) => u.uid);
  if (r.result.rounds) fused.fusionRoundsLeft = r.result.rounds;
  b.place(fused, pos);
  // platoon bookkeeping: the fused unit takes the anchor's slot; other inputs leave the roster
  if (platoonId) {
    const p = b.platoon(platoonId);
    const swap = (uid: string | null) => (uid === anchor.uid ? fused.uid : uid);
    p.commanderUid = swap(p.commanderUid); p.secondUid = swap(p.secondUid); p.eliteUid = swap(p.eliteUid);
    p.footUids = p.footUids.map((x) => (x === anchor.uid ? fused.uid : x)).filter((x) => !others.some((o) => o.uid === x));
    for (const o of others) { if (p.commanderUid === o.uid) p.commanderUid = null; if (p.secondUid === o.uid) p.secondUid = null; if (p.eliteUid === o.uid) p.eliteUid = null; }
    if (side.leaderUid && units.some((u) => u.uid === side.leaderUid)) side.leaderUid = fused.uid;
  }
  b.log("Fusion", { recipe: r.id, inputs: units.map((u) => u.uid), result: fused.uid, name: def.name, hp: fused.hp, atk: def.atk, def: def.def });
  return fused;
}

/** End Phase: timed fusions (Calamity Form) dissolve; the convergence leaves nothing behind. */
export function tickFusions(b: Battle): void {
  for (const u of [...b.activeUnits()]) {
    if (u.fusionRoundsLeft === undefined) continue;
    u.fusionRoundsLeft--;
    if (u.fusionRoundsLeft <= 0) { b.remove(u); u.defeated = true; b.log("FusionDissolved", { uid: u.uid }); }
  }
}
export { platoonMembers };

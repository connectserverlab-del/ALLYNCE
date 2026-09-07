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
  const [anchor] = units;
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
  fused.hp = def.hp; // for a named result def.hp is its max HP; for a derived one it already holds the summed current HP
  fused.morale = b.def(fused).divine ? 100 : morale;
  fused.ap = Math.min(...units.map((u) => u.ap)) - 1;
  fused.fusedFrom = units.map((u) => u.uid);
  if (r.result.rounds) fused.fusionRoundsLeft = r.result.rounds;
  b.place(fused, pos);
  // Platoon bookkeeping: every input leaves whichever slot it held, and the fused unit takes the
  // slot the recipe names (not just the anchor's own former slot, which need not match: Gate
  // Wardens fuses an Elite with a FootSoldier, and either could be passed as the anchor).
  if (platoonId) {
    const p = b.platoon(platoonId);
    const inputUids = new Set(units.map((u) => u.uid));
    if (inputUids.has(p.commanderUid ?? "")) p.commanderUid = null;
    if (inputUids.has(p.secondUid ?? "")) p.secondUid = null;
    if (inputUids.has(p.eliteUid ?? "")) p.eliteUid = null;
    p.footUids = p.footUids.filter((x) => !inputUids.has(x));
    const targetSlot = r.result.slot ?? b.def(anchor).slots[0];
    if (targetSlot === "Commander") p.commanderUid = fused.uid;
    else if (targetSlot === "Second") p.secondUid = fused.uid;
    else if (targetSlot === "Elite") p.eliteUid = fused.uid;
    else p.footUids.push(fused.uid);
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

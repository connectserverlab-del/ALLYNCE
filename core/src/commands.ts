import type { Battle } from "./state.js";
import type { BattleController } from "./battle.js";
import type { Hex } from "./hex.js";
import { summonFromHand, ritualSummon, fusionSummon, playStratagem } from "./cards.js";

/**
 * Every mutating entry point into a battle, as a plain, serialisable record. Lockstep sends
 * commands, not state: two `Battle` instances that apply the same command stream, in order,
 * reach the same event log and round hashes (`determinism.ts`). Every reference is a uid string,
 * never a live object, so a command survives `JSON.stringify`/`parse` and a network hop unchanged.
 */
export type Command =
  | { kind: "CommandPhase" }
  | { kind: "BeginActivation"; groupId: string }
  | { kind: "EndActivation"; groupId: string }
  | { kind: "Move"; uid: string; to: Hex; disengage?: boolean }
  | { kind: "Face"; uid: string; facing: number }
  | { kind: "Attack"; uid: string; targetUid: string }
  | { kind: "Subdue"; uid: string; targetUid: string }
  | { kind: "AttackStructure"; uid: string; portalId: string }
  | { kind: "Defend"; uid: string }
  | { kind: "Overwatch"; uid: string }
  | { kind: "Rally"; uid: string }
  | { kind: "Assist"; uid: string; ritualId: string }
  | { kind: "Capture"; uid: string; portalId: string }
  | { kind: "OpenPortal"; uid: string; pos: Hex }
  | { kind: "QueueReinforcement"; uid: string; portalId: string; defId: string }
  | { kind: "Channel"; uid: string; ritualId: string }
  | { kind: "ShadowStep"; uid: string; to: Hex }
  | { kind: "Fuse"; uids: string[]; recipeId: string }
  | { kind: "Surrender"; side: string; byUid?: string }
  | { kind: "UseAbility"; uid: string; abilityId: string; targetUid?: string; targetHex?: Hex }
  | { kind: "UseCompanyOrder"; uid: string; targetUid?: string; targetHex?: Hex }
  | { kind: "ObjectivePhase"; releaseDecisions?: Record<string, boolean> }
  | { kind: "EndPhase" }
  | { kind: "SummonFromHand"; side: string; unitId: string; at: Hex; tributeUids?: string[]; platoonId?: string | null }
  | { kind: "RitualSummon"; side: string; cardId: string; sacrificeUids: string[] }
  | { kind: "FusionSummon"; side: string; cardId: string; materialUids: string[] }
  | { kind: "PlayStratagem"; side: string; cardId: string; platoonId?: string; targetHex?: Hex };

export type CommandKind = Command["kind"];

function unitOf(b: Battle, uid: string) { return b.unit(uid); } // throws on an unknown uid, same as every other lookup in the engine

function portalOf(b: Battle, id: string) {
  const p = b.portals.get(id);
  if (!p) throw new Error(`No portal ${id}`);
  return p;
}

function ritualOf(b: Battle, id: string) {
  const r = b.rituals.get(id);
  if (!r) throw new Error(`No ritual ${id}`);
  return r;
}

/**
 * The single funnel every mutation runs through. Resolves each command's uid references to live
 * objects, calls the one `BattleController` method or card-play function that already owns that
 * mutation, and appends the command to `Battle.commands` once it has actually applied — a command
 * that throws never mutated the battle, so it is never logged as if it had.
 *
 * This does not replace the named methods on `BattleController`; they stay the implementation.
 * `applyCommand` is the layer above them a network client or a replay drives instead of calling
 * them directly, so the two can never drift into different validation.
 */
export function applyCommand(ctl: BattleController, cmd: Command): void {
  const b = ctl.b;
  switch (cmd.kind) {
    case "CommandPhase": ctl.commandPhase(); break;
    case "BeginActivation": ctl.beginActivation(cmd.groupId); break;
    case "EndActivation": ctl.endActivation(cmd.groupId); break;
    case "Move": ctl.move(unitOf(b, cmd.uid), cmd.to, { disengage: cmd.disengage }); break;
    case "Face": ctl.face(unitOf(b, cmd.uid), cmd.facing); break;
    case "Attack": ctl.attack(unitOf(b, cmd.uid), unitOf(b, cmd.targetUid)); break;
    case "Subdue": ctl.subdue(unitOf(b, cmd.uid), unitOf(b, cmd.targetUid)); break;
    case "AttackStructure": ctl.attackStructure(unitOf(b, cmd.uid), portalOf(b, cmd.portalId)); break;
    case "Defend": ctl.defend(unitOf(b, cmd.uid)); break;
    case "Overwatch": ctl.overwatch(unitOf(b, cmd.uid)); break;
    case "Rally": ctl.rally(unitOf(b, cmd.uid)); break;
    case "Assist": ctl.assist(unitOf(b, cmd.uid), ritualOf(b, cmd.ritualId)); break;
    case "Capture": ctl.capture(unitOf(b, cmd.uid), portalOf(b, cmd.portalId)); break;
    case "OpenPortal": ctl.openPortal(unitOf(b, cmd.uid), cmd.pos); break;
    case "QueueReinforcement": ctl.queueReinforcement(unitOf(b, cmd.uid), portalOf(b, cmd.portalId), cmd.defId); break;
    case "Channel": ctl.channel(unitOf(b, cmd.uid), ritualOf(b, cmd.ritualId)); break;
    case "ShadowStep": ctl.shadowStep(unitOf(b, cmd.uid), cmd.to); break;
    case "Fuse": ctl.fuse(cmd.uids.map((u) => unitOf(b, u)), cmd.recipeId); break;
    case "Surrender": ctl.surrender(cmd.side, cmd.byUid ? unitOf(b, cmd.byUid) : undefined); break;
    case "UseAbility": ctl.useAbility(unitOf(b, cmd.uid), cmd.abilityId, { target: cmd.targetUid ? unitOf(b, cmd.targetUid) : undefined, targetHex: cmd.targetHex }); break;
    case "UseCompanyOrder": ctl.useCompanyOrder(unitOf(b, cmd.uid), { target: cmd.targetUid ? unitOf(b, cmd.targetUid) : undefined, targetHex: cmd.targetHex }); break;
    case "ObjectivePhase": ctl.objectivePhase(cmd.releaseDecisions ?? {}); break;
    case "EndPhase": ctl.endPhase(); break;
    case "SummonFromHand": summonFromHand(b, cmd.side, cmd.unitId, cmd.at, { tributes: (cmd.tributeUids ?? []).map((u) => unitOf(b, u)), platoonId: cmd.platoonId }); break;
    case "RitualSummon": ritualSummon(b, cmd.side, cmd.cardId, cmd.sacrificeUids.map((u) => unitOf(b, u))); break;
    case "FusionSummon": fusionSummon(b, cmd.side, cmd.cardId, cmd.materialUids.map((u) => unitOf(b, u))); break;
    case "PlayStratagem": playStratagem(b, cmd.side, cmd.cardId, { platoon: cmd.platoonId ? b.platoon(cmd.platoonId) : undefined, targetHex: cmd.targetHex }); break;
    default: { const exhaustive: never = cmd; throw new Error(`Unknown command ${(exhaustive as Command).kind}`); }
  }
  b.commands.push(cmd);
}

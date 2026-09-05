/**
 * Turning the deterministic event log a battle already keeps into something a viewer can step through.
 *
 * Nothing here changes what a battle records; `Battle.log` in `state.ts` is unchanged. This module only reads
 * `Battle.events` (or a saved copy of it, see `save.ts`) and narrates it one entry at a time, so a save file,
 * a finished `runMatch` result, or a live battle mid-round can all be replayed the same way.
 */
import type { Battle } from "./state.js";
import type { GameEvent } from "./types.js";

function unitName(b: Battle, uid: unknown): string {
  if (typeof uid !== "string") return "?";
  const u = b.units.get(uid);
  if (!u) return uid;
  try { return b.def(u).name; } catch { return uid; }
}

function unitNames(b: Battle, uids: unknown): string {
  if (!Array.isArray(uids)) return "";
  return uids.map((u) => unitName(b, u)).join(", ");
}

function hexText(h: unknown): string {
  if (!h || typeof h !== "object") return "?";
  const { q, r } = h as { q?: unknown; r?: unknown };
  return `(${q},${r})`;
}

function fallback(ev: GameEvent): string {
  const parts = Object.entries(ev.data).map(([k, v]) => `${k}=${Array.isArray(v) ? `[${v.join(", ")}]` : JSON.stringify(v)}`);
  return `${ev.type}${parts.length ? ` — ${parts.join(", ")}` : ""}`;
}

/**
 * Render one event as a sentence a human can read. Every event type `Battle.log` ever emits (see the
 * `.log(` call sites across `core/src`) has a case here; an event type that has none yet falls back to a
 * plain key/value rendering rather than throwing, so a new event type never breaks the viewer, it just
 * reads a little flatter until someone teaches this function about it.
 */
export function describeEvent(b: Battle, ev: GameEvent): string {
  const d = ev.data;
  switch (ev.type) {
    case "PhaseStart": return `${d.phase ?? ev.phase} phase begins`;
    case "Draw": return `${d.side} draws ${Array.isArray(d.cards) ? d.cards.length : 0} card(s), hand now ${d.hand}`;
    case "ActivationStart": return `Group ${d.group} activates: ${unitNames(b, d.units)}`;
    case "ActivationEnd": return `Group ${d.group} ends its activation`;

    case "Move": return `${unitName(b, d.uid)} moves from ${hexText(d.from)} to ${hexText(d.to)} for ${d.cost} AP`;
    case "LaboredClimb": return `${unitName(b, d.uid)} labors up onto ${d.terrain} at ${d.cost} AP, spending its whole activation`;
    case "ShadowStep": return `${unitName(b, d.uid)} shadow-steps from ${hexText(d.from)} to ${hexText(d.to)}`;
    case "RoutedRetreat": return `${unitName(b, d.uid)} routs and retreats to ${hexText(d.to)}`;

    case "Attack": return `${unitName(b, d.attacker)} attacks ${unitName(b, d.target)} (${d.arc}) for ${d.damage} damage`
      + `${d.defeated ? ", defeating it" : ""}${d.intercepted ? " — intercepted" : ""}`;
    case "ReactionAttack": return `${unitName(b, d.by)} makes a reaction attack on ${unitName(b, d.on)}`;
    case "OverwatchTriggered": return `${unitName(b, d.by)}'s overwatch fires on ${unitName(b, d.on)}`;
    case "Defend": return `${unitName(b, d.uid)} defends`;
    case "Overwatch": return `${unitName(b, d.uid)} sets overwatch`;
    case "Defeated": return `${unitName(b, d.uid)} is defeated by ${d.by}${d.clone ? " (a clone body)" : ""}`;
    case "Subdued": return `${unitName(b, d.target)} is subdued by ${unitName(b, d.by)}, taken alive`;
    case "DivineStaggered": return `${unitName(b, d.uid)} staggers instead of falling, ${d.anchorsLeft} anchor(s) left`;
    case "AnchorBroken": return `${unitName(b, d.uid)} loses an anchor to ${unitName(b, d.by)}, ${d.anchorsLeft} left`;
    case "SplitShareReclaimed": return `${unitName(b, d.uid)} reclaims a fallen clone's share, ${d.bodies} bod${d.bodies === 1 ? "y" : "ies"} left`;
    case "CloneExpired": return `${unitName(b, d.uid)}'s clone body expires`;

    case "Morale": return `${unitName(b, d.uid)} morale ${typeof d.delta === "number" && d.delta >= 0 ? "+" : ""}${d.delta} (${d.reason}), now ${d.morale} — ${d.band}`;
    case "StatusApplied": return `${unitName(b, d.uid)} gains ${d.status} from ${d.source}`;

    case "CommanderFallen": return `The commander of platoon ${d.platoon} falls`;
    case "Succession": return `${d.name} is promoted to command platoon ${d.platoon}`;
    case "SuccessionFailed": return `Platoon ${d.platoon} cannot promote a successor: ${d.reason}`;
    case "Rally": return `${unitName(b, d.uid)} rallies`;
    case "Surrender": return `Side ${d.side} surrenders${d.by ? `, called by ${unitName(b, d.by)}` : ""}`;
    case "BattleEnded": return `The battle ends — ${d.winner} wins by ${d.reason}`;

    case "AbilityUsed": return `${unitName(b, d.uid)} uses ${d.ability}${d.target ? ` on ${unitName(b, d.target)}` : ""}`;
    case "Ability": return `${unitName(b, d.uid)} triggers ${d.ability}`
      + `${d.target ? ` on ${unitName(b, d.target)}` : ""}${typeof d.affected === "number" ? `, affecting ${d.affected}` : ""}${d.hit === true ? " (hit)" : d.hit === false ? " (missed)" : ""}`;
    case "SelfSacrifice": return `${unitName(b, d.uid)} spends ${d.hp} HP on ${d.ability} for +${d.atk} ATK`;
    case "SiegeSetup": return `${unitName(b, d.uid)} finishes setting up`;
    case "TerrainSpawned": return `${unitName(b, d.uid)} lays ${d.count} hex(es) of ${d.terrain}`;
    case "ClonesSpawned": return `${unitName(b, d.uid)} splits into ${d.clones} clone(s) across ${d.bodies} bodies (${d.share} share each, ${d.duration} round(s))`;

    case "Channel": return `${unitName(b, d.uid)} channels ritual ${d.ritual}`;
    case "RitualProgress": return `Ritual ${d.ritual} progresses to ${d.progress}/${d.required}`;
    case "RitualHeld": return `Ritual ${d.ritual} is held for ${d.heldRounds} round(s): ${d.unstable} unstable stack(s), ${d.damage} damage to its circle`;
    case "RitualDisrupted": return `Ritual ${d.ritual} is disrupted`;
    case "RitualDisruption": return `Ritual ${d.ritual} takes ${d.amount} disruption from ${unitName(b, d.by)}`;
    case "RitualAssist": return `${unitName(b, d.uid)} assists ritual ${d.ritual}`;
    case "RitualCompleted": return `Ritual ${d.ritual} completes`;
    case "RitualCollapsed": return `Ritual ${d.ritual} collapses: ${d.reason}`;
    case "RitualReleased": return `Ritual ${d.ritual} releases${d.synchronized ? ", synchronized with its linked circles" : ""}`
      + `${d.summon ? `, summoning ${unitName(b, d.summon)}` : ""}`;
    case "Reincarnated": return `${unitName(b, d.uid)} is reincarnated`;
    case "DivineManifested": return `${unitName(b, d.uid)} manifests (${d.arrival})`;
    case "SynchronizedRelease": return `Group ${d.group} of rituals releases in synchrony`;

    case "Tributed": return `${unitName(b, d.uid)} is offered as tribute (${d.reason})`;
    case "Summon": return `${d.side} summons ${unitName(b, d.uid)}${Array.isArray(d.tributes) && d.tributes.length ? `, tributing ${d.tributes.length}` : ""}`;
    case "RitualSummon": return `${d.side} ritual-summons ${d.result}, offered by ${unitName(b, d.uid)}`;
    case "FusionSummon": return `${d.side} fusion-summons from side card ${d.card}`;
    case "Fusion": return `${unitNames(b, d.inputs)} fuse into ${d.name}`;
    case "FusionDissolved": return `${unitName(b, d.uid)}'s fusion dissolves`;

    case "PortalCalled": return `${d.side} calls portal ${d.portal} at ${hexText(d.pos)}`;
    case "PortalOpened": return `Portal ${d.portal} opens`;
    case "PortalBlocked": return `Portal ${d.portal} is blocked, ${d.queued} unit(s) still queued`;
    case "ReinforcementQueued": return `Portal ${d.portal} queues ${d.defId} for ${d.cost} reserve point(s)`;
    case "ReinforcementArrived": return `${unitName(b, d.uid)} arrives through portal ${d.portal}`;
    case "PortalAttacked": return `Portal ${d.portal} takes ${d.damage} damage from ${unitName(b, d.by)}, ${d.hp} HP left`;
    case "PortalDestroyed": return `Portal ${d.portal} is destroyed by ${unitName(b, d.by)}${typeof d.refund === "number" && d.refund > 0 ? `, refunding ${d.refund}` : ""}`;
    case "PortalCaptureStep": return `${unitName(b, d.by)} advances the capture of portal ${d.portal} (${d.progress})`;
    case "PortalCaptureInterrupted": return `The capture of portal ${d.portal} is interrupted`;
    case "PortalCaptured": return `Portal ${d.portal} is captured for ${d.newSide}`;

    case "PlatoonDeployed": return `Platoon ${d.platoon} deploys for ${d.side}`;
    case "KingdomApplied": return `${d.side}'s holding ${d.holding} applies to the battle: capacity ${d.armyCapacity}, ${d.research} research done`;

    default: return fallback(ev);
  }
}

/** One narrated step: the raw event plus where it sits in the log and its rendered text. */
export interface ReplayStep { readonly index: number; readonly event: GameEvent; readonly text: string }

/**
 * A cursor over a battle's event log. Starts positioned before the first event, like a video player at
 * 0:00; `next()`/`prev()` move one event at a time, `seek()`/`jumpToRound()` move directly. All of it reads
 * `battle.units` to resolve names, so pass the battle the log came from (or one restored from the same save
 * via `loadBattle`) — a bare array of events has no unit definitions to narrate against.
 */
export class Replay {
  readonly events: readonly GameEvent[];
  private cursor = -1;

  constructor(private readonly battle: Battle, events?: readonly GameEvent[]) {
    this.events = events ?? battle.events;
  }

  get length(): number { return this.events.length; }
  /** Index of the current step, or -1 before the first event. */
  get position(): number { return this.cursor; }
  atStart(): boolean { return this.cursor < 0; }
  atEnd(): boolean { return this.cursor >= this.events.length - 1; }

  current(): ReplayStep | null { return this.cursor >= 0 ? this.describe(this.cursor) : null; }

  next(): ReplayStep | null {
    if (this.atEnd()) return null;
    this.cursor++;
    return this.describe(this.cursor);
  }
  prev(): ReplayStep | null {
    if (this.atStart()) return null;
    this.cursor--;
    return this.cursor >= 0 ? this.describe(this.cursor) : null;
  }

  /** Jump straight to an index; -1 is the start-of-log position, one before the first event. */
  seek(index: number): ReplayStep | null {
    if (index < -1 || index >= this.events.length) throw new RangeError(`Replay index ${index} is out of range (0..${this.events.length - 1})`);
    this.cursor = index;
    return this.current();
  }
  reset(): void { this.cursor = -1; }

  /** Distinct round numbers the log touches, in order. */
  rounds(): number[] { return [...new Set(this.events.map((e) => e.round))].sort((a, b) => a - b); }
  eventsInRound(round: number): GameEvent[] { return this.events.filter((e) => e.round === round); }
  /** Move the cursor to the first event of `round`; leaves the cursor unchanged if the round never happened. */
  jumpToRound(round: number): ReplayStep | null {
    const i = this.events.findIndex((e) => e.round === round);
    return i < 0 ? null : this.seek(i);
  }

  /** All steps whose event matches `pred`, independent of the cursor. */
  filter(pred: (e: GameEvent) => boolean): ReplayStep[] {
    const out: ReplayStep[] = [];
    this.events.forEach((e, i) => { if (pred(e)) out.push(this.describe(i)); });
    return out;
  }

  private describe(i: number): ReplayStep {
    const event = this.events[i]!;
    return { index: i, event, text: describeEvent(this.battle, event) };
  }
}

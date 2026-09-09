import { describe, it, expect } from "vitest";
import type { Battle } from "../src/state.js";
import type { BattleController } from "../src/battle.js";
import { newBattle } from "./helpers.js";
import { applyCommand, type Command } from "../src/commands.js";
import { hashEvents, roundHashes } from "../src/determinism.js";

/**
 * `Q-22`: a fresh battle, built the same deterministic way as another one (same seed, same spawns,
 * nothing random beyond the seed), replayed through nothing but that other battle's `Battle.commands`
 * via `applyCommand`, must reach the same event log and the same per-round hashes. That is the proof
 * `Q-21`'s command funnel is actually complete: any mutation that reached the battle some other way
 * never lands in `commands`, so a rebuild from the log alone cannot reproduce it and the two hashes
 * fall out of step — see the second test below.
 */
interface Setup { b: Battle; ctrl: BattleController; mover: string; attacker: string; commander: string; target: string }

function setup(seed: number): Setup {
  const { b, ctrl } = newBattle(seed);
  const mover = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 }).uid;
  const attacker = b.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 10, r: 10 }).uid;
  const commander = b.spawn("SAM_COMMANDER_EMBER-BANNER-DAIMYO", "A", { q: 5, r: 6 }).uid;
  const target = b.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 11, r: 10 }).uid;
  return { b, ctrl, mover, attacker, commander, target };
}

/** Two full CommandPhase..EndPhase rounds, so the round hash accumulates more than one entry: a
 *  Move and an Attack in the first, a Rally and a Defend in the second. */
function script(u: Setup): Command[] {
  return [
    { kind: "CommandPhase" },
    { kind: "BeginActivation", groupId: "ind:A" },
    { kind: "Move", uid: u.mover, to: { q: 6, r: 5 } },
    { kind: "Attack", uid: u.attacker, targetUid: u.target },
    { kind: "EndActivation", groupId: "ind:A" },
    { kind: "BeginActivation", groupId: "ind:B" },
    { kind: "EndActivation", groupId: "ind:B" },
    { kind: "ObjectivePhase" },
    { kind: "EndPhase" },
    { kind: "CommandPhase" },
    { kind: "BeginActivation", groupId: "ind:A" },
    { kind: "Rally", uid: u.commander },
    { kind: "Defend", uid: u.mover },
    { kind: "EndActivation", groupId: "ind:A" },
    { kind: "BeginActivation", groupId: "ind:B" },
    { kind: "EndActivation", groupId: "ind:B" },
    { kind: "ObjectivePhase" },
    { kind: "EndPhase" },
  ];
}

describe("Q-22: rebuilding a battle from its command log alone", () => {
  it("a fresh battle replayed from another battle's own command log reaches the same event log and round hashes", () => {
    const original = setup(4001);
    for (const cmd of script(original)) applyCommand(original.ctrl, cmd);
    expect(original.b.commands.length).toBeGreaterThan(0);

    // A JSON round trip is exactly what a save or a network hop does to a command log; rebuild from
    // that, not the in-memory array, so this proves the log itself carries everything needed.
    const log: Command[] = JSON.parse(JSON.stringify(original.b.commands));
    const rebuild = setup(4001);
    for (const cmd of log) applyCommand(rebuild.ctrl, cmd);

    expect(hashEvents(rebuild.b.events)).toBe(hashEvents(original.b.events));
    expect(rebuild.b.round).toBe(original.b.round);

    const originalRounds = roundHashes(original.b.events);
    const rebuiltRounds = roundHashes(rebuild.b.events);
    expect(originalRounds.size).toBeGreaterThanOrEqual(2);
    expect(rebuiltRounds).toEqual(originalRounds);
  });

  it("a mutation that bypasses applyCommand never reaches the log, so a rebuild from the log alone diverges from what actually happened", () => {
    const truth = setup(4002);
    for (const cmd of script(truth)) {
      // Every command goes through applyCommand except this one, standing in for a caller that
      // forgot to route a mutation through the funnel: it changes `truth.b` for real without ever
      // being appended to `truth.b.commands`.
      if (cmd.kind === "Defend") { truth.ctrl.defend(truth.b.unit(cmd.uid)); continue; }
      applyCommand(truth.ctrl, cmd);
    }

    const rebuild = setup(4002);
    for (const cmd of truth.b.commands) applyCommand(rebuild.ctrl, cmd);

    // The rebuild only ever saw what the log recorded, so it never saw the Defend — exactly the
    // mismatch an incomplete command layer would produce, and the reason this pair of tests exists.
    expect(hashEvents(rebuild.b.events)).not.toBe(hashEvents(truth.b.events));
  });
});

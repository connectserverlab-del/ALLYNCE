import { buildScenario } from "./scenario.js";
import { runAiActivation, holdForSyncPolicy, maybeSurrender, DIFFICULTY } from "./ai.js";

/** Runs Threefold Invocation with AI on both sides and prints a readable log. */
const { ctrl, file } = buildScenario("threefold_invocation");
const b = ctrl.b;
console.log(`# ${file.title}\n${file.briefing}\n`);

while (!b.winner && b.round <= file.roundLimit + 1) {
  ctrl.commandPhase();
  const sides = ["A", "B"];
  let turn = b.round % 2 === 1 ? 0 : 1;
  for (let guard = 0; guard < 20; guard++) {
    const groups = ctrl.groupsFor(sides[turn]!);
    const other = ctrl.groupsFor(sides[1 - turn]!);
    if (!groups.length && !other.length) break;
    if (groups.length) runAiActivation(ctrl, groups[0]!, DIFFICULTY.normal);
    turn = 1 - turn;
  }
  if (!b.winner) for (const s of ["A", "B"]) if (maybeSurrender(ctrl, s)) break;
  ctrl.objectivePhase(holdForSyncPolicy(ctrl, "A"));
  const rit = [...b.rituals.values()].map((r) => `${r.id}=${r.state}:${r.progress}/${r.required}${r.unstableStacks ? ` U${r.unstableStacks}` : ""}`).join("  ");
  const alive = (s: string) => [...b.activeUnits(s)].filter((u) => !u.isClone).length;
  console.log(`Round ${String(b.round).padStart(2)} | A:${alive("A")} B:${alive("B")} | morale A ${ctrl.moraleSummary("A").average} B ${ctrl.moraleSummary("B").average} | ${rit}`);
  ctrl.endPhase();
}
console.log(`\nWinner: ${b.winner} (${b.winReason})`);
const counts: Record<string, number> = {};
for (const e of b.events) counts[e.type] = (counts[e.type] ?? 0) + 1;
console.log("Events:", counts);

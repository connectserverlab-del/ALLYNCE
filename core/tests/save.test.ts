import { describe, it, expect } from "vitest";
import { newBattle, SAM, SHI, deploy, blob } from "./helpers.js";
import { applyEffect, duels, orderFlags, hideAfterAttack, timedTerrain } from "../src/effects.js";
import { interceptUsed } from "../src/combat.js";
import { tempPreventRouted } from "../src/morale.js";
import { saveBattle, loadBattle } from "../src/save.js";

// A save that drops a mid-round effect flag is the same bug as a save that drops a mid-progress ritual:
// it round-trips clean and then plays differently. These six flags (Formal Duel pairings, PhaseMove /
// SequencedMove orders, Silent Directive's hide mark, Oath of Intercession's once-per-round use, Hold the
// Standard's rout immunity, and timed terrain such as smoke) live as process-wide state outside the
// Battle object, so a save has to capture them by hand. Each check below clears that process state before
// loading, the same way a real save/load cycle would start from nothing after a process restart.
describe("saveBattle/loadBattle round-trip process-wide effect flags", () => {
  it("restores a Formal Duel pairing", () => {
    const { b, ctrl } = newBattle();
    const a = deploy(b, "pA", "A", SAM, blob(2, 2));
    const bb = deploy(b, "pB", "B", SHI, blob(2, 8));
    const champion = b.unit(a.commanderUid!); const rival = b.unit(bb.commanderUid!);
    ctrl.commandPhase();
    applyEffect(b, champion, b.reg.ability("ABL_FORMAL_DUEL"), { target: rival });
    expect(duels.get(rival.uid)).toBe(champion.uid);

    const snap = saveBattle(b);
    duels.clear();
    expect(duels.size).toBe(0);
    loadBattle(b.reg, snap);
    expect(duels.get(rival.uid)).toBe(champion.uid);
    expect(duels.get(champion.uid)).toBe(rival.uid);
  });

  it("restores a PhaseMove order flag on every platoon member", () => {
    const { b, ctrl } = newBattle();
    const a = deploy(b, "pA", "A", SAM, blob(2, 2));
    const commander = b.unit(a.commanderUid!);
    ctrl.commandPhase();
    applyEffect(b, commander, b.reg.ability("ORD_VEIL_CROSSING"), { platoon: b.platoon(a.id) });
    const foot = a.footUids[0]!;
    expect(orderFlags.get(foot)).toBe("PhaseMove");

    const snap = saveBattle(b);
    orderFlags.clear();
    loadBattle(b.reg, snap);
    expect(orderFlags.get(foot)).toBe("PhaseMove");
  });

  it("restores a Silent Directive hide-after-attack mark", () => {
    const { b, ctrl } = newBattle();
    const shinobi = b.spawn("SHI_FOOT_NIGHT-THREAD-OPERATIVE", "A", { q: 5, r: 5 });
    ctrl.commandPhase();
    applyEffect(b, shinobi, b.reg.ability("ABL_SILENT_DIRECTIVE"), { target: shinobi });
    expect(hideAfterAttack.has(shinobi.uid)).toBe(true);

    const snap = saveBattle(b);
    hideAfterAttack.clear();
    loadBattle(b.reg, snap);
    expect(hideAfterAttack.has(shinobi.uid)).toBe(true);
  });

  it("restores Oath of Intercession's once-per-round use and Hold the Standard's rout immunity", () => {
    const { b } = newBattle();
    interceptUsed.add("u1");
    tempPreventRouted.add("u2");

    const snap = saveBattle(b);
    interceptUsed.clear(); tempPreventRouted.clear();
    loadBattle(b.reg, snap);
    expect(interceptUsed.has("u1")).toBe(true);
    expect(tempPreventRouted.has("u2")).toBe(true);
  });

  it("restores unexpired timed terrain (a smoke shell mid-duration)", () => {
    const { b, ctrl } = newBattle();
    const mortar = b.spawn("SHI_SIEGE_REED-SMOKE-MORTAR", "A", { q: 2, r: 2 });
    ctrl.commandPhase();
    applyEffect(b, mortar, b.reg.ability("ABL_SMOKE_SHELL"), { targetHex: { q: 10, r: 10 } });
    expect(b.terrainAt({ q: 10, r: 10 })).toBe("Smoke");
    expect(timedTerrain.some((t) => t.key === "10,10")).toBe(true);

    const snap = saveBattle(b);
    timedTerrain.length = 0;
    loadBattle(b.reg, snap);
    expect(timedTerrain.some((t) => t.key === "10,10" && t.rounds === 2)).toBe(true);
  });
});

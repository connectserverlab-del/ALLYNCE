import { describe, it, expect } from "vitest";
import { newBattle } from "./helpers.js";
import { applyEffect } from "../src/effects.js";
import { resolveAttack } from "../src/combat.js";

// These flags used to live as module-level Maps/Sets in effects.ts, combat.ts and morale.ts, keyed by
// unit uid. A uid is only unique within the Battle that minted it (a fresh counter per instance), so any
// two Battle objects that ever coexist in the same process — which already happens across the `it()`
// blocks in one test file, since vitest shares module state within a file — could read, consume or
// overwrite each other's duels, hidden-after-attack marks, order flags and timed terrain. `timedTerrain`
// was the sharpest case: it is never bulk-cleared, only decremented, so leftover entries from one battle
// would eventually reach into a second battle's own terrain map and delete something that battle placed
// itself. These tests pin the fix: each Battle now owns its own copies (`core/src/state.ts`).
describe("per-round effect state is scoped to its own battle", () => {
  it("one battle's timed terrain never decays or deletes another battle's terrain", () => {
    const { b: a, ctrl: actrl } = newBattle();
    const mortar = a.spawn("SHI_SIEGE_REED-SMOKE-MORTAR", "A", { q: 2, r: 2 });
    actrl.commandPhase(); actrl.beginActivation("ind:A");
    actrl.useAbility(mortar, "ABL_SMOKE_SHELL", { targetHex: { q: 10, r: 10 } });
    expect(a.terrainAt({ q: 10, r: 10 })).toBe("Smoke");
    // battle A never runs enough end phases for its smoke to decay

    const { b: bb, ctrl: bctrl } = newBattle();
    bb.terrain.set("10,10", "Forest"); // battle B's own, unrelated terrain at the same coordinates
    bctrl.commandPhase();
    bctrl.endPhase();
    bctrl.commandPhase();
    bctrl.endPhase(); // two end phases: enough to fully decay a duration-2 timer, if it were shared

    expect(bb.terrainAt({ q: 10, r: 10 })).toBe("Forest"); // untouched by battle A's smoke shell
    expect(a.terrainAt({ q: 10, r: 10 })).toBe("Smoke");   // battle A's own smoke is still A's business, not B's
  });

  it("a Formal Duel in one battle does not block an unrelated attack in another", () => {
    const { b: a, ctrl: actrl } = newBattle();
    const duelistA = a.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    const rivalA = a.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    actrl.commandPhase(); actrl.beginActivation("ind:A");
    applyEffect(a, duelistA, a.reg.ability("ABL_FORMAL_DUEL"), { target: rivalA });
    expect(a.duels.get(rivalA.uid)).toBe(duelistA.uid);

    const { b: bb } = newBattle();
    // fresh uid counters mean bb's units can legitimately land on the same uids A's duelists used
    const attacker = bb.spawn("SAM_FOOT_EMBERLINE-ASHIGARU", "A", { q: 5, r: 5 });
    const target = bb.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    expect(attacker.uid).toBe(duelistA.uid);
    expect(target.uid).toBe(rivalA.uid);
    expect(bb.duels.size).toBe(0);
    expect(() => resolveAttack(bb, attacker, target)).not.toThrow();
  });

  it("Silent Directive's hidden-after-attack mark does not leak into another battle's identical uid", () => {
    const { b: a, ctrl: actrl } = newBattle();
    const shinobiA = a.spawn("SHI_FOOT_NIGHT-THREAD-OPERATIVE", "A", { q: 5, r: 5 });
    const foeA = a.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    actrl.commandPhase(); actrl.beginActivation("ind:A");
    applyEffect(a, shinobiA, a.reg.ability("ABL_SILENT_DIRECTIVE"), { target: shinobiA });
    expect(a.hideAfterAttack.has(shinobiA.uid)).toBe(true);

    const { b: bb } = newBattle();
    const shinobiB = bb.spawn("SHI_FOOT_NIGHT-THREAD-OPERATIVE", "A", { q: 5, r: 5 });
    const foeB = bb.spawn("KNI_FOOT_BASTION-MAN-AT-ARMS", "B", { q: 6, r: 5 });
    expect(shinobiB.uid).toBe(shinobiA.uid); // same fresh-counter uid, different battle
    expect(bb.hideAfterAttack.has(shinobiB.uid)).toBe(false);
    resolveAttack(bb, shinobiB, foeB);
    expect(bb.hasStatus(shinobiB, "Hidden")).toBe(false); // nothing marked it in this battle
    void foeA;
  });
});

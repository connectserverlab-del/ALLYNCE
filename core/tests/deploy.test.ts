import { describe, it, expect } from "vitest";
import { deployPlatoon } from "../src/deploy.js";
import { newBattle, SAM, blob } from "./helpers.js";

describe("deployPlatoon", () => {
  it("refuses fewer than eight hexes for a standard platoon", () => {
    const { b } = newBattle();
    expect(() => deployPlatoon(b, { id: "P1", side: "A", ...SAM }, blob(0, 0).slice(0, 7))).toThrow(/Need 8 hexes/);
  });

  it("spawns commander, second, elite and foot in slot order onto the given hexes", () => {
    const { b } = newBattle();
    const hexes = blob(0, 0);
    const p = deployPlatoon(b, { id: "P1", side: "A", ...SAM }, hexes);
    expect(p.commanderUid).not.toBeNull();
    expect(p.secondUid).not.toBeNull();
    expect(p.eliteUid).not.toBeNull();
    expect(p.footUids).toHaveLength(5);

    const commander = b.units.get(p.commanderUid!)!;
    const second = b.units.get(p.secondUid!)!;
    const elite = b.units.get(p.eliteUid!)!;
    expect(commander.pos).toEqual(hexes[0]);
    expect(second.pos).toEqual(hexes[1]);
    expect(elite.pos).toEqual(hexes[2]);
    p.footUids.forEach((uid, i) => expect(b.units.get(uid)!.pos).toEqual(hexes[3 + i]));
  });

  it("registers the platoon on the battle and tags every unit with its platoon id and side", () => {
    const { b } = newBattle();
    const p = deployPlatoon(b, { id: "P1", side: "A", ...SAM }, blob(0, 0));
    expect(b.platoons.get("P1")).toBe(p);
    for (const uid of [p.commanderUid!, p.secondUid!, p.eliteUid!, ...p.footUids]) {
      const u = b.units.get(uid)!;
      expect(u.platoonId).toBe("P1");
      expect(u.side).toBe("A");
    }
  });

  it("faces every spawned unit the way the platoon was told to face", () => {
    const { b } = newBattle();
    const p = deployPlatoon(b, { id: "P1", side: "A", ...SAM }, blob(0, 0), 3);
    for (const uid of [p.commanderUid!, p.secondUid!, p.eliteUid!, ...p.footUids]) {
      expect(b.units.get(uid)!.facing).toBe(3);
    }
  });

  it("logs a PlatoonDeployed event naming the platoon and side", () => {
    const { b } = newBattle();
    deployPlatoon(b, { id: "P1", side: "A", ...SAM }, blob(0, 0));
    const event = b.events.find((e) => e.type === "PlatoonDeployed");
    expect(event?.data).toMatchObject({ platoon: "P1", side: "A" });
  });
});

import { describe, it, expect } from "vitest";
import { newBattle, reg } from "./helpers.js";
import { Rng } from "../src/rng.js";
import { rollWeather, rollTimeOfDay, applyWeatherTerrain, effectiveRange, weatherRangedAtkMod } from "../src/weather.js";
import { computeStat } from "../src/modifiers.js";
import { buildStarterDeck } from "../src/cards.js";
import { setUpMatch } from "../src/match.js";

const RANGED = "SAM_SECOND_WHITE-CRANE-RETAINER"; // range 2, no minRange
const MELEE = "SAM_FOOT_EMBERLINE-ASHIGARU"; // range 1

describe("weather and time of day (round modifiers)", () => {
  it("rolls deterministically for a seed and varies across seeds", () => {
    const roll = (seed: number) => { const rng = new Rng(seed); return [rollWeather(rng, reg.weather), rollTimeOfDay(rng, reg.weather)]; };
    expect(roll(1)).toEqual(roll(1));
    const seeds = Array.from({ length: 20 }, (_, i) => roll(i).join(","));
    expect(new Set(seeds).size).toBeGreaterThan(1); // not every seed lands on the same condition
    for (let seed = 0; seed < 20; seed++) {
      const [w, t] = roll(seed);
      expect(["Clear", "Rain", "Fog"]).toContain(w);
      expect(["Day", "Night"]).toContain(t);
    }
  });

  it("Rain floods Open ground beside Water and Ford, Clear and Fog leave terrain alone", () => {
    const { b } = newBattle();
    b.terrain.set("5,5", "Water");
    b.terrain.set("10,10", "Ford");
    b.weather = "Clear";
    expect(applyWeatherTerrain(b)).toBe(0);
    b.weather = "Fog";
    expect(applyWeatherTerrain(b)).toBe(0);
    b.weather = "Rain";
    const changed = applyWeatherTerrain(b);
    expect(changed).toBeGreaterThan(0);
    expect(b.terrainAt({ q: 6, r: 5 })).toBe("Mud"); // adjacent to the Water hex
    expect(b.terrainAt({ q: 5, r: 5 })).toBe("Water"); // the water hex itself is untouched
    expect(b.events.some((e) => e.type === "WeatherApplied" && (e.data as any).weather === "Rain")).toBe(true);
  });

  it("Rain never overwrites terrain that is already something other than Open", () => {
    const { b } = newBattle();
    b.terrain.set("5,5", "Water");
    b.terrain.set("6,5", "Fortification"); // adjacent to the water hex, but not Open
    b.weather = "Rain";
    applyWeatherTerrain(b);
    expect(b.terrainAt({ q: 6, r: 5 })).toBe("Fortification");
  });

  it("Fog cuts a ranged unit's range by one (never below one); melee reach is unaffected", () => {
    const { b } = newBattle();
    const archer = b.spawn(RANGED, "A", { q: 5, r: 5 });
    const foot = b.spawn(MELEE, "A", { q: 5, r: 6 });
    b.weather = "Clear";
    expect(effectiveRange(b, archer)).toBe(2);
    expect(effectiveRange(b, foot)).toBe(1);
    b.weather = "Fog";
    expect(effectiveRange(b, archer)).toBe(1);
    expect(effectiveRange(b, foot)).toBe(1);
  });

  it("an attack beyond fogged range is rejected even though it would be legal in clear weather", () => {
    const { b, ctrl } = newBattle();
    const archer = b.spawn(RANGED, "A", { q: 5, r: 5 });
    const target = b.spawn(MELEE, "B", { q: 5, r: 7 }); // distance 2
    archer.ap = 2;
    b.weather = "Fog";
    expect(() => ctrl.attack(archer, target)).toThrow(/[Oo]ut of range/);
    archer.ap = 2; archer.attackedThisActivation = false;
    b.weather = "Clear";
    expect(() => ctrl.attack(archer, target)).not.toThrow();
  });

  it("Night applies a named, source-tracked ranged ATK penalty; Day does not", () => {
    const { b } = newBattle();
    const archer = b.spawn(RANGED, "A", { q: 5, r: 5 });
    const target = b.spawn(MELEE, "B", { q: 5, r: 7 });
    b.timeOfDay = "Day";
    const day = computeStat(b, archer, "ATK", { attacker: archer, defender: target, ranged: true });
    expect(day.modifiers.some((m) => m.source.startsWith("Time of Day"))).toBe(false);
    b.timeOfDay = "Night";
    const night = computeStat(b, archer, "ATK", { attacker: archer, defender: target, ranged: true });
    const mod = night.modifiers.find((m) => m.source === "Time of Day: Night");
    expect(mod?.value).toBe(weatherRangedAtkMod(b));
    expect(night.final).toBe(day.final + mod!.value);
  });

  it("setUpMatch rolls weather and time of day from the seed, and a spec override forces one", () => {
    const deck = buildStarterDeck(reg, "SAM"), other = buildStarterDeck(reg, "SHI");
    const a = setUpMatch({ reg, seed: 77, A: { deck, name: "a" }, B: { deck: other, name: "b" } });
    const b2 = setUpMatch({ reg, seed: 77, A: { deck, name: "a" }, B: { deck: other, name: "b" } });
    expect(a.ctrl.b.weather).toBe(b2.ctrl.b.weather);
    expect(a.ctrl.b.timeOfDay).toBe(b2.ctrl.b.timeOfDay);
    const forced = setUpMatch({ reg, seed: 77, weather: "Rain", timeOfDay: "Night", A: { deck, name: "a" }, B: { deck: other, name: "b" } });
    expect(forced.ctrl.b.weather).toBe("Rain");
    expect(forced.ctrl.b.timeOfDay).toBe("Night");
  });
});

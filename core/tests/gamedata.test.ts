import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRegistry, Registry } from "../src/data.js";
// @ts-expect-error -- a build script, deliberately plain JS with no type surface of its own.
import { readGameData } from "../../scripts/gamedata-plugin.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * The browser bundles cannot call `loadRegistry` — it reads `data/` through `node:fs` — so
 * `scripts/gamedata-plugin.mjs` reads the same files at build time and the page builds its registry
 * from that. Two readers of one data set drift, and this one drifted badly and silently: the three
 * boot modules that used to hand-list the files named two rank ladders when five existed on disk,
 * skipped `units/expansion.json` and `abilities/expansion.json`, and passed no weather rules at all.
 * Nothing failed at build time. The published page threw on its first Knight commander
 * (`references unknown rank BARON`), so `window.CARDS` never initialised and every screen that leans
 * on it — the field included — went down with it, leaving the static panels around an empty board.
 *
 * Nothing catches that but a test holding the two readers against each other.
 */
type GameData = Record<string, never>;

/** Build the registry the same way `web/sample/registry-boot.mts` does in the page. */
function bundledRegistry(d: GameData): Registry {
  const f = (k: string) => (d as Record<string, unknown>)[k] as never;
  return new Registry(
    f("units"), f("abilities"), f("factions"), f("platoon"),
    f("ranks"), f("fusions"), f("deckRules"), f("sideCards"),
    f("buildings"), f("research"), f("banners"), f("wanted"),
    f("marchRules"), f("weather"),
  );
}

describe("the browser bundle's game data matches loadRegistry", () => {
  const bundled = readGameData(ROOT) as GameData;
  const disk = loadRegistry();

  it("builds a Registry that validates, exactly as the page does at load", () => {
    expect(bundledRegistry(bundled).units.size).toBeGreaterThan(0);
  });

  it("carries every unit, ability and faction the disk loader carries", () => {
    const reg = bundledRegistry(bundled);
    expect([...reg.units.keys()].sort()).toEqual([...disk.units.keys()].sort());
    expect([...reg.abilities.keys()].sort()).toEqual([...disk.abilities.keys()].sort());
    expect([...reg.factions.keys()].sort()).toEqual([...disk.factions.keys()].sort());
  });

  it("carries every rank ladder on disk, so no faction's ranks go missing from the page", () => {
    expect([...bundledRegistry(bundled).ranks.keys()].sort()).toEqual([...disk.ranks.keys()].sort());
  });

  it("carries the weather rules, which the hand-listed boots left off entirely", () => {
    expect(bundledRegistry(bundled).weather).toEqual(disk.weather);
  });
});

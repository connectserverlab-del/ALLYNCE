import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { reg } from "./helpers.js";
import { opaqueShare } from "./png-alpha.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// A figure drawn to fill its frame covers roughly a third to two thirds of it, same band
// `scripts/audit-cutouts.py` gates on. Outside it, the cutout kept its background or lost the
// figure along with it — a card-art regression from Checklist item Q-1.
const FLOOR = 0.12;
const CEILING = 0.95;

describe("unit card art", () => {
  it("every unit has a concept and a cutout on disk", () => {
    const missing: string[] = [];
    for (const u of reg.units.values()) {
      if (!u.art?.concept || !existsSync(resolve(ROOT, u.art.concept))) missing.push(`${u.id} (concept)`);
      if (!u.art?.cutout || !existsSync(resolve(ROOT, u.art.cutout))) missing.push(`${u.id} (cutout)`);
    }
    expect(missing).toEqual([]);
  });

  it("every cutout actually lifted its figure off the ground", () => {
    const bad: string[] = [];
    for (const u of reg.units.values()) {
      const cutout = u.art?.cutout;
      if (!cutout || !existsSync(resolve(ROOT, cutout))) continue; // caught by the presence test above
      const share = opaqueShare(readFileSync(resolve(ROOT, cutout)));
      if (share >= CEILING) bad.push(`${u.id}: kept its background (${share.toFixed(3)} opaque)`);
      else if (share <= FLOOR) bad.push(`${u.id}: lost the figure (${share.toFixed(3)} opaque)`);
    }
    expect(bad).toEqual([]);
  });
});

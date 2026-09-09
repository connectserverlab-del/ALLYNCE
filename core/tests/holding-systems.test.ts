import { describe, it, expect } from "vitest";
import { reg, fill } from "./helpers.js";
import {
  newKingdom, tick, startUpgrade, moveBuilding, swapBuildings, layoutSize, defaultLayout,
  unmetRequirements, canUpgrade, tenStarBonus, storageCap, drawFromBanner,
  BUILDING_IDS, RESOURCE_IDS, NO_RESOURCES, normalizeKingdom,
} from "../src/kingdom.js";
import { saveGame, loadGame } from "../src/save.js";
import { power, buildingPower, cardPower } from "../src/power.js";
import { buyBorder, mergeDuplicate, canMerge, cosmeticOf, borders, MAX_SHINE } from "../src/cosmetics.js";

const tenStar = () => [...reg.units.values()].filter((u) => u.stars === 10).map((u) => u.id);

describe("currencies", () => {
  it("carries gold and ruby alongside the four common resources, and starts the player with some", () => {
    const k = newKingdom(reg, "SAM");
    expect(RESOURCE_IDS).toContain("gold");
    expect(RESOURCE_IDS).toContain("ruby");
    for (const r of RESOURCE_IDS) expect(typeof k.resources[r]).toBe("number");
    expect(k.resources.gold).toBeGreaterThan(0);
    expect(k.resources.ruby).toBeGreaterThan(0);
    expect(Object.keys(NO_RESOURCES).sort()).toEqual([...RESOURCE_IDS].sort());
  });

  it("does not cap gold against the City Hall's storage the way it caps grain", () => {
    const k = newKingdom(reg, "SAM");
    k.levels.SHOP = 5; k.levels.GRANARY = 5;
    const cap = storageCap(reg, k);
    k.resources.gold = cap + 5000;
    k.resources.koku = cap;
    tick(reg, k, 3600 * 4);
    expect(k.resources.gold).toBeGreaterThan(cap + 5000);   // coin keeps piling up
    expect(k.resources.koku).toBeLessThanOrEqual(cap);      // grain does not
  });

  it("prices the summoning banners in silver, gold and ruby, and refuses a draw the player cannot pay for", () => {
    const k = newKingdom(reg, "SAM");
    k.levels.RECRUITMENT_HALL = 1;          // the bell has to exist before it can be rung
    k.resources = { ...NO_RESOURCES };
    const denied = drawFromBanner(reg, k, "BANNER_OATHFIRE", 1);
    expect(denied.ok).toBe(false);
    expect(denied.reason).toMatch(/enough|afford|cost/i);   // refused for money, not for the hall
    k.resources = fill(100000);
    const paid = drawFromBanner(reg, k, "BANNER_OATHFIRE", 1);
    expect(paid.ok).toBe(true);
    expect(k.resources.gold).toBeLessThan(100000);
    expect(k.resources.ruby).toBeLessThan(100000);
  });
});

describe("the ten-star production buff", () => {
  it("adds 20% to grain, ore and timber for each distinct ten-star unit owned", () => {
    const ten = tenStar();
    expect(ten.length).toBeGreaterThanOrEqual(2);

    // The City Hall is raised so the granary's output stays well under the storage cap. Left at
    // level one, both runs clamp to the same 4000 and the comparison passes while proving nothing.
    const hold = () => { const k = newKingdom(reg, "SAM"); k.levels.KEEP = 10; k.levels.GRANARY = 5; return k; };

    const plain = hold();
    const before = tick(reg, plain, 3600 * 10).produced.koku ?? 0;
    expect(before).toBeGreaterThan(0);
    expect(plain.resources.koku).toBeLessThan(storageCap(reg, plain));   // the cap is not what we measured

    const buffed = hold();
    buffed.collection[ten[0]!] = 1;
    const one = tick(reg, buffed, 3600 * 10).produced.koku ?? 0;
    expect(buffed.resources.koku).toBeLessThan(storageCap(reg, buffed));
    expect(one).toBeGreaterThan(before);
    expect(one / before).toBeCloseTo(1.2, 1);

    const twice = hold();
    twice.collection[ten[0]!] = 1; twice.collection[ten[1]!] = 1;
    const two = tick(reg, twice, 3600 * 10).produced.koku ?? 0;
    expect(two / before).toBeCloseTo(1.4, 1);
  });

  it("counts a unit once however many copies are held, so the buff is not a function of luck", () => {
    const ten = tenStar();
    const k = newKingdom(reg, "SAM");
    k.collection[ten[0]!] = 4;
    expect(tenStarBonus(reg, k).units).toEqual([ten[0]]);
    expect(tenStarBonus(reg, k).multiplier).toBeCloseTo(0.2, 5);
    k.collection[ten[1]!] = 1;
    expect(tenStarBonus(reg, k).multiplier).toBeCloseTo(0.4, 5);
  });

  it("leaves resources the buff does not name alone", () => {
    const k = newKingdom(reg, "SAM");
    const bonus = tenStarBonus(reg, k);
    expect(bonus.resources).toContain("koku");
    expect(bonus.resources).not.toContain("gold");
    expect(bonus.resources).not.toContain("ruby");
  });
});

describe("building placement", () => {
  it("founds every building on its own plot, all of them inside the grid", () => {
    const k = newKingdom(reg, "SAM");
    const { cols, rows } = layoutSize(reg);
    const seen = new Set<string>();
    for (const b of BUILDING_IDS) {
      const p = k.layout[b];
      expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThan(cols);
      expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThan(rows);
      const key = `${p.x},${p.y}`;
      expect(seen.has(key), `two buildings share plot ${key}`).toBe(false);
      seen.add(key);
    }
    expect(Object.keys(defaultLayout(reg)).sort()).toEqual([...BUILDING_IDS].sort());
  });

  it("moves a building to a free plot and refuses one that is taken or off the grid", () => {
    const k = newKingdom(reg, "SAM");
    const { cols, rows } = layoutSize(reg);
    const free = (() => {
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++)
        if (!BUILDING_IDS.some((b) => k.layout[b].x === x && k.layout[b].y === y)) return { x, y };
      throw new Error("no free plot");
    })();
    expect(moveBuilding(reg, k, "SHOP", free).ok).toBe(true);
    expect(k.layout.SHOP).toEqual(free);

    const taken = { ...k.layout.KEEP };
    const clash = moveBuilding(reg, k, "SHOP", taken);
    expect(clash.ok).toBe(false);
    expect(clash.reason).toMatch(/already stands there/);
    expect(k.layout.SHOP).toEqual(free);                    // refused, and nothing moved

    expect(moveBuilding(reg, k, "SHOP", { x: cols, y: 0 }).ok).toBe(false);
    expect(moveBuilding(reg, k, "SHOP", { x: 0, y: -1 }).ok).toBe(false);
    expect(moveBuilding(reg, k, "SHOP", { x: 1.5, y: 0 }).ok).toBe(false);
  });

  it("swaps two buildings, because dragging one onto another reads as a swap", () => {
    const k = newKingdom(reg, "SAM");
    const a = { ...k.layout.SHOP }, b = { ...k.layout.FORGE };
    expect(swapBuildings(k, "SHOP", "FORGE").ok).toBe(true);
    expect(k.layout.SHOP).toEqual(b);
    expect(k.layout.FORGE).toEqual(a);
    expect(swapBuildings(k, "SHOP", "SHOP").ok).toBe(false);
  });

  it("moving a building changes nothing about what it produces or costs", () => {
    const k = newKingdom(reg, "SAM");
    k.levels.GRANARY = 4;
    const still = newKingdom(reg, "SAM");
    still.levels.GRANARY = 4;
    const free = { x: layoutSize(reg).cols - 1, y: layoutSize(reg).rows - 1 };
    moveBuilding(reg, k, "GRANARY", free);
    expect(tick(reg, k, 3600).produced).toEqual(tick(reg, still, 3600).produced);
    expect(power(reg, k).total).toBe(power(reg, still).total);
  });
});

describe("building level requirements", () => {
  it("names the prerequisite a building has not met, and refuses the upgrade until it is", () => {
    const k = newKingdom(reg, "SAM");
    k.resources = fill(1e9);
    k.levels.KEEP = 10;

    expect(unmetRequirements(reg, k, "FORGE")).toEqual([{ building: "MINE", level: 2 }]);
    expect(canUpgrade(reg, k, "FORGE")).toBe(false);
    const denied = startUpgrade(reg, k, "FORGE");
    expect(denied.ok).toBe(false);
    expect(denied.reason).toMatch(/Iron Mine level 2/);

    k.levels.MINE = 2;
    expect(unmetRequirements(reg, k, "FORGE")).toEqual([]);
    expect(canUpgrade(reg, k, "FORGE")).toBe(true);
    expect(startUpgrade(reg, k, "FORGE").ok).toBe(true);
  });

  it("charges nothing when it refuses", () => {
    const k = newKingdom(reg, "SAM");
    k.resources = fill(1e9);
    k.levels.KEEP = 10;
    const before = { ...k.resources };
    expect(startUpgrade(reg, k, "ARMORY").ok).toBe(false);
    expect(k.resources).toEqual(before);
    expect(k.buildQueue).toHaveLength(0);
  });

  it("still gates everything behind the City Hall's own level", () => {
    const k = newKingdom(reg, "SAM");
    k.resources = fill(1e9);
    expect(startUpgrade(reg, k, "GRANARY").ok).toBe(true);   // 0 -> 1 is allowed under a level-1 seat
    const raised = newKingdom(reg, "SAM");
    raised.resources = fill(1e9);
    raised.levels.GRANARY = 1;                               // already built; level 2 needs a bigger seat
    const denied = startUpgrade(reg, raised, "GRANARY");
    expect(denied.ok).toBe(false);
    expect(denied.reason).toMatch(/City Hall/);
  });
});

describe("the buildings the hold needs", () => {
  it("has a City Hall, armory, recruiting hall, shop, mine, farm and logging camp", () => {
    for (const id of ["KEEP", "ARMORY", "RECRUITMENT_HALL", "SHOP", "MINE", "GRANARY", "SAWPIT"] as const) {
      expect(BUILDING_IDS).toContain(id);
      expect(reg.kingdom.buildings[id]).toBeTruthy();
    }
    expect(reg.kingdom.buildings.KEEP.name).toBe("City Hall");
  });

  it("gives the shop gold to produce, which nothing else produces", () => {
    const producers = BUILDING_IDS.filter((b) => reg.kingdom.buildings[b].produces?.gold);
    expect(producers).toEqual(["SHOP"]);
    const k = newKingdom(reg, "SAM");
    k.levels.SHOP = 3;
    expect((tick(reg, k, 3600 * 5).produced.gold ?? 0)).toBeGreaterThan(0);
  });

  it("produces no ruby from any building at all", () => {
    expect(BUILDING_IDS.filter((b) => reg.kingdom.buildings[b].produces?.ruby)).toEqual([]);
    const k = newKingdom(reg, "SAM");
    for (const b of BUILDING_IDS) k.levels[b] = 10;
    const before = k.resources.ruby;
    tick(reg, k, 3600 * 24);
    expect(k.resources.ruby).toBe(before);
  });
});

describe("power", () => {
  it("is zero for nothing, and rises with every building level, research and card", () => {
    const k = newKingdom(reg, "SAM");
    k.levels.KEEP = 0;
    expect(power(reg, k).total).toBe(0);

    k.levels.KEEP = 1;
    const seat = power(reg, k).total;
    expect(seat).toBeGreaterThan(0);

    k.levels.GRANARY = 3;
    const built = power(reg, k).total;
    expect(built).toBeGreaterThan(seat);

    k.research.done.push("R_ANY");
    const studied = power(reg, k).total;
    expect(studied).toBeGreaterThan(built);

    const anyUnit = [...reg.units.values()][0]!;
    k.collection[anyUnit.id] = 1;
    expect(power(reg, k).total).toBeGreaterThan(studied);
  });

  it("is deterministic: the same holding gives the same number every time", () => {
    const k = newKingdom(reg, "SAM");
    k.levels.KEEP = 6; k.levels.FORGE = 4;
    k.collection[[...reg.units.values()][0]!.id] = 3;
    const a = power(reg, k);
    const b = power(reg, k);
    expect(a).toEqual(b);
  });

  it("does not move when a building is merely rearranged, or when the clock runs", () => {
    const k = newKingdom(reg, "SAM");
    k.levels.KEEP = 4;
    const before = power(reg, k).total;
    moveBuilding(reg, k, "KEEP", { x: layoutSize(reg).cols - 1, y: layoutSize(reg).rows - 1 });
    tick(reg, k, 3600 * 8);
    expect(power(reg, k).total).toBe(before);
  });

  it("values a rarer card above a common one, and a duplicate below a first copy", () => {
    expect(cardPower(reg, 10, 1)).toBeGreaterThan(cardPower(reg, 1, 1));
    const first = cardPower(reg, 5, 1);
    const second = cardPower(reg, 5, 2) - first;
    expect(second).toBeGreaterThan(0);
    expect(second).toBeLessThan(first);
  });

  it("weights the City Hall above an ordinary building at the same level", () => {
    expect(buildingPower(reg, "KEEP", 5)).toBeGreaterThan(buildingPower(reg, "GRANARY", 5));
  });

  it("breaks down into lines that add up to the total", () => {
    const k = newKingdom(reg, "SAM");
    k.levels.KEEP = 5; k.levels.SHOP = 2;
    k.research.done.push("R_A", "R_B");
    k.collection[[...reg.units.values()][0]!.id] = 2;
    const p = power(reg, k);
    expect(p.lines.reduce((n, l) => n + l.value, 0)).toBe(p.total);
    expect(p.lines[0]!.value).toBeGreaterThanOrEqual(p.lines[p.lines.length - 1]!.value);
  });
});

describe("card borders and shine", () => {
  const someCard = () => [...reg.units.values()][0]!.id;

  it("offers a gold border and a rainbow border, and both cost real money", () => {
    const list = borders(reg);
    expect(list.map((b) => b.id)).toEqual(["gold", "rainbow"]);
    for (const b of list) expect(Object.values(b.cost).some((v) => (v ?? 0) > 0)).toBe(true);
    expect(list.find((b) => b.id === "rainbow")!.requires).toBe("gold");
  });

  it("is expensive: a rainbow border costs more than a fresh holding could ever hold", () => {
    const fresh = newKingdom(reg, "SAM");
    const rainbow = borders(reg).find((b) => b.id === "rainbow")!;
    expect(rainbow.cost.gold!).toBeGreaterThan(fresh.resources.gold * 50);
    expect(rainbow.cost.ruby!).toBeGreaterThan(fresh.resources.ruby);
  });

  it("buys a border, charges for it, and refuses a card the player does not own", () => {
    const k = newKingdom(reg, "SAM");
    k.resources = fill(1e6);
    const id = someCard();

    const unowned = buyBorder(reg, k, id, "gold");
    expect(unowned.ok).toBe(false);
    expect(unowned.reason).toMatch(/do not own/);

    k.collection[id] = 1;
    const gold = borders(reg).find((b) => b.id === "gold")!;
    const before = k.resources.gold;
    expect(buyBorder(reg, k, id, "gold").ok).toBe(true);
    expect(cosmeticOf(k, id).border).toBe("gold");
    expect(k.resources.gold).toBe(before - gold.cost.gold!);
  });

  it("sells the rainbow border only to a card that already has the gold one", () => {
    const k = newKingdom(reg, "SAM");
    k.resources = fill(1e6);
    const id = someCard();
    k.collection[id] = 1;

    const early = buyBorder(reg, k, id, "rainbow");
    expect(early.ok).toBe(false);
    expect(early.reason).toMatch(/Gold Leaf/);

    expect(buyBorder(reg, k, id, "gold").ok).toBe(true);
    expect(buyBorder(reg, k, id, "rainbow").ok).toBe(true);
    expect(cosmeticOf(k, id).border).toBe("rainbow");
  });

  it("charges nothing when it refuses", () => {
    const k = newKingdom(reg, "SAM");
    k.resources = { ...NO_RESOURCES };
    const id = someCard();
    k.collection[id] = 1;
    expect(buyBorder(reg, k, id, "gold").ok).toBe(false);
    expect(cosmeticOf(k, id).border).toBeUndefined();
    expect(k.resources).toEqual(NO_RESOURCES);
  });

  it("merges two copies into a shine, consuming the duplicate", () => {
    const k = newKingdom(reg, "SAM");
    const id = someCard();
    k.collection[id] = 1;
    expect(canMerge(reg, k, id).ok).toBe(false);       // one copy is the card you play

    k.collection[id] = 2;
    expect(mergeDuplicate(reg, k, id).ok).toBe(true);
    expect(k.collection[id]).toBe(1);                  // the duplicate is spent
    expect(cosmeticOf(k, id).shine).toBe(1);
  });

  it("cannot buy a shine: it costs copies and nothing else", () => {
    const k = newKingdom(reg, "SAM");
    k.resources = fill(1e9);
    const id = someCard();
    k.collection[id] = 1;
    const denied = mergeDuplicate(reg, k, id);
    expect(denied.ok).toBe(false);
    expect(k.resources).toEqual(fill(1e9));            // money did not help
  });

  it("stops at full shine rather than eating copies forever", () => {
    const k = newKingdom(reg, "SAM");
    const id = someCard();
    k.collection[id] = 20;
    for (let i = 0; i < MAX_SHINE; i++) expect(mergeDuplicate(reg, k, id).ok).toBe(true);
    expect(cosmeticOf(k, id).shine).toBe(MAX_SHINE);
    const over = mergeDuplicate(reg, k, id);
    expect(over.ok).toBe(false);
    expect(k.collection[id]).toBe(20 - MAX_SHINE);     // the refused merge ate nothing
  });

  it("is display only: neither a border nor a shine changes power", () => {
    const k = newKingdom(reg, "SAM");
    k.resources = fill(1e6);
    const id = someCard();
    k.collection[id] = 3;
    const before = power(reg, k).total;
    buyBorder(reg, k, id, "gold");
    expect(power(reg, k).total).toBe(before);
    // A merge does move power, but only because it spent a copy — not because of the shine.
    mergeDuplicate(reg, k, id);
    expect(power(reg, k).total).toBe(before - (cardPower(reg, reg.unit(id).stars ?? 1, 3) - cardPower(reg, reg.unit(id).stars ?? 1, 2)));
  });
});

describe("holdings written by an older build", () => {
  it("comes back with the fields that did not exist then, rather than a crash or a NaN", () => {
    const k = newKingdom(reg, "SAM");
    // Exactly what a pre-currency, pre-layout holding looks like on disk.
    delete (k as unknown as Record<string, unknown>).layout;
    delete (k as unknown as Record<string, unknown>).cosmetics;
    delete (k.resources as unknown as Record<string, unknown>).gold;
    delete (k.resources as unknown as Record<string, unknown>).ruby;

    const fixed = normalizeKingdom(reg, JSON.parse(JSON.stringify(k)));
    expect(typeof fixed.resources.gold).toBe("number");
    expect(typeof fixed.resources.ruby).toBe("number");
    expect(Object.keys(fixed.layout).sort()).toEqual([...BUILDING_IDS].sort());
    expect(fixed.cosmetics).toEqual({});

    // and the things that would have thrown or gone NaN now work
    expect(moveBuilding(reg, fixed, "SHOP", { x: 0, y: 0 }).ok || true).toBe(true);
    tick(reg, fixed, 3600);
    for (const r of RESOURCE_IDS) expect(Number.isFinite(fixed.resources[r])).toBe(true);
  });

  it("is idempotent on a current holding", () => {
    const k = newKingdom(reg, "SAM");
    const once = JSON.stringify(normalizeKingdom(reg, k));
    expect(JSON.stringify(normalizeKingdom(reg, k))).toBe(once);
  });

  it("carries the new fields through a save and back", () => {
    const k = newKingdom(reg, "SAM");
    k.collection.X = 0;
    // A free plot, found rather than written down: this test is about a save round trip, and a
    // hard-coded coordinate tied it to whatever the grid happened to be. Shrinking the grid first
    // put the plot out of bounds and then landed it on the Shrine, and both times the move was
    // refused and the assertion below silently compared a building that had never moved.
    const { cols, rows } = layoutSize(reg);
    const corner = (() => {
      for (let y = rows - 1; y >= 0; y--) for (let x = cols - 1; x >= 0; x--)
        if (!BUILDING_IDS.some((b) => k.layout[b].x === x && k.layout[b].y === y)) return { x, y };
      throw new Error("no free plot");
    })();
    const moved = moveBuilding(reg, k, "SHOP", corner);
    expect(moved.ok, moved.reason).toBe(true);
    k.resources = fill(1e6);
    const id = [...reg.units.values()][0]!.id;
    k.collection[id] = 2;
    buyBorder(reg, k, id, "gold");
    mergeDuplicate(reg, k, id);

    const back = loadGame(reg, saveGame(null, k)).kingdom!;
    expect(back.layout.SHOP).toEqual(corner);
    expect(back.cosmetics![id]).toEqual({ border: "gold", shine: 1 });
    expect(back.resources.gold).toBe(k.resources.gold);
    expect(back.resources.ruby).toBe(k.resources.ruby);
    expect(power(reg, back)).toEqual(power(reg, k));
  });
});

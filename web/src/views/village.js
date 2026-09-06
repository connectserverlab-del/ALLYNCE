/**
 * Village: the out-of-battle economy.
 *
 * Every building is a real button with a real action — recruiting, collecting, trading,
 * drilling duplicates — and every action writes to the same save the deck reads from.
 */
import { crest, esc, unitRow } from "../cards.js";
import * as save from "../save.js";

const HOUR = 3600_000;

/** Building registry. `act` returns a message; returning null means nothing happened. */
export const BUILDINGS = {
  hall: {
    name: "Muster Hall", x: 50, y: 34, requires: null, max: 5,
    blurb: "The roll of every unit sworn to you. Its level gates every other building.",
    cost: (lvl) => ({ steel: 220 * lvl, grain: 160 * lvl }),
    effect: (lvl) => `Village level ${lvl}. Unlocks buildings up to level ${lvl}.`,
  },
  barracks: {
    name: "Barracks", x: 22, y: 52, requires: ["hall", 1], max: 6,
    blurb: "Trains foot soldiers, guardians and skirmishers. Higher levels reach deeper into the star bands.",
    cost: (lvl) => ({ steel: 180 * lvl, grain: 120 * lvl }),
    effect: (lvl) => `Recruits up to ${1 + lvl}★ line units for ${recruitCost(lvl).steel} steel.`,
    action: { label: "Recruit line unit", run: (ctx) => recruit(ctx, (u) => ["FootSoldier"].some((s) => u.slots.includes(s))) },
  },
  yard: {
    name: "Training Yard", x: 33, y: 74, requires: ["barracks", 2], max: 5,
    blurb: "Drills duplicates into something better. Three copies of one unit become one stronger unit of the same faction.",
    cost: (lvl) => ({ steel: 240 * lvl, grain: 200 * lvl }),
    effect: (lvl) => `Drill promotes into the ${Math.min(10, 3 + lvl)}★ band.`,
    action: { label: "Drill duplicates", run: drill },
  },
  forge: {
    name: "Forge", x: 74, y: 50, requires: ["hall", 1], max: 6,
    blurb: "Steel for recruitment and upgrades. Output accrues in real time and is collected here.",
    cost: (lvl) => ({ steel: 200 * lvl, grain: 90 * lvl }),
    effect: (lvl) => `Produces ${40 * lvl} steel per hour, capped at ${40 * lvl * 8}.`,
    action: { label: "Collect steel", run: (ctx) => collect(ctx, "steel", 40) },
  },
  granary: {
    name: "Granary", x: 66, y: 74, requires: ["hall", 1], max: 6,
    blurb: "Grain feeds the muster. Every recruitment costs it, so this is the quiet constraint on army size.",
    cost: (lvl) => ({ steel: 120 * lvl, grain: 180 * lvl }),
    effect: (lvl) => `Produces ${35 * lvl} grain per hour, capped at ${35 * lvl * 8}.`,
    action: { label: "Collect grain", run: (ctx) => collect(ctx, "grain", 35) },
  },
  aviary: {
    name: "Wing Aviary", x: 84, y: 30, requires: ["hall", 2], max: 5,
    blurb: "Cliff roosts and choir perches. Recruits everything that flies — drakes, wing-riders and the lower angelic choirs.",
    cost: (lvl) => ({ steel: 300 * lvl, grain: 220 * lvl, relics: lvl > 2 ? 1 : 0 }),
    effect: (lvl) => `Recruits flying units up to ${2 + lvl}★.`,
    action: { label: "Recruit flier", run: (ctx) => recruit(ctx, (u) => !!u.flying) },
  },
  shrine: {
    name: "Cloister Shrine", x: 16, y: 30, requires: ["hall", 2], max: 5,
    blurb: "Monastic orders, ritualists and support specialists muster here. Named holders will not come twice.",
    cost: (lvl) => ({ steel: 210 * lvl, grain: 260 * lvl }),
    effect: (lvl) => `Recruits specialists up to ${2 + lvl}★.`,
    action: { label: "Recruit specialist", run: (ctx) => recruit(ctx, (u) => u.slots.includes("Specialist")) },
  },
  market: {
    name: "Market", x: 50, y: 60, requires: ["hall", 1], max: 4,
    blurb: "Trades steel for grain and back. The rate improves as the market grows.",
    cost: (lvl) => ({ steel: 140 * lvl, grain: 140 * lvl }),
    effect: (lvl) => `Trades 100 at a rate of ${(0.6 + lvl * 0.1).toFixed(1)}:1.`,
    action: { label: "Trade 100 steel → grain", run: (ctx) => trade(ctx, "steel", "grain") },
    action2: { label: "Trade 100 grain → steel", run: (ctx) => trade(ctx, "grain", "steel") },
  },
  reliquary: {
    name: "Reliquary", x: 50, y: 14, requires: ["hall", 4], max: 3,
    blurb: "Where an Ascendant is invoked rather than hired. One relic, one invocation, and only one Ascendant may ever take the field at a time.",
    cost: (lvl) => ({ steel: 900 * lvl, grain: 700 * lvl, relics: lvl }),
    effect: (lvl) => `Invocation calls a ${7 + lvl}★ unit for ${2 + lvl} relics.`,
    action: { label: "Invoke", run: invoke },
  },
  scriptorium: {
    name: "Scriptorium", x: 86, y: 62, requires: ["hall", 2], max: 3,
    blurb: "Keeps the field manual. Reading it is free; the order does not pretend that is generous.",
    cost: (lvl) => ({ steel: 160 * lvl, grain: 160 * lvl }),
    effect: () => "Opens the Guide.",
    action: { label: "Open the field manual", run: (ctx) => { ctx.go("guide"); return null; } },
  },
};

const recruitCost = (lvl) => ({ steel: 90 + lvl * 40, grain: 70 + lvl * 30 });

/* ------------------------------------------------------------------ actions */
function pool(data, test, maxStars) {
  return data.units.filter((u) =>
    test(u) && !u.summonOnly && u.stars <= maxStars && u.faction !== "DIV" && u.stars < 10);
}

function recruit(ctx, test) {
  const lvl = level(ctx.building);
  const cost = recruitCost(lvl);
  if (!save.canAfford(cost)) return { bad: `Not enough resources: ${describe(cost)}.` };
  const cap = ctx.building === "barracks" ? 1 + lvl : 2 + lvl;
  const options = pool(ctx.data, test, cap).filter((u) => {
    const limit = u.uniqueLimit;
    return limit === undefined || save.owned(u.id) < limit;
  });
  if (!options.length) return { bad: "Nothing left to recruit here at this level." };
  // Weighted toward the top of the band so upgrading the building visibly matters.
  const weighted = options.flatMap((u) => Array(Math.max(1, u.stars)).fill(u));
  const pick = weighted[Math.floor(Math.random() * weighted.length)];
  save.spend(cost);
  save.addUnit(pick.id, 1);
  return { ok: `Recruited ${pick.name} (${pick.stars}★).`, unit: pick.id };
}

function invoke(ctx) {
  const lvl = level("reliquary");
  const cost = { relics: 2 + lvl, steel: 400, grain: 300 };
  if (!save.canAfford(cost)) return { bad: `Invocation needs ${describe(cost)}.` };
  const band = 7 + lvl;
  const options = ctx.data.units.filter((u) => u.stars >= Math.min(9, band) && u.stars <= 10
    && !u.summonOnly && u.faction !== "DIV"
    && (u.uniqueLimit === undefined || save.owned(u.id) < u.uniqueLimit));
  if (!options.length) return { bad: "Every invocation available at this level has already answered." };
  const pick = options[Math.floor(Math.random() * options.length)];
  save.spend(cost);
  save.addUnit(pick.id, 1);
  return { ok: `${pick.name} answers the invocation (${pick.stars}★).`, unit: pick.id };
}

function drill(ctx) {
  const s = save.load();
  const trio = Object.entries(s.inventory).find(([id, n]) => n >= 3 && ctx.data.unit(id));
  if (!trio) return { bad: "Drilling needs three copies of one unit. You have none in triplicate." };
  const [id] = trio;
  const from = ctx.data.unit(id);
  const band = Math.min(10, 3 + level("yard"));
  const options = ctx.data.units.filter((u) =>
    u.faction === from.faction && u.stars > from.stars && u.stars <= band && u.stars < 10
    && (u.uniqueLimit === undefined || save.owned(u.id) < u.uniqueLimit));
  if (!options.length) return { bad: `Nothing in the ${from.className} list outranks ${from.name} within this yard's band.` };
  const pick = options.sort((a, b) => a.stars - b.stars)[0];
  save.update((st) => { st.inventory[id] -= 3; if (st.inventory[id] <= 0) delete st.inventory[id]; });
  save.addUnit(pick.id, 1);
  return { ok: `Three ${from.name} drilled into ${pick.name} (${pick.stars}★).`, unit: pick.id };
}

function collect(ctx, resource, perLevelPerHour) {
  const lvl = level(ctx.building);
  const s = save.load();
  const key = `${ctx.building}:collected`;
  const last = s.village[key] ?? Date.now() - HOUR;
  const hours = Math.min(8, (Date.now() - last) / HOUR);
  const amount = Math.floor(hours * perLevelPerHour * lvl);
  if (amount < 1) return { bad: "Nothing has accrued yet. Come back in a few minutes." };
  save.grant({ [resource]: amount });
  save.update((st) => { st.village[key] = Date.now(); });
  return { ok: `Collected ${amount} ${resource}.` };
}

function trade(ctx, from, to) {
  const rate = 0.6 + level("market") * 0.1;
  if (!save.canAfford({ [from]: 100 })) return { bad: `You need 100 ${from}.` };
  const got = Math.floor(100 * rate);
  save.spend({ [from]: 100 });
  save.grant({ [to]: got });
  return { ok: `Traded 100 ${from} for ${got} ${to}.` };
}

/* -------------------------------------------------------------- state utils */
export const level = (id) => save.load().village[id] ?? (id === "hall" ? 1 : 0);
const unlocked = (id) => {
  const b = BUILDINGS[id];
  if (!b.requires) return true;
  const [dep, need] = b.requires;
  return level(dep) >= need;
};
const describe = (cost) => Object.entries(cost).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(", ");

function upgrade(id, data) {
  const b = BUILDINGS[id];
  const lvl = level(id);
  if (lvl >= b.max) return { bad: `${b.name} is already at its maximum level.` };
  if (!unlocked(id)) return { bad: `${b.name} needs ${BUILDINGS[b.requires[0]].name} at level ${b.requires[1]}.` };
  const cost = b.cost(lvl + 1);
  if (!save.canAfford(cost)) return { bad: `Upgrade costs ${describe(cost)}.` };
  save.spend(cost);
  save.update((s) => { s.village[id] = lvl + 1; });
  return { ok: `${b.name} raised to level ${lvl + 1}.` };
}

/* --------------------------------------------------------------------- view */
export function villageView(root, { data, go, toast }) {
  let selected = "hall";

  root.innerHTML = `
    <div class="view-head">
      <div><h1>Village</h1>
        <p>Recruit, upgrade and trade. Everything you gain here lands in your inventory
           and can be sorted into a deck on the Muster screen.</p></div>
    </div>
    <div class="village">
      <div class="village-ground" id="ground"></div>
      <aside class="panel" id="side"></aside>
    </div>`;

  const ground = root.querySelector("#ground");
  const side = root.querySelector("#side");

  function drawGround() {
    ground.innerHTML = `<svg class="terrain" viewBox="0 0 100 78" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#20262e"/><stop offset="1" stop-color="#12151a"/></linearGradient></defs>
      <rect width="100" height="78" fill="url(#vg)"/>
      <path d="M0 46 Q26 40 50 47 T100 42" fill="none" stroke="#2c3540" stroke-width=".5"/>
      <path d="M0 58 Q30 52 52 60 T100 55" fill="none" stroke="#2c3540" stroke-width=".5"/>
      <path d="M50 20 L50 60 M22 52 L50 44 M74 50 L50 44 M33 74 L50 60 M66 74 L50 60 M84 30 L50 34 M16 30 L50 34 M86 62 L50 60"
        stroke="#242c36" stroke-width=".45" fill="none" stroke-dasharray="1.6 1.6"/>
    </svg>` + Object.entries(BUILDINGS).map(([id, b]) => {
      const lvl = level(id);
      const open = unlocked(id);
      const ready = open && lvl > 0 && save.canAfford(b.cost(lvl + 1)) && lvl < b.max;
      return `<button class="building${open ? "" : " locked"}${ready ? " ready" : ""}"
        style="left:${b.x}%;top:${b.y}%" data-b="${id}" aria-label="${esc(b.name)}">
        <span class="plate">${crest(factionFor(id), 30)}${lvl ? `<span class="lvl">L${lvl}</span>` : ""}</span>
        <span class="label">${esc(b.name)}</span></button>`;
    }).join("");
  }

  function drawSide() {
    const id = selected;
    const b = BUILDINGS[id];
    const lvl = level(id);
    const open = unlocked(id);
    const next = lvl < b.max ? b.cost(lvl + 1) : null;
    const s = save.load();

    side.innerHTML = `
      <div class="panel-head">${crest(factionFor(id), 22)}<h3>${esc(b.name)}</h3>
        <span class="count">${lvl ? `Level ${lvl}/${b.max}` : "Not built"}</span></div>
      <div class="panel-body">
        <p class="muted">${esc(b.blurb)}</p>
        <div class="detail-list">
          <div><span class="k">Status</span><span class="v">${open ? (lvl ? "Operating" : "Ready to build") : "Locked"}</span></div>
          ${lvl ? `<div><span class="k">Effect</span><span class="v">${esc(b.effect(lvl))}</span></div>` : ""}
          ${next ? `<div><span class="k">${lvl ? "Upgrade" : "Build"} cost</span><span class="v">${esc(describe(next))}</span></div>` : ""}
          ${!open ? `<div><span class="k">Requires</span><span class="v">${esc(BUILDINGS[b.requires[0]].name)} L${b.requires[1]}</span></div>` : ""}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          ${next ? `<button class="btn btn-primary" data-do="upgrade" ${open ? "" : "disabled"}>${lvl ? "Upgrade" : "Build"}</button>` : '<span class="tag">Fully upgraded</span>'}
          ${lvl && b.action ? `<button class="btn" data-do="act">${esc(b.action.label)}</button>` : ""}
          ${lvl && b.action2 ? `<button class="btn" data-do="act2">${esc(b.action2.label)}</button>` : ""}
        </div>
      </div>
      <div class="panel-head" style="border-top:1px solid var(--line-soft)"><h3>Village log</h3></div>
      <div class="panel-body"><div class="log">${
        (s.log ?? []).slice(0, 12).map((e) => `<div>${esc(e.text)}</div>`).join("") || '<div class="faint">Nothing yet.</div>'
      }</div></div>`;
  }

  function note(text) {
    save.update((s) => { s.log = [{ t: Date.now(), text }, ...(s.log ?? [])].slice(0, 60); });
  }

  function handle(result) {
    if (!result) return;
    if (result.bad) return toast(result.bad, true);
    toast(result.ok);
    note(result.ok);
    drawGround();
    drawSide();
  }

  ground.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-b]");
    if (!btn) return;
    selected = btn.dataset.b;
    drawSide();
  });

  side.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-do]");
    if (!btn) return;
    const b = BUILDINGS[selected];
    const ctx = { data, go, building: selected };
    if (btn.dataset.do === "upgrade") return handle(upgrade(selected, data));
    if (btn.dataset.do === "act") return handle(b.action.run(ctx));
    if (btn.dataset.do === "act2") return handle(b.action2.run(ctx));
  });

  drawGround();
  drawSide();
}

/** Which crest a building wears — cosmetic, but it keeps the ground readable. */
function factionFor(id) {
  return { hall: "KNI", barracks: "SAM", yard: "MNK", forge: "DRG", granary: "THC",
    aviary: "ANG", shrine: "RIT", market: "FUS", reliquary: "DIV", scriptorium: "STM" }[id] ?? "KNI";
}

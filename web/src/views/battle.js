/**
 * Battle screen. Renders the hex board, drives selection and actions, and plays one
 * short effect per attack or ability before applying the next step of the turn.
 */
import { esc } from "../cards.js";
import * as save from "../save.js";
import { Skirmish, key, distance } from "../engine/skirmish.js";
import * as fx from "../engine/fx.js";
import { CAMPAIGN } from "./map.js";

const SIZE = 30;           // hex radius in board units
const px = (h) => ({ x: SIZE * Math.sqrt(3) * (h.q + h.r / 2) + SIZE * 2, y: SIZE * 1.5 * h.r + SIZE * 1.6 });
const corners = (c) => Array.from({ length: 6 }, (_, i) => {
  const a = Math.PI / 180 * (60 * i - 30);
  return `${(c.x + SIZE * Math.cos(a)).toFixed(1)},${(c.y + SIZE * Math.sin(a)).toFixed(1)}`;
}).join(" ");

export function battleView(root, { data, params, go, toast }) {
  const deck = save.deck();
  if (deck.units.length < 8) {
    root.innerHTML = `<div class="view-head"><div><h1>Battle</h1>
      <p>You need a deck of at least eight units before you can deploy.</p></div></div>
      <div class="empty">Build a muster first.<br><br>
      <button class="btn btn-primary" data-route="muster">Open the Muster screen</button></div>`;
    return;
  }

  const node = CAMPAIGN.find((n) => n.id === params.node) ?? CAMPAIGN[0];
  const game = new Skirmish(data, {
    width: 11, height: 8,
    terrain: terrainFor(node),
    player: deck.units.slice(0, 12),
    enemy: enemyForce(data, node),
    rounds: 12,
  });

  let selected = null;
  let busy = false;
  let pendingAbility = null;

  root.innerHTML = `
    <div class="view-head">
      <div><h1>${esc(node.name)}</h1><p>${esc(node.objective)}</p></div>
    </div>
    <div class="battle-layout">
      <div>
        <div class="battle-bar">
          <span class="phase-chip" id="phase"></span>
          <span class="muted" id="doctrine"></span>
          <span class="spacer"></span>
          <button class="btn btn-sm" id="defend">Defend</button>
          <button class="btn btn-sm" id="end">End round</button>
          <button class="btn btn-sm" id="retreat">Withdraw</button>
        </div>
        <div class="board-frame" id="frame"><svg class="board" id="board"></svg></div>
      </div>
      <aside class="panel" id="side"></aside>
    </div>`;

  const board = root.querySelector("#board");
  const frame = root.querySelector("#frame");
  const side = root.querySelector("#side");

  /* ------------------------------------------------------------- rendering */
  function draw() {
    const w = SIZE * Math.sqrt(3) * (game.width + 0.5) + SIZE;
    const h = SIZE * 1.5 * game.height + SIZE * 3;
    board.setAttribute("viewBox", `0 0 ${w} ${h}`);

    const moves = selected && selected.ap > 0 && !selected.rooted ? game.reachable(selected) : new Map();
    const hexes = [];
    for (let r = 0; r < game.height; r++) {
      for (let col = 0; col < game.width; col++) {
        const hex = game.axial(col, r);
        const q = hex.q;
        const c = px(hex);
        const t = game.terrainAt(hex);
        const can = moves.has(key(hex));
        hexes.push(`<polygon class="hex ${t}${can ? " move" : ""}" points="${corners(c)}"
          data-hex="${q},${r}"></polygon>`);
      }
    }

    const pawns = game.alive().map((u) => {
      const c = px(u.pos);
      const hpPct = Math.max(0, u.hp / u.maxHp);
      const targetable = selected && selected.side === "player" && selected.ap > 0
        && game.targets(selected).includes(u);
      return `<g class="pawn ${u.side}${selected?.uid === u.uid ? " active" : ""}${u.ap === 0 && u.side === "player" ? " spent" : ""}${u.def.stars === 10 ? " ascendant" : ""}"
          data-uid="${u.uid}" transform="translate(${c.x},${c.y})" tabindex="0">
        <circle class="disc" r="${SIZE * 0.62}" ${targetable ? 'stroke="#e0a"' : ""}/>
        <text class="initial" y="1">${esc(initials(u.def.name))}</text>
        <text class="star" y="${SIZE * 0.48}">${u.def.stars}★</text>
        <rect class="hpbar" x="${-SIZE * 0.46}" y="${-SIZE * 0.74}" width="${SIZE * 0.92}" height="3.4" rx="1.7"/>
        <rect class="hpfill" x="${-SIZE * 0.46}" y="${-SIZE * 0.74}" width="${(SIZE * 0.92 * hpPct).toFixed(1)}" height="3.4" rx="1.7"/>
        ${u.def.flying ? `<path d="M${-SIZE * 0.5} ${SIZE * 0.1} q6-7 12 0 M${SIZE * 0.5} ${SIZE * 0.1} q-6-7-12 0" stroke="#9dc4dd" stroke-width="1.2" fill="none"/>` : ""}
      </g>`;
    }).join("");

    board.innerHTML = hexes.join("") + pawns;
    root.querySelector("#phase").textContent = `Round ${game.round}/${game.rounds} · ${game.turn === "player" ? "Your move" : "Enemy"}`;
    root.querySelector("#doctrine").textContent = `Your doctrine: ${game.doctrine("player")} · Enemy: ${game.doctrine("enemy")}`;
    drawSide();
    if (game.over) drawResult();
  }

  function drawSide() {
    const u = selected;
    const logHtml = game.log.map((l) => `<div${l.text.startsWith("—") ? ' class="round"' : ""}>${esc(l.text)}</div>`).join("");
    if (!u) {
      side.innerHTML = `<div class="panel-head"><h3>Orders</h3></div>
        <div class="panel-body"><p class="muted">Select one of your units to see its abilities and
          the breakdown behind its numbers.</p></div>
        <div class="panel-head" style="border-top:1px solid var(--line-soft)"><h3>Log</h3></div>
        <div class="battle-log">${logHtml}</div>`;
      return;
    }
    const atk = game.stat(u, "ATK");
    const def = game.stat(u, "DEF");
    const abilities = [...u.def.actives].map((id) => {
      const a = data.ability(id);
      if (!a) return "";
      const cd = u.cooldowns[id] ?? 0;
      const disabled = u.side !== "player" || u.ap < (a.apCost ?? 1) || cd > 0 || game.turn !== "player";
      return `<button class="order-btn${id === u.def.signature ? " sig" : ""}" data-ability="${esc(id)}" ${disabled ? "disabled" : ""}>
        <b>${esc(a.name)}</b><span>${esc(a.text)}</span>
        <span class="mono">${cd > 0 ? `On cooldown (${cd})` : `${a.apCost ?? 1} AP`}</span></button>`;
    }).join("");

    side.innerHTML = `
      <div class="panel-head"><h3>${esc(u.def.name)}</h3><span class="count">${u.def.stars}★</span></div>
      <div class="panel-body" style="padding-bottom:6px">
        <div class="detail-list">
          <div><span class="k">Hit points</span><span class="v">${u.hp} / ${u.maxHp}</span></div>
          <div><span class="k">Action points</span><span class="v">${u.ap}</span></div>
          <div><span class="k">Morale</span><span class="v">${u.morale}</span></div>
          ${u.rooted ? '<div><span class="k">Status</span><span class="v">Rooted</span></div>' : ""}
          ${u.staggered ? '<div><span class="k">Status</span><span class="v">Staggered — one Anchor gone</span></div>' : ""}
        </div>
      </div>
      <div class="breakdown">
        ${atk.parts.map((p) => `<div><span>${esc(p.source)}</span><span class="mono">${p.value >= 0 ? "+" : ""}${p.value}</span></div>`).join("")}
        <div class="total"><span>Attack</span><span class="mono">${atk.final}</span></div>
        <div class="total"><span>Defence</span><span class="mono">${def.final}</span></div>
      </div>
      ${abilities ? `<div class="panel-head" style="border-top:1px solid var(--line-soft)"><h3>Abilities</h3></div>
        <div class="order-list">${abilities}</div>` : ""}
      <div class="panel-head" style="border-top:1px solid var(--line-soft)"><h3>Log</h3></div>
      <div class="battle-log">${logHtml}</div>`;
  }

  function drawResult() {
    const won = game.over === "player";
    if (won && !save.load().campaign.cleared.includes(node.id)) {
      save.update((s) => { s.campaign.cleared.push(node.id); });
      save.grant(node.reward);
      save.update((s) => { s.log.unshift({ t: Date.now(), text: `${node.name} cleared. Reward collected.` }); });
    }
    frame.insertAdjacentHTML("beforeend", `<div class="result"><div>
      <h2>${won ? "Objective taken" : "Withdrawn"}</h2>
      <p class="muted">${won ? `Reward: ${Object.entries(node.reward).map(([k, v]) => `${v} ${k}`).join(", ")}` : "The muster did not hold."}</p>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:14px">
        <button class="btn btn-primary" data-route="map">Back to the campaign</button>
        <button class="btn" data-route="village">Village</button>
      </div></div></div>`);
  }

  const pawnEl = (u) => board.querySelector(`[data-uid="${u.uid}"]`);

  /* --------------------------------------------------------------- actions */
  async function doAttack(attacker, target) {
    const targetNode = pawnEl(target);
    const res = game.attack(attacker, target);
    if (!res) return;
    busy = true;
    await (res.ranged ? fx.shot(pawnEl(attacker), targetNode) : fx.slash(targetNode, { crit: res.arc === "rear" }));
    fx.float(targetNode, `−${res.damage}`);
    if (res.staggered) fx.float(targetNode, "Staggered", "status");
    busy = false;
    if (game.checkOver()) return draw();
    draw();
  }

  async function doAbility(u, abilityId, target) {
    const a = data.ability(abilityId);
    const needsTarget = ["Smite", "Execute", "ChainLightning", "Heal", "Root", "ApplyStatus"].includes(a?.effect?.kind);
    if (needsTarget && !target) {
      pendingAbility = abilityId;
      toast(`Select a target for ${a.name}.`);
      return;
    }
    const res = game.useAbility(u, abilityId, target);
    pendingAbility = null;
    if (!res) return toast("That ability cannot be used right now.", true);
    busy = true;
    const nodes = res.hits.map((h) => pawnEl(h.unit)).filter(Boolean);
    if (u.def.stars === 10) await fx.ascend(pawnEl(u));
    await fx.forAbility(a, pawnEl(u), nodes);
    for (const h of res.hits) {
      const n = pawnEl(h.unit);
      if (!n) continue;
      if (h.damage) fx.float(n, `−${h.damage}`);
      else if (h.healed) fx.float(n, `+${h.healed}`, "heal");
      else if (h.warded) fx.float(n, "Warded", "status");
      else if (h.rooted) fx.float(n, "Rooted", "status");
    }
    busy = false;
    game.checkOver();
    draw();
  }

  async function runEnemyTurn() {
    busy = true;
    let guard = 40;
    while (guard-- > 0) {
      const step = game.enemyStep();
      if (!step) break;
      if (step.attack) {
        const node2 = step.target && pawnEl(step.target);
        if (node2) {
          await (step.attack.ranged ? fx.shot(pawnEl(step.actor), node2) : fx.slash(node2));
          fx.float(node2, `−${step.attack.damage}`);
        }
      } else if (step.ability) {
        const nodes = step.ability.hits.map((h) => pawnEl(h.unit)).filter(Boolean);
        if (step.actor.def.stars === 10) await fx.ascend(pawnEl(step.actor));
        await fx.forAbility(step.ability.ability, pawnEl(step.actor), nodes);
      }
      draw();
      if (game.checkOver()) break;
      await new Promise((r) => setTimeout(r, 220));
    }
    busy = false;
    game.endTurn();
    selected = null;
    draw();
  }

  /* -------------------------------------------------------------- handlers */
  board.addEventListener("click", async (e) => {
    if (busy || game.over || game.turn !== "player") return;
    const pawn = e.target.closest("[data-uid]");
    if (pawn) {
      const u = game.units.find((x) => x.uid === pawn.dataset.uid);
      if (!u) return;
      if (u.side === "player" && !pendingAbility) { selected = u; return draw(); }
      if (selected && pendingAbility) return doAbility(selected, pendingAbility, u);
      if (selected && u.side === "enemy") return doAttack(selected, u);
      return;
    }
    const hex = e.target.closest("[data-hex]");
    if (hex && selected) {
      const [q, r] = hex.dataset.hex.split(",").map(Number);
      if (game.move(selected, { q, r })) draw();
    }
  });

  side.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ability]");
    if (b && selected) doAbility(selected, b.dataset.ability, null);
  });

  root.querySelector("#defend").addEventListener("click", () => {
    if (!selected || selected.ap < 1) return toast("Select a unit with action points left.", true);
    selected.ap -= 1;
    selected.defending = true;
    game.note(`${selected.def.name} sets to defend.`);
    draw();
  });
  root.querySelector("#end").addEventListener("click", () => {
    if (busy || game.over) return;
    selected = null;
    game.endTurn();
    draw();
    runEnemyTurn();
  });
  root.querySelector("#retreat").addEventListener("click", () => go("map"));

  draw();
}

/* ------------------------------------------------------------------ setup */
function initials(name) {
  return name.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/** Terrain is derived from the node so each objective plays differently. */
function terrainFor(node) {
  const t = [];
  const put = (q, r, kind) => t.push([`${q},${r}`, kind]);
  const seed = node.id.length;
  for (let r = 0; r < 8; r++) {
    for (let q = 0; q < 11; q++) {
      const n = (q * 7 + r * 13 + seed * 5) % 17;
      if (n === 0) put(q, r, "Forest");
      else if (n === 3) put(q, r, "HighGround");
      else if (n === 11 && node.enemy === "ANG") put(q, r, "AntiAir");
      else if (n === 5 && (node.enemy === "KNI" || node.enemy === "MNK")) put(q, r, "Fortification");
      else if (n === 9 && node.enemy === "RIT") put(q, r, "Water");
    }
  }
  return t;
}

/**
 * Build the opposing force from the node's faction, scaled by assessed strength.
 * Always returns a full platoon: if a faction has no unit in the target band for a slot,
 * the nearest available one is used rather than leaving the slot empty.
 */
function enemyForce(data, node) {
  const pool = data.units.filter((u) => u.faction === node.enemy && !u.summonOnly && u.stars < 10);
  const band = Math.min(9, node.strength + 2);
  const pick = (test) => {
    const eligible = pool.filter(test);
    if (!eligible.length) return null;
    // Closest to the band from below, then the smallest thing available.
    return eligible.sort((a, b) =>
      (a.stars <= band ? band - a.stars : 100 + a.stars) - (b.stars <= band ? band - b.stars : 100 + b.stars))[0];
  };
  const commander = pick((u) => u.slots.includes("Commander"));
  const second = pick((u) => u.slots.includes("Second"));
  const elite = pick((u) => u.slots.includes("Elite"));
  const foot = pick((u) => u.slots.includes("FootSoldier"));
  const force = [commander, second, elite, ...Array(5).fill(foot)].filter(Boolean).map((u) => u.id);
  while (force.length < 8 && pool.length) force.push(pool[force.length % pool.length].id);

  // A late objective fields its Ascendant. One only, exactly as the army rules require.
  if (node.strength >= 6) {
    const asc = data.units.find((u) => u.faction === node.enemy && u.stars === 10);
    if (asc) force.push(asc.id);
  }
  return force;
}

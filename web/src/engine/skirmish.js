/**
 * Skirmish engine for the battle screen.
 *
 * A compact, presentation-facing tactical layer that uses the same data and the same
 * formulas the reference engine in core/ specifies:
 *   damage = max(100, FinalATK − FinalDEF)
 *   Final  = Base + ThemeCohesion + Doctrine + Command + Status + Terrain
 * The TypeScript core remains the canonical rules implementation; this mirrors the parts
 * a player actually sees so the browser build needs no bundler.
 */

export const MIN_DAMAGE = 100;
const DIRS = [{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }];

export const key = (h) => `${h.q},${h.r}`;
export const neighbours = (h) => DIRS.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));
export function distance(a, b) {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

const TERRAIN_COST = { Open: 1, Forest: 2, HighGround: 2, Fortification: 1, Smoke: 1, AntiAir: 1, Water: Infinity };

export class Skirmish {
  /**
   * @param data   loaded game data
   * @param setup  { width, height, terrain, player: [unitId], enemy: [unitId], rounds }
   */
  constructor(data, setup) {
    this.data = data;
    this.width = setup.width ?? 11;
    this.height = setup.height ?? 8;
    this.rounds = setup.rounds ?? 12;
    this.round = 1;
    this.turn = "player";
    this.units = [];
    this.terrain = new Map(setup.terrain ?? []);
    this.log = [];
    this.over = null;
    this._uid = 0;

    setup.player.forEach((id, i) => this.#place(id, "player", this.axial(i % 2, 1 + Math.floor(i / 2))));
    setup.enemy.forEach((id, i) => this.#place(id, "enemy", this.axial(this.width - 1 - (i % 2), 1 + Math.floor(i / 2))));
    this.beginRound();
  }

  #place(defId, side, pos) {
    const d = this.data.unit(defId);
    if (!d) return;
    while (this.at(pos) || !this.inBounds(pos)) pos = this.axial(this.col(pos), pos.r + 1);
    if (!this.inBounds(pos)) return;
    this.units.push({
      uid: `u${++this._uid}`, defId, def: d, side, pos,
      hp: d.hp, maxHp: d.hp, morale: d.morale, ap: 0,
      facing: side === "player" ? 0 : 3,
      defending: false, defeated: false, staggered: false,
      cooldowns: {},
    });
  }

  /* -------------------------------------------------------------- queries */
  alive(side) { return this.units.filter((u) => !u.defeated && (!side || u.side === side)); }
  at(h) { return this.units.find((u) => !u.defeated && u.pos.q === h.q && u.pos.r === h.r); }
  /**
   * The board is a rectangle of hexes, stored in axial coordinates. Row r is shifted by
   * -floor(r/2) so that the rendered shape is a rectangle rather than a rhombus, while
   * distance and adjacency stay plain axial maths.
   */
  col(h) { return h.q + Math.floor(h.r / 2); }
  axial(col, row) { return { q: col - Math.floor(row / 2), r: row }; }
  inBounds(h) {
    const c = this.col(h);
    return h.r >= 0 && h.r < this.height && c >= 0 && c < this.width;
  }
  terrainAt(h) { return this.terrain.get(key(h)) ?? "Open"; }

  /** Adjacent allies sharing a theme, capped at 4, worth +50 each. */
  cohesion(u) {
    const n = neighbours(u.pos)
      .map((h) => this.at(h))
      .filter((a) => a && a.side === u.side && a.def.themes.some((t) => u.def.themes.includes(t)))
      .length;
    return Math.min(4, n) * 50;
  }

  /** Full / Reduced / Broken from what is still standing on this side. */
  doctrine(side) {
    const live = this.alive(side);
    const leader = live.some((u) => u.def.slots.includes("Commander"));
    const elite = live.some((u) => u.def.slots.includes("Elite"));
    const foot = live.filter((u) => u.def.slots.includes("FootSoldier")).length;
    if (!leader || !elite || foot < 3) return "Broken";
    return foot >= 5 ? "Full" : "Reduced";
  }

  /** Strongest command aura in range; auras never stack. */
  command(u) {
    let best = 0;
    for (const a of this.alive(u.side)) {
      if (a.uid === u.uid || !a.def.commandRadius) continue;
      if (distance(a.pos, u.pos) <= a.def.commandRadius) best = Math.max(best, 50 + a.def.stars * 10);
    }
    return best;
  }

  /** Every contribution is tagged so the UI can show the breakdown. */
  stat(u, which, ctx = {}) {
    const parts = [{ source: "Base", value: which === "ATK" ? u.def.atk : u.def.def }];
    const ascendant = u.def.stars === 10;
    if (!ascendant) {
      const coh = this.cohesion(u);
      if (coh) parts.push({ source: "Theme Cohesion", value: coh });
      const d = this.doctrine(u.side);
      const bonus = d === "Full" ? 100 : d === "Reduced" ? 50 : 0;
      if (bonus) parts.push({ source: `Doctrine (${d})`, value: bonus });
      const cmd = this.command(u);
      if (cmd) parts.push({ source: "Command aura", value: cmd });
      if (u.morale < 40) parts.push({ source: "Morale: Shaken", value: -50 });
    } else {
      parts.push({ source: "Ascendant: self-sufficient", value: 0 });
    }
    if (which === "DEF" && u.defending) parts.push({ source: "Defend action", value: 150 });
    if (which === "DEF" && !u.def.flying && this.terrainAt(u.pos) === "Fortification") parts.push({ source: "Fortification", value: 200 });
    if (which === "ATK" && ctx.ranged && !u.def.flying && this.terrainAt(u.pos) === "HighGround") parts.push({ source: "High ground", value: 100 });

    let final = parts.reduce((s, p) => s + p.value, 0);
    if (which === "DEF" && ctx.arc && ctx.arc !== "front") {
      const pct = ctx.arc === "flank" ? 0.10 : 0.25;
      const pen = -Math.round(final * pct);
      parts.push({ source: `Attacked from ${ctx.arc}`, value: pen });
      final += pen;
    }
    return { parts, final: Math.max(0, final) };
  }

  arc(attacker, defender) {
    const back = DIRS[(defender.facing + 3) % 6];
    const towards = { q: attacker.pos.q - defender.pos.q, r: attacker.pos.r - defender.pos.r };
    const dot = towards.q * back.q + towards.r * back.r;
    if (dot > 0) return "rear";
    const front = DIRS[defender.facing];
    return towards.q * front.q + towards.r * front.r > 0 ? "front" : "flank";
  }

  /* ------------------------------------------------------------- movement */
  reachable(u) {
    const budget = u.def.mov;
    const seen = new Map([[key(u.pos), 0]]);
    const queue = [u.pos];
    while (queue.length) {
      const cur = queue.shift();
      const spent = seen.get(key(cur));
      for (const n of neighbours(cur)) {
        if (!this.inBounds(n) || this.at(n)) continue;
        const cost = u.def.flying ? 1 : TERRAIN_COST[this.terrainAt(n)] ?? 1;
        const total = spent + cost;
        if (total > budget) continue;
        if (seen.has(key(n)) && seen.get(key(n)) <= total) continue;
        seen.set(key(n), total);
        queue.push(n);
      }
    }
    seen.delete(key(u.pos));
    return seen;
  }

  targets(u) {
    const range = u.def.range + (this.terrainAt(u.pos) === "HighGround" && u.def.range > 1 ? 1 : 0);
    return this.alive().filter((e) => e.side !== u.side && distance(u.pos, e.pos) <= range);
  }

  /* -------------------------------------------------------------- actions */
  move(u, to) {
    const r = this.reachable(u);
    if (u.ap < 1 || !r.has(key(to))) return null;
    const from = u.pos;
    u.pos = to;
    u.facing = this.#facingTo(from, to);
    u.ap -= 1;
    u.defending = false;
    return { from, to };
  }

  attack(u, target) {
    if (u.ap < 1 || !this.targets(u).includes(target)) return null;
    u.ap -= 1;
    u.facing = this.#facingTo(u.pos, target.pos);
    const ranged = u.def.range > 1;
    const arc = this.arc(u, target);
    const atk = this.stat(u, "ATK", { ranged });
    const def = this.stat(target, "DEF", { arc, ranged });
    const damage = Math.max(MIN_DAMAGE, atk.final - def.final);
    const res = this.damage(target, damage, u.def.name);
    this.note(`${u.def.name} strikes ${target.def.name} for ${damage}${arc !== "front" ? ` (${arc})` : ""}.`);
    return { damage, arc, ranged, atk, def, ...res };
  }

  /** Signature and active abilities. Effects mirror the data-driven kinds in the core engine. */
  useAbility(u, abilityId, target) {
    const a = this.data.ability(abilityId);
    if (!a || u.ap < (a.apCost ?? 1) || (u.cooldowns[abilityId] ?? 0) > 0) return null;
    const e = a.effect;
    const hits = [];
    const radius = e.radius ?? 0;
    const inRadius = () => this.alive().filter((x) => x.side !== u.side && distance(u.pos, x.pos) <= radius);

    switch (e.kind) {
      case "Smite": case "Execute": {
        if (!target) return null;
        const lethal = e.kind === "Execute" && target.hp <= target.maxHp * (e.threshold / 100);
        hits.push({ unit: target, ...this.damage(target, lethal ? target.hp : e.damage, a.name) });
        break;
      }
      case "Judgement": case "ConeDamage": {
        const area = e.kind === "Judgement" ? inRadius()
          : this.alive().filter((x) => x.side !== u.side && distance(u.pos, x.pos) <= e.length);
        for (const t of area) hits.push({ unit: t, ...this.damage(t, e.damage, a.name) });
        break;
      }
      case "ChainLightning": {
        if (!target) return null;
        let cur = target;
        const seen = new Set();
        hits.push({ unit: cur, ...this.damage(cur, e.damage, a.name) });
        seen.add(cur.uid);
        for (let i = 0; i < e.jumps; i++) {
          const next = this.alive().find((x) => x.side !== u.side && !seen.has(x.uid) && distance(cur.pos, x.pos) <= 2);
          if (!next) break;
          hits.push({ unit: next, ...this.damage(next, e.damage, a.name) });
          seen.add(next.uid);
          cur = next;
        }
        break;
      }
      case "MultiStrike": {
        const near = this.alive().filter((x) => x.side !== u.side && distance(u.pos, x.pos) <= 1);
        if (!near.length) return null;
        const atk = this.stat(u, "ATK").final;
        for (let i = 0; i < e.strikes; i++) {
          const t = near[i % near.length];
          if (t.defeated) continue;
          const dmg = Math.max(MIN_DAMAGE, Math.round(atk * (e.atkPercent / 100)) - this.stat(t, "DEF").final);
          hits.push({ unit: t, ...this.damage(t, dmg, a.name) });
        }
        break;
      }
      case "Heal": {
        const t = target ?? u;
        t.hp = Math.min(t.maxHp, t.hp + e.amount);
        hits.push({ unit: t, healed: e.amount });
        break;
      }
      case "Ward": {
        const allies = e.radius ? this.alive(u.side).filter((x) => distance(u.pos, x.pos) <= e.radius) : [u];
        for (const t of allies) { t.ward = (t.ward ?? 0) + e.def; t.defending = true; hits.push({ unit: t, warded: e.def }); }
        break;
      }
      case "Root": case "ApplyStatus": {
        for (const t of (radius ? inRadius() : target ? [target] : [])) {
          t.rooted = e.rounds ?? 1;
          t.morale = Math.max(0, t.morale - 20);
          hits.push({ unit: t, rooted: true });
        }
        break;
      }
      case "MoraleShock": {
        for (const t of this.alive().filter((x) => x.side !== u.side && distance(u.pos, x.pos) <= 1)) {
          t.morale = Math.max(0, t.morale + e.morale);
          hits.push({ unit: t, morale: e.morale });
        }
        break;
      }
      default: {
        // Anything without a presentation-layer handler still resolves as a strong strike,
        // so no ability on a card is ever inert on the battle screen.
        if (!target) return null;
        hits.push({ unit: target, ...this.damage(target, Math.round(u.def.atk * 0.75), a.name) });
      }
    }

    if (!hits.length) return { failed: "No valid target in range." };
    u.ap -= a.apCost ?? 1;
    u.cooldowns[abilityId] = a.cooldown ?? 2;
    this.note(`${u.def.name} uses ${a.name}.`);
    return { ability: a, hits };
  }

  damage(t, amount, source) {
    const reduced = Math.max(MIN_DAMAGE, amount - (t.ward ?? 0));
    t.hp -= reduced;
    t.morale = Math.max(0, t.morale - 5);
    if (t.hp > 0) return { damage: reduced, defeated: false };
    // Ascendants stagger rather than die while an Anchor remains.
    if (t.def.divine && !t.staggered) {
      t.staggered = true;
      t.hp = Math.floor(t.maxHp / 2);
      this.note(`${t.def.name} staggers — an Anchor breaks.`);
      return { damage: reduced, defeated: false, staggered: true };
    }
    t.hp = 0;
    t.defeated = true;
    this.note(`${t.def.name} falls to ${source}.`);
    for (const a of this.alive(t.side)) if (distance(a.pos, t.pos) <= 2) a.morale = Math.max(0, a.morale - 8);
    return { damage: reduced, defeated: true };
  }

  /* ---------------------------------------------------------------- turns */
  beginRound() {
    for (const u of this.alive()) {
      u.ap = 2;
      u.defending = false;
      u.ward = 0;
      if (u.rooted) u.rooted--;
      for (const k of Object.keys(u.cooldowns)) if (u.cooldowns[k] > 0) u.cooldowns[k]--;
    }
    this.note(`— Round ${this.round} —`);
  }

  endTurn() {
    if (this.turn === "player") { this.turn = "enemy"; return "enemy"; }
    this.turn = "player";
    this.round++;
    this.beginRound();
    this.checkOver();
    return "player";
  }

  checkOver() {
    if (!this.alive("enemy").length) this.over = "player";
    else if (!this.alive("player").length) this.over = "enemy";
    else if (this.round > this.rounds) this.over = this.alive("player").length >= this.alive("enemy").length ? "player" : "enemy";
    return this.over;
  }

  /** One enemy action. The battle screen calls this on a timer so the player can follow it. */
  enemyStep() {
    const actor = this.alive("enemy").find((u) => u.ap > 0 && !u.rooted);
    if (!actor) return null;
    const foes = this.alive("player");
    if (!foes.length) return null;

    const reachableTargets = this.targets(actor);
    if (reachableTargets.length) {
      // Prefer the target it can actually finish, then the softest one.
      const best = reachableTargets.sort((a, b) => {
        const da = this.stat(actor, "ATK").final - this.stat(a, "DEF").final;
        const db = this.stat(actor, "ATK").final - this.stat(b, "DEF").final;
        return (b.hp <= db ? 1e6 : db) - (a.hp <= da ? 1e6 : da);
      })[0];
      const sig = actor.def.signature;
      if (sig && !(actor.cooldowns[sig] > 0) && actor.ap >= 1) {
        const r = this.useAbility(actor, sig, best);
        if (r && !r.failed) return { actor, target: best, ability: r };
      }
      return { actor, target: best, attack: this.attack(actor, best) };
    }

    const nearest = foes.sort((a, b) => distance(actor.pos, a.pos) - distance(actor.pos, b.pos))[0];
    const options = [...this.reachable(actor).keys()].map((k) => {
      const [q, r] = k.split(",").map(Number);
      return { q, r };
    });
    if (!options.length) { actor.ap = 0; return null; }
    const step = options.sort((a, b) => distance(a, nearest.pos) - distance(b, nearest.pos))[0];
    return { actor, move: this.move(actor, step) };
  }

  note(text) { this.log.unshift({ round: this.round, text }); this.log = this.log.slice(0, 80); }
  #facingTo(from, to) {
    const d = { q: to.q - from.q, r: to.r - from.r };
    let best = 0, bestDot = -Infinity;
    DIRS.forEach((dir, i) => {
      const dot = dir.q * d.q + dir.r * d.r;
      if (dot > bestDot) { bestDot = dot; best = i; }
    });
    return best;
  }
}

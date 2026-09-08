/**
 * Battle effects.
 *
 * Every effect is roughly one second: long enough to read what happened, short enough
 * that a full round never feels like it is waiting on the animation. Each returns a
 * promise that resolves when the effect has finished, so the turn loop can await it.
 *
 * Effects are drawn into a fixed overlay in screen coordinates, so they are unaffected
 * by scrolling inside the board.
 */

const layer = () => document.getElementById("fx-layer");
const DUR = 1000;

function el(tag, cls, style = {}) {
  const n = document.createElement(tag);
  n.className = cls;
  Object.assign(n.style, style);
  return n;
}

function mount(node, ms = DUR) {
  layer().appendChild(node);
  return new Promise((res) => setTimeout(() => { node.remove(); res(); }, ms));
}

/** Centre of an element in screen coordinates. */
export function centre(node) {
  const r = node.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/* ------------------------------------------------------------------ effects */

/** Melee: a curved sweep across the target plus a shake. */
export function slash(target, { crit = false } = {}) {
  const p = centre(target);
  const n = el("div", `fx fx-slash${crit ? " crit" : ""}`, { left: `${p.x}px`, top: `${p.y}px` });
  n.innerHTML = `<svg viewBox="0 0 100 100"><path d="M12 78 Q50 8 88 26" fill="none" stroke="currentColor"
    stroke-width="7" stroke-linecap="round"/><path d="M20 88 Q56 26 92 40" fill="none" stroke="currentColor"
    stroke-width="3" stroke-linecap="round" opacity=".6"/></svg>`;
  target.classList.add("hit-shake");
  setTimeout(() => target.classList.remove("hit-shake"), 420);
  return mount(n);
}

/** Ranged: a shaft that travels, then lands. */
export function shot(from, to) {
  const a = centre(from), b = centre(to);
  const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  const n = el("div", "fx fx-shot", {
    left: `${a.x}px`, top: `${a.y}px`,
    transform: `rotate(${angle}deg)`,
    "--dx": `${b.x - a.x}px`, "--dy": `${b.y - a.y}px`,
  });
  return mount(n, 520).then(() => slash(to));
}

/** Lightning: a jagged bolt to each link in the chain, in sequence. */
export function chain(from, nodes) {
  let prev = centre(from);
  const seq = nodes.map((node, i) => () => {
    const p = centre(node);
    const bolt = boltBetween(prev, p, i);
    prev = p;
    node.classList.add("hit-shake");
    setTimeout(() => node.classList.remove("hit-shake"), 380);
    return mount(bolt, 520);
  });
  return seq.reduce((chainP, step) => chainP.then(step), Promise.resolve());
}

function boltBetween(a, b, seed = 0) {
  const steps = 7;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const jitter = i === 0 || i === steps ? 0 : (Math.sin((i + seed) * 12.9898) * 43758.5453 % 1) * 22 - 11;
    const nx = a.x + (b.x - a.x) * t - (b.y - a.y) * 0 + jitter;
    const ny = a.y + (b.y - a.y) * t + jitter * 0.7;
    pts.push(`${nx},${ny}`);
  }
  const n = el("div", "fx fx-chain", { left: "0", top: "0" });
  n.innerHTML = `<svg width="100%" height="100%" style="position:fixed;inset:0">
    <polyline points="${pts.join(" ")}" fill="none" stroke="#dcd0ff" stroke-width="3" stroke-linejoin="round"/>
    <polyline points="${pts.join(" ")}" fill="none" stroke="#8a6fd8" stroke-width="7" stroke-linejoin="round" opacity=".45"/>
  </svg>`;
  return n;
}

/** Angelic / holy: a column that falls and a ring that spreads. */
export function beam(target) {
  const p = centre(target);
  const n = el("div", "fx fx-beam", { left: `${p.x}px`, top: `${p.y}px` });
  n.innerHTML = `<i class="col"></i><i class="ring"></i><i class="ring d2"></i>`;
  target.classList.add("hit-shake");
  setTimeout(() => target.classList.remove("hit-shake"), 500);
  return mount(n);
}

/** Dragon breath / cone: a wedge that opens away from the caster. */
export function cone(from, to) {
  const a = centre(from), b = centre(to);
  const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  const n = el("div", "fx fx-cone", { left: `${a.x}px`, top: `${a.y}px`, transform: `rotate(${angle}deg)` });
  n.innerHTML = `<svg viewBox="0 0 100 60" preserveAspectRatio="none">
    <path d="M0 30 L100 2 L100 58 Z" fill="url(#coneg)"/>
    <defs><linearGradient id="coneg" x1="0" x2="1">
      <stop offset="0" stop-color="#ffd9a0" stop-opacity=".9"/>
      <stop offset="1" stop-color="#c25a2a" stop-opacity="0"/></linearGradient></defs></svg>`;
  return mount(n);
}

/** Thorn / area burst: spikes thrown outward from the centre. */
export function burst(target, colour = "#8fae6a") {
  const p = centre(target);
  const n = el("div", "fx fx-burst", { left: `${p.x}px`, top: `${p.y}px`, color: colour });
  n.innerHTML = Array.from({ length: 10 }, (_, i) =>
    `<i style="--a:${i * 36}deg;--d:${40 + (i % 3) * 14}px"></i>`).join("");
  return mount(n, 900);
}

/** Ascendant arrival: the one effect allowed to be loud. */
export function ascend(target) {
  const p = centre(target);
  const n = el("div", "fx fx-ascend", { left: `${p.x}px`, top: `${p.y}px` });
  n.innerHTML = `<i class="halo"></i><i class="halo d2"></i>
    ${Array.from({ length: 14 }, (_, i) => `<i class="ray" style="--a:${i * 25.7}deg"></i>`).join("")}`;
  return mount(n, 1100);
}

/** Floating number over a unit: damage, healing or a status word. */
export function float(target, text, kind = "damage") {
  const p = centre(target);
  const n = el("div", `fx fx-float ${kind}`, { left: `${p.x}px`, top: `${p.y}px` });
  n.textContent = text;
  return mount(n, 950);
}

/** Choose an effect from the ability's own effect kind, so cards and visuals agree. */
export function forAbility(ability, casterEl, targetEls) {
  const kind = ability?.effect?.kind;
  const first = targetEls[0];
  if (!first) return Promise.resolve();
  switch (kind) {
    case "ChainLightning": return chain(casterEl, targetEls);
    case "Smite": case "Judgement": case "Heal": case "Cleanse": return beam(first);
    case "ConeDamage": return cone(casterEl, first);
    case "Thorns": case "Root": case "ApplyStatus": case "MoraleShock": return burst(first);
    case "Ward": return beam(casterEl);
    case "MultiStrike": return targetEls.reduce((p, t) => p.then(() => slash(t, { crit: true })), Promise.resolve());
    case "Execute": return slash(first, { crit: true }).then(() => burst(first, "#c8a45c"));
    default: return slash(first, { crit: true });
  }
}

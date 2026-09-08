/**
 * Procedural unit art.
 *
 * The roster is 260 units and only ten have painted concepts, so every card gets a
 * deterministic generated portrait instead: a heraldic silhouette on a faction ground,
 * seeded from the unit id. The same unit always renders the same image, and a card can
 * never end up with an empty art window.
 *
 * Painted concepts, where they exist, are used in preference to the generated art.
 */

const FACTION_INK = {
  SAM: ["#4a1f1c", "#a4483c", "#e0c9a0"],
  SHI: ["#161d29", "#4a5f7a", "#b9c8d4"],
  KNI: ["#182338", "#4d6a94", "#e6e2d6"],
  DRG: ["#1c2027", "#6d7684", "#c6ccd4"],
  RIT: ["#17231c", "#5b7360", "#cbd8c4"],
  THC: ["#1a2216", "#5d7048", "#d7cdb2"],
  ANG: ["#2a2415", "#b09a5e", "#fbf3dc"],
  STM: ["#221c33", "#7d6ea8", "#e2dcf4"],
  MNK: ["#221e18", "#8a7a63", "#efe6d6"],
  FUS: ["#241b15", "#8c6a52", "#ecdcc9"],
  DIV: ["#231d2c", "#9c8fb0", "#f0eaf6"],
};

/* ---------------------------------------------------------------- seeded rng */
function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------- archetype key */
/** Reduce a unit to one of a dozen silhouette families. */
export function silhouetteKey(u) {
  const r = u.roles ?? [];
  const kw = u.keywords ?? [];
  if (kw.includes("Biblically Accurate")) return "wheels";
  if (u.faction === "ANG") return r.includes("Ritualist") || r.includes("Support") ? "winged-robe" : "winged";
  if (u.size === "Large" || u.size === "Colossal") return "colossus";
  if (r.includes("Cavalry")) return u.flying ? "winged" : "rider";
  if (r.includes("Siege")) return "engine";
  if (r.includes("Ritualist") || r.includes("PortalKeeper")) return "robe";
  if (r.includes("Support")) return "lantern";
  if (r.includes("Ranged")) return "archer";
  if (r.includes("Commander") || r.includes("Second")) return "banner";
  if (r.includes("Elite")) return "blade";
  if (u.mov >= 6) return "cloak";
  return u.def >= u.atk ? "guardian" : "spear";
}

/* -------------------------------------------------------------- silhouettes */
/* Drawn inside a 100x140 box, feet at y=132. The head is always a separate shape from
   the body: merged head-and-shoulders reads as a blob at card size. */

const BODY = {
  standard: `<path d="M50 44 q13 0 19 8 l6 8 q4 8 5 18 l4 54 h-68 l4-54 q1-10 5-18 l6-8 q6-8 19-8z"/>`,
  robed:    `<path d="M50 44 q12 0 17 8 l5 9 q5 12 7 26 l6 45 h-70 l6-45 q2-14 7-26 l5-9 q5-8 17-8z"/>`,
  cloaked:  `<path d="M50 44 q13 0 19 8 l8 9 q6 10 7 22 l4 49 h-76 l4-49 q1-12 7-22 l8-9 q6-8 19-8z"/>`,
  broad:    `<path d="M50 38 q19 0 26 11 l8 12 q5 11 6 24 l5 47 h-90 l5-47 q1-13 6-24 l8-12 q7-11 26-11z"/>`,
};

const HEAD = {
  bare: `<circle cx="50" cy="31" r="9.5"/><rect x="46" y="38" width="8" height="7" rx="2"/>`,
  helm: `<path d="M50 20 q11 0 11 12 0 8-4 11 h-14 q-4-3-4-11 0-12 11-12z"/><rect x="46" y="42" width="8" height="4" rx="1.5"/><path d="M50 14 l3 7h-6z"/>`,
  hood: `<path d="M50 18 q12 0 12 15 0 10-5 14 h-14 q-5-4-5-14 0-15 12-15z"/>`,
  horned: `<path d="M50 14 q13 0 13 14 0 9-5 12 h-16 q-5-3-5-12 0-14 13-14z"/><path d="M36 20 q-11-6-15-17 12 3 18 12z"/><path d="M64 20 q11-6 15-17 -12 3-18 12z"/>`,
};

const FIGURES = {
  spear: (p) => `${BODY.standard}${HEAD.helm}
    <rect x="${p(76)}" y="16" width="3" height="116" rx="1.5"/>
    <path d="M${p(77.5)} 6 l6 13 h-12z"/>`,
  guardian: (p) => `${BODY.broad}${HEAD.helm}
    <path d="M${p(20)} 62 q-8 4-8 16 v22 q0 12 8 16 8-4 8-16 v-22 q0-12-8-16z"/>`,
  blade: (p) => `${BODY.standard}${HEAD.bare}
    <path d="M${p(72)} 100 q22-24 30-60 l5 3 q-9 40-31 62z"/>
    <rect x="${p(70)}" y="96" width="10" height="4" rx="1.5"/>`,
  cloak: (p) => `${BODY.cloaked}${HEAD.hood}
    <path d="M${p(16)} 74 q-9 28-3 58 l14-5 q-6-28 1-51z" opacity=".65"/>
    <path d="M${p(84)} 74 q9 28 3 58 l-14-5 q6-28-1-51z" opacity=".65"/>`,
  archer: (p) => `${BODY.standard}${HEAD.bare}
    <path d="M${p(76)} 18 q20 38 0 76" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M${p(76)} 18 L${p(76)} 94" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".8"/>`,
  robe: (p) => `${BODY.robed}${HEAD.hood}
    <rect x="${p(78)}" y="20" width="3" height="112" rx="1.5"/>
    <circle cx="${p(79.5)}" cy="15" r="7.5" fill="none" stroke="currentColor" stroke-width="2.6"/>`,
  lantern: (p) => `${BODY.robed}${HEAD.hood}
    <path d="M${p(78)} 56 h15 v18 h-15z"/><path d="M${p(85.5)} 44 v12" stroke="currentColor" stroke-width="2" fill="none"/>
    <path d="M${p(78)} 56 l7.5-7 7.5 7z"/>`,
  banner: (p) => `${BODY.broad}${HEAD.helm}
    <rect x="${p(80)}" y="6" width="3" height="126" rx="1.5"/>
    <path d="M${p(83)} 12 h24 l-7 12 7 12h-24z"/>`,
  rider: (p) => `<path d="M12 98 q7-24 30-26 l25-2 q15 0 19 13 l5 15 -7 4 -4-11-9 2 5 34h-11l-5-32h-25l-6 32h-11l4-34z"/>
    <path d="M${p(74)} 74 q10-8 14-20 l6 2 q-4 15-15 24z"/>
    <g transform="translate(0,-30) scale(.72) translate(14,0)">${BODY.standard}${HEAD.helm}</g>`,
  winged: (p) => `${BODY.standard}${HEAD.bare}
    <path d="M${p(38)} 56 q-34-24-42 2 18-2 24 6 -20 3-22 20 20-9 28 2 -11 7-9 20 15-15 24-11z"/>
    <path d="M${p(62)} 56 q34-24 42 2 -18-2-24 6 20 3 22 20 -20-9-28 2 11 7 9 20 -15-15-24-11z"/>`,
  "winged-robe": (p) => `${BODY.robed}${HEAD.hood}
    <path d="M${p(38)} 58 q-32-22-38 3 17-2 21 6 -17 4-19 19 17-9 26 2z"/>
    <path d="M${p(62)} 58 q32-22 38 3 -17-2-21 6 17 4 19 19 -17-9-26 2z"/>`,
  colossus: (p) => `${BODY.broad}${HEAD.horned}
    <path d="M${p(12)} 74 l-8 40 10 3 8-38z"/>`,
  engine: (p) => `<path d="M10 130 h80 l-7-36h-66z"/><rect x="24" y="62" width="52" height="32" rx="3"/>
    <path d="M${p(72)} 70 l28-44 6 4 -27 44z"/><circle cx="26" cy="130" r="10"/><circle cx="74" cy="130" r="10"/>`,
  wheels: () => `
    <circle cx="50" cy="70" r="42" fill="none" stroke="currentColor" stroke-width="5"/>
    <circle cx="50" cy="70" r="28" fill="none" stroke="currentColor" stroke-width="4"/>
    <circle cx="50" cy="70" r="15" fill="none" stroke="currentColor" stroke-width="3"/>`,
};

/** The unnerving detail for biblically accurate angels: rings of open eyes. */
function eyes(rand) {
  let out = "";
  for (const [r, n] of [[42, 12], [28, 8], [15, 5]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand() * 0.4;
      const x = 50 + Math.cos(a) * r, y = 70 + Math.sin(a) * r;
      out += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="4.6" ry="2.9" fill="var(--art-ink)"/>`
           + `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.5" fill="var(--art-hi)"/>`;
    }
  }
  return out;
}

/**
 * Generate the portrait SVG for a unit.
 * Returns a string; callers insert it into an element with `overflow: hidden`.
 */
export function portrait(unit, { w = 200, h = 260 } = {}) {
  const seed = hash(unit.id);
  const rand = rng(seed);
  const [dark, mid, light] = FACTION_INK[unit.faction] ?? FACTION_INK.DRG;
  const key = silhouetteKey(unit);
  const flip = rand() > 0.5;
  const p = (x) => (flip ? 100 - x : x);
  const stars = unit.stars ?? 4;
  const uid = `a${seed.toString(36)}`;

  /* Horizon furniture varies by seed so no two grounds are identical. */
  const ridges = Array.from({ length: 3 }, (_, i) => {
    const y = 78 + i * 9 + rand() * 5;
    const pts = Array.from({ length: 7 }, (_, j) =>
      `${(j * 100) / 6},${(y - rand() * 12).toFixed(1)}`).join(" ");
    return `<polyline points="${pts}" fill="none" stroke="${light}" stroke-width=".8" opacity="${0.10 + i * 0.04}"/>`;
  }).join("");

  const halo = stars >= 10
    ? `<circle cx="50" cy="66" r="44" fill="none" stroke="url(#g${uid}h)" stroke-width="1.4" opacity=".85"/>
       <circle cx="50" cy="66" r="33" fill="none" stroke="${light}" stroke-width=".7" opacity=".5"/>
       ${Array.from({ length: 16 }, (_, i) => {
         const a = (i / 16) * Math.PI * 2;
         return `<line x1="${50 + Math.cos(a) * 46}" y1="${66 + Math.sin(a) * 46}" x2="${50 + Math.cos(a) * 58}" y2="${66 + Math.sin(a) * 58}" stroke="${light}" stroke-width=".8" opacity=".35"/>`;
       }).join("")}`
    : stars >= 8
      ? `<circle cx="50" cy="66" r="38" fill="none" stroke="${light}" stroke-width=".9" opacity=".28"/>`
      : "";

  const figure = FIGURES[key] ? FIGURES[key](p) : FIGURES.spear(p);
  const eyeRing = key === "wheels" ? eyes(rand) : "";

  return `<svg viewBox="0 0 100 140" width="${w}" height="${h}" preserveAspectRatio="xMidYMax slice"
    role="img" aria-label="Generated portrait of ${escapeAttr(unit.name)}" xmlns="http://www.w3.org/2000/svg"
    style="--art-ink:${dark};--art-hi:${light}">
  <defs>
    <linearGradient id="g${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${light}" stop-opacity=".42"/>
      <stop offset=".34" stop-color="${mid}"/>
      <stop offset=".78" stop-color="${dark}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
    <radialGradient id="g${uid}b" cx=".5" cy=".46" r=".42">
      <stop offset="0" stop-color="${light}" stop-opacity=".55"/>
      <stop offset="1" stop-color="${light}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g${uid}v" cx=".5" cy=".95" r=".8">
      <stop offset="0" stop-color="#05070a" stop-opacity=".55"/>
      <stop offset="1" stop-color="#05070a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="g${uid}h" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${mid}"/>
    </linearGradient>
    <linearGradient id="g${uid}f" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#141820" stop-opacity=".97"/>
      <stop offset="1" stop-color="#04060a"/>
    </linearGradient>
  </defs>
  <rect width="100" height="140" fill="url(#g${uid})"/>
  ${ridges}
  <ellipse cx="50" cy="62" rx="42" ry="46" fill="url(#g${uid}b)"/>
  ${halo}
  <g fill="url(#g${uid}f)" color="#0a0d12"
     stroke="${light}" stroke-width=".7" stroke-opacity=".5" stroke-linejoin="round">${figure}</g>
  <rect width="100" height="140" fill="url(#g${uid}v)"/>
  ${eyeRing}
  <rect width="100" height="140" fill="none" stroke="${light}" stroke-width=".6" opacity=".18"/>
</svg>`;
}

function escapeAttr(s) { return String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])); }

/** Small faction crest for lists and the village. */
export function crest(factionId, size = 22) {
  const [dark, mid, light] = FACTION_INK[factionId] ?? FACTION_INK.DRG;
  const r = rng(hash(factionId));
  const spokes = 4 + Math.floor(r() * 4);
  const arms = Array.from({ length: spokes }, (_, i) => {
    const a = (i / spokes) * Math.PI * 2;
    return `<line x1="16" y1="16" x2="${16 + Math.cos(a) * 11}" y2="${16 + Math.sin(a) * 11}" stroke="${light}" stroke-width="1.6" opacity=".8"/>`;
  }).join("");
  return `<svg viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 1 L29 6 v11 q0 9-13 14 Q3 26 3 17 V6z" fill="${dark}" stroke="${mid}" stroke-width="1.5"/>
    ${arms}<circle cx="16" cy="16" r="3.4" fill="${mid}"/></svg>`;
}

/** Painted concept art when the unit has one, otherwise the generated portrait. */
export function artFor(unit, opts) {
  // The standalone build inlines the painted plates as data URIs keyed by their path.
  const inlined = globalThis.__ALLYNCE_ART__;
  const painted = inlined
    ? inlined[unit.art?.concept] ?? inlined[unit.art?.cutout]
    : unit.art?.cutout ?? unit.art?.concept;
  if (painted) {
    const src = painted.startsWith("data:") ? painted : `../${painted}`;
    return `<img class="card-art-img" src="${src}" alt="${escapeAttr(unit.name)}" loading="lazy"
      onerror="this.replaceWith(document.createRange().createContextualFragment(this.dataset.fallback))"
      data-fallback="${escapeAttr(portrait(unit, opts))}">`;
  }
  return portrait(unit, opts);
}

export const FACTION_COLOR = Object.fromEntries(
  Object.entries(FACTION_INK).map(([k, v]) => [k, v[1]]));

/**
 * Campaign map.
 *
 * Deliberately cartographic rather than illustrative: survey linework, hachured relief,
 * a graticule, muted ink, and typographic labels. Node state is carried by shape and
 * weight, not by colour alone, so it reads as a staff map rather than a level select.
 */
import { esc } from "../cards.js";
import * as save from "../save.js";

export const CAMPAIGN = [
  { id: "kiln", name: "Kiln Gate", region: "Ashen Provinces", x: 16, y: 66, needs: [],
    enemy: "SAM", strength: 1,
    brief: "A pottery road held by a nominal garrison. The province wants the gate reopened before the kilns go cold.",
    objective: "Break the garrison: reduce the defending platoon to Broken Doctrine.",
    reward: { steel: 260, grain: 180 } },
  { id: "sedge", name: "Sedge Crossing", region: "Ashen Provinces", x: 30, y: 50, needs: ["kiln"],
    enemy: "SHI", strength: 2,
    brief: "Reed cutters have been replaced by people who are not reed cutters. Nothing is where the last survey put it.",
    objective: "Hold both fords for two consecutive End Phases.",
    reward: { steel: 320, grain: 240 } },
  { id: "ivory", name: "Ivory Road", region: "Blue Field", x: 44, y: 64, needs: ["kiln"],
    enemy: "KNI", strength: 2,
    brief: "The supply road for three keeps. Whoever holds the road decides which of the three eats this month.",
    objective: "Control the road hexes at the round limit.",
    reward: { steel: 380, grain: 200 } },
  { id: "briar", name: "Strangling Grove", region: "Thornmarch", x: 34, y: 30, needs: ["sedge"],
    enemy: "THC", strength: 3,
    brief: "Four companies went in. The survey party that followed reported the grove had grown since the last map.",
    objective: "Burn or capture the three briar anchors.",
    reward: { steel: 420, grain: 320, relics: 1 } },
  { id: "ridge", name: "Nine Thermals", region: "Sunder Peak", x: 62, y: 40, needs: ["ivory"],
    enemy: "DRG", strength: 4,
    brief: "Ridge-line airspace claimed by a Host that does not negotiate over altitude.",
    objective: "Ground the wing: defeat every flying unit.",
    reward: { steel: 520, grain: 300, relics: 1 } },
  { id: "column", name: "Standing Column", region: "Split Sky", x: 74, y: 62, needs: ["ivory"],
    enemy: "STM", strength: 4,
    brief: "A column of lightning that has not moved in eleven years, and a clan that measures rank in strikes survived.",
    objective: "Break the column: destroy the two grounding rods.",
    reward: { steel: 560, grain: 380, relics: 1 } },
  { id: "cloister", name: "High Cloister", region: "Sunder Peak", x: 56, y: 18, needs: ["ridge", "briar"],
    enemy: "MNK", strength: 5,
    brief: "The order will not fight you. It will simply be where you intended to walk.",
    objective: "Reach the upper stair with a Commander still standing.",
    reward: { steel: 600, grain: 480, relics: 2 } },
  { id: "threefold", name: "Threefold Invocation", region: "Drowned March", x: 84, y: 30, needs: ["column", "cloister"],
    enemy: "RIT", strength: 6, scenario: "threefold_invocation",
    brief: "Three circles, one sentence, and a cult that has been halfway through saying it for forty years.",
    objective: "Disrupt all three circles before a synchronized release.",
    reward: { steel: 700, grain: 520, relics: 3 } },
  { id: "choir", name: "The Upper Choir", region: "Above", x: 70, y: 8, needs: ["threefold"],
    enemy: "ANG", strength: 7,
    brief: "The Host has issued no demand and answered no messenger. It has only formed up, and it is forming up above you.",
    objective: "Survive eight rounds, then break the choir's anchor.",
    reward: { steel: 900, grain: 700, relics: 4 } },
];

export function mapView(root, { data, go, toast }) {
  const s = save.load();
  const cleared = new Set(s.campaign.cleared ?? []);
  const open = (n) => n.needs.every((d) => cleared.has(d));
  let selected = CAMPAIGN.find((n) => open(n) && !cleared.has(n.id)) ?? CAMPAIGN[0];

  root.innerHTML = `
    <div class="view-head">
      <div><h1>Campaign</h1>
        <p>Operational survey of the contested provinces. Cleared objectives are struck through;
           an unlocked objective can be deployed against with your current deck.</p></div>
    </div>
    <div class="map-layout">
      <div class="map-frame" id="frame"></div>
      <aside class="panel" id="brief"></aside>
    </div>`;

  const frame = root.querySelector("#frame");
  const brief = root.querySelector("#brief");

  function drawMap() {
    const graticule = Array.from({ length: 9 }, (_, i) =>
      `<line x1="${i * 12.5}" y1="0" x2="${i * 12.5}" y2="80" stroke="#1d232c" stroke-width=".18"/>
       <line x1="0" y1="${i * 10}" x2="100" y2="${i * 10}" stroke="#1d232c" stroke-width=".18"/>`).join("");

    const relief = [
      "M8 22 q12-9 24-3 t22 -4 q14-3 24 5",
      "M6 34 q14-8 26-2 t24 -3 q13-2 22 6",
      "M14 12 q10-6 20-2 t18 -3",
      "M46 54 q12-6 22 0 t20 -2",
      "M10 58 q14 6 24 1 t20 3",
    ].map((d, i) => `<path d="${d}" fill="none" stroke="#242c36" stroke-width=".3" opacity="${0.8 - i * 0.09}"/>`).join("");

    const rivers = `
      <path d="M0 44 q18 5 28 -1 t22 6 q14 5 26 -2 T100 52" fill="none" stroke="#2b3a46" stroke-width=".55" opacity=".8"/>
      <path d="M38 80 q4-16 -2 -26 t6 -20" fill="none" stroke="#2b3a46" stroke-width=".4" opacity=".6"/>`;

    const links = CAMPAIGN.flatMap((n) => n.needs.map((d) => {
      const from = CAMPAIGN.find((x) => x.id === d);
      const live = cleared.has(d);
      return `<line x1="${from.x}" y1="${from.y}" x2="${n.x}" y2="${n.y}"
        stroke="${live ? "#4d5a6b" : "#252c36"}" stroke-width=".4" stroke-dasharray="${live ? "" : "1.4 1.4"}"/>`;
    })).join("");

    const nodes = CAMPAIGN.map((n) => {
      const done = cleared.has(n.id);
      const avail = open(n);
      const cls = `node${avail ? "" : " locked"}`;
      const mark = done
        ? `<path d="M${n.x - 1.4} ${n.y - 1.4} l2.8 2.8 M${n.x + 1.4} ${n.y - 1.4} l-2.8 2.8" stroke="#7d8a99" stroke-width=".45"/>`
        : avail
          ? `<rect x="${n.x - 1.15}" y="${n.y - 1.15}" width="2.3" height="2.3" fill="#c8a45c" transform="rotate(45 ${n.x} ${n.y})"/>`
          : `<circle cx="${n.x}" cy="${n.y}" r="1.1" fill="none" stroke="#3b444f" stroke-width=".35"/>`;
      return `<g class="${cls}" data-node="${n.id}" tabindex="0" role="button" aria-label="${esc(n.name)}">
        <circle class="node-ring" cx="${n.x}" cy="${n.y}" r="2.8" fill="none"
          stroke="${selected.id === n.id ? "#c8a45c" : "#39424e"}" stroke-width=".45"/>
        ${mark}
        <text class="node-label" x="${n.x}" y="${n.y - 3.7}" text-anchor="middle"
          ${done ? 'text-decoration="line-through" opacity=".55"' : ""}>${esc(n.name)}</text>
        <text class="node-sub" x="${n.x}" y="${n.y + 5.2}" text-anchor="middle">${esc(n.region)}</text>
      </g>`;
    }).join("");

    frame.innerHTML = `<svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Campaign map">
      <rect width="100" height="80" fill="#10131a"/>
      ${graticule}${relief}${rivers}${links}${nodes}
      <g opacity=".6">
        <line x1="4" y1="76" x2="16" y2="76" stroke="#4d5a6b" stroke-width=".4"/>
        <line x1="4" y1="75" x2="4" y2="77" stroke="#4d5a6b" stroke-width=".4"/>
        <line x1="16" y1="75" x2="16" y2="77" stroke="#4d5a6b" stroke-width=".4"/>
        <text x="4" y="74" style="font-size:1.5px;fill:#6b7383">40 leagues</text>
        <text x="88" y="76" style="font-size:1.6px;fill:#6b7383">N</text>
        <path d="M92 77 l0-4 l1.4 1.6" fill="none" stroke="#6b7383" stroke-width=".3"/>
      </g>
    </svg>`;
  }

  function drawBrief() {
    const n = selected;
    const done = cleared.has(n.id);
    const avail = open(n);
    const f = data.faction(n.enemy);
    const deck = save.deck();
    brief.innerHTML = `
      <div class="panel-head"><h3>${esc(n.name)}</h3><span class="count">${esc(n.region)}</span></div>
      <div class="panel-body">
        <p class="muted">${esc(n.brief)}</p>
        <div class="detail-list">
          <div><span class="k">Opposition</span><span class="v">${esc(f.name)}</span></div>
          <div><span class="k">Assessed strength</span><span class="v">${"▮".repeat(n.strength)}${"▯".repeat(7 - n.strength)}</span></div>
          <div><span class="k">Objective</span><span class="v" style="text-align:right;max-width:60%">${esc(n.objective)}</span></div>
          <div><span class="k">Reward</span><span class="v">${Object.entries(n.reward).map(([k, v]) => `${v} ${k}`).join(", ")}</span></div>
          <div><span class="k">Status</span><span class="v">${done ? "Cleared" : avail ? "Open" : "Locked"}</span></div>
          ${!avail ? `<div><span class="k">Requires</span><span class="v">${n.needs.map((d) => esc(CAMPAIGN.find((x) => x.id === d).name)).join(", ")}</span></div>` : ""}
          <div><span class="k">Your deck</span><span class="v">${deck.units.length} units</span></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn btn-primary" id="deploy" ${avail ? "" : "disabled"}>${done ? "Redeploy" : "Deploy"}</button>
          <button class="btn" id="edit">Edit deck</button>
        </div>
      </div>`;

    brief.querySelector("#edit").addEventListener("click", () => go("muster"));
    brief.querySelector("#deploy").addEventListener("click", () => {
      if (deck.units.length < 8) return toast("Your deck needs at least 8 units before you can deploy.", true);
      save.update((st) => { st.campaign.current = n.id; });
      go("battle", { node: n.id });
    });
  }

  const select = (id) => {
    const n = CAMPAIGN.find((x) => x.id === id);
    if (!n) return;
    selected = n;
    drawMap();
    drawBrief();
  };

  frame.addEventListener("click", (e) => { const g = e.target.closest("[data-node]"); if (g) select(g.dataset.node); });
  frame.addEventListener("keydown", (e) => {
    const g = e.target.closest("[data-node]");
    if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(g.dataset.node); }
  });

  drawMap();
  drawBrief();
}

/** Card rendering. Everything that draws a unit goes through here. */
import { artFor, crest } from "./art.js";

export const esc = (s) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

function starRow(n) {
  const pips = Array.from({ length: 10 }, (_, i) => `<i class="star${i < n ? "" : " off"}"></i>`).join("");
  return `<div class="stars" aria-label="${n} of 10 stars">${pips}<span class="n">${n}</span></div>`;
}

function badges(u) {
  const out = [];
  if (u.flying) out.push('<span class="badge fly">Flying</span>');
  if (u.fusion) out.push(`<span class="badge fusion">${esc(u.fusion.label)}</span>`);
  if (u.uniqueLimit === 1) out.push('<span class="badge one">1 copy</span>');
  if (u.stars === 10) out.push('<span class="badge one">Ascendant</span>');
  return out.slice(0, 3).join("");
}

/** Full card. `extra` is appended into the footer (quantity controls, etc). */
export function unitCard(u, { selected = false, extra = "" } = {}) {
  return `<button class="card${selected ? " is-selected" : ""}" data-unit="${esc(u.id)}" data-stars="${u.stars}" type="button">
    <div class="card-head">
      ${starRow(u.stars)}
      <span class="card-name">${esc(u.name)}</span>
      <span class="card-sub">${esc(u.tier)} · ${esc(u.rank)}</span>
    </div>
    <div class="card-art">${artFor(u)}<div class="card-badges">${badges(u)}</div></div>
    <div class="card-stats">
      <div><span class="k">HP</span><span class="v">${u.hp}</span></div>
      <div><span class="k">ATK</span><span class="v">${u.atk}</span></div>
      <div><span class="k">DEF</span><span class="v">${u.def}</span></div>
      <div><span class="k">MOV</span><span class="v">${u.mov}</span></div>
    </div>
    <div class="card-foot"><span class="cls">${esc(u.className)}</span><span class="cost">${u.capacityCost} cap</span>${extra}</div>
  </button>`;
}

/** Compact row for lists where the art is a thumbnail. */
export function unitRow(u, { qty = "", action = "" } = {}) {
  return `<button class="row-card" data-unit="${esc(u.id)}" data-stars="${u.stars}" type="button">
    <span class="thumb">${artFor(u, { w: 40, h: 50 })}</span>
    <span class="meta"><b>${esc(u.name)}</b><span>${u.stars}★ · ${esc(u.className)} · ${u.capacityCost} cap</span></span>
    <span class="qty">${qty}${action}</span>
  </button>`;
}

/** Detail sheet: the full stat block, lore and ability text. */
export function unitSheet(u, data) {
  const abil = (id, sig) => {
    const a = data.ability(id);
    if (!a) return "";
    const cost = [a.apCost !== undefined ? `${a.apCost} AP` : "", a.cooldown ? `CD ${a.cooldown}` : "", a.range ? `Range ${a.range}` : ""]
      .filter(Boolean).join(" · ");
    return `<div class="ability${sig ? " sig" : ""}">
      <h4>${esc(a.name)} <span class="tag">${esc(a.category)}</span>${sig ? '<span class="tag" style="border-color:var(--accent-dim);color:var(--accent)">Signature</span>' : ""}</h4>
      ${cost ? `<div class="faint mono" style="font-size:11px">${cost}</div>` : ""}
      <p>${esc(a.text)}</p></div>`;
  };
  const f = data.faction(u.faction);
  return `<div class="sheet-backdrop" data-close="1"><article class="sheet" role="dialog" aria-label="${esc(u.name)}">
    <div class="sheet-top">
      <div class="sheet-art">${artFor(u, { w: 220, h: 275 })}</div>
      <div class="sheet-info">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div>
            ${starRow(u.stars)}
            <h2 style="margin:6px 0 2px">${esc(u.name)}</h2>
            <div class="faint" style="font-size:11px;letter-spacing:.1em;text-transform:uppercase">
              ${esc(u.tier)} · ${esc(u.className)} · ${esc(f.name)}</div>
          </div>
          <button class="btn btn-sm" data-close="1">Close</button>
        </div>
        ${u.lore ? `<p class="sheet-lore">${esc(u.lore)}</p>` : ""}
        <div class="statline">
          <div><span class="k">HP</span><span class="v">${u.hp}</span></div>
          <div><span class="k">ATK</span><span class="v">${u.atk}</span></div>
          <div><span class="k">DEF</span><span class="v">${u.def}</span></div>
          <div><span class="k">MOV</span><span class="v">${u.mov}</span></div>
          <div><span class="k">Range</span><span class="v">${u.range}</span></div>
          <div><span class="k">Init</span><span class="v">${u.initiative}</span></div>
          <div><span class="k">Morale</span><span class="v">${u.morale}</span></div>
          <div><span class="k">Cap</span><span class="v">${u.capacityCost}</span></div>
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:10px">
          ${u.themes.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
          ${(u.keywords ?? []).map((k) => `<span class="tag">${esc(k)}</span>`).join("")}
          ${u.flying ? '<span class="tag">Flying</span>' : ""}
          ${u.uniqueLimit === 1 ? '<span class="tag">One copy per army</span>' : ""}
        </div>
        ${u.divine ? `<div class="ability sig" style="margin-top:12px"><h4>Ascendant Manifestation</h4>
          <p>${esc(u.divine.arrival)}</p>
          <p class="faint">Manifestation ${u.divine.manifestation} · Anchors ${u.divine.anchors}. At zero hit points this unit staggers; it is only removed once every Anchor is broken.</p></div>` : ""}
        ${u.actives.map((id) => abil(id, id === u.signature)).join("")}
        ${u.passives.map((id) => abil(id, false)).join("")}
      </div>
    </div>
  </article></div>`;
}

export { crest };

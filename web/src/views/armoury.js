/** Armoury: browse the whole roster with filters. Read-only reference view. */
import { unitCard, esc } from "../cards.js";

const SORTS = {
  stars: (a, b) => b.stars - a.stars || a.name.localeCompare(b.name),
  name: (a, b) => a.name.localeCompare(b.name),
  atk: (a, b) => b.atk - a.atk,
  def: (a, b) => b.def - a.def,
  cost: (a, b) => b.capacityCost - a.capacityCost,
};

export function armouryView(root, { data }) {
  const factions = Object.values(data.factions).sort((a, b) => a.name.localeCompare(b.name));
  const classes = [...data.classes.keys()].sort();
  const state = { q: "", faction: "", cls: "", stars: "", sort: "stars", flying: false };

  root.innerHTML = `
    <div class="view-head">
      <div>
        <h1>Armoury</h1>
        <p>Every unit in the game: ${data.units.length} across ${factions.length} factions.
           Open a card for its full stat block, lore and ability text.</p>
      </div>
    </div>
    <div class="filters">
      <div class="field grow"><label for="f-q">Search</label>
        <input id="f-q" type="search" placeholder="Name, class, keyword or lore"></div>
      <div class="field"><label for="f-fac">Faction</label><select id="f-fac">
        <option value="">All</option>${factions.map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join("")}
      </select></div>
      <div class="field"><label for="f-cls">Class</label><select id="f-cls">
        <option value="">All</option>${classes.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}
      </select></div>
      <div class="field"><label for="f-star">Stars</label><select id="f-star">
        <option value="">Any</option>${Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => `<option value="${n}">${n}★${n === 10 ? " (Ascendant)" : ""}</option>`).join("")}
      </select></div>
      <div class="field"><label for="f-sort">Sort</label><select id="f-sort">
        <option value="stars">Star rating</option><option value="name">Name</option>
        <option value="atk">Attack</option><option value="def">Defence</option><option value="cost">Capacity</option>
      </select></div>
      <div class="field"><label for="f-fly">Movement</label>
        <select id="f-fly"><option value="">All</option><option value="1">Flying only</option><option value="0">Ground only</option></select></div>
      <span class="count" id="count"></span>
    </div>
    <div class="card-grid" id="grid"></div>`;

  const grid = root.querySelector("#grid");
  const count = root.querySelector("#count");

  function apply() {
    const q = state.q.trim().toLowerCase();
    const list = data.units.filter((u) => {
      if (state.faction && u.faction !== state.faction) return false;
      if (state.cls && u.className !== state.cls) return false;
      if (state.stars && u.stars !== +state.stars) return false;
      if (state.flying === "1" && !u.flying) return false;
      if (state.flying === "0" && u.flying) return false;
      if (!q) return true;
      return [u.name, u.className, u.tier, u.rank, u.lore, ...(u.keywords ?? []), ...u.themes]
        .join(" ").toLowerCase().includes(q);
    }).sort(SORTS[state.sort]);

    count.textContent = `${list.length} unit${list.length === 1 ? "" : "s"}`;
    grid.innerHTML = list.length
      ? list.map((u) => unitCard(u)).join("")
      : `<div class="empty" style="grid-column:1/-1">No unit matches those filters.</div>`;
  }

  const bind = (sel, key) => root.querySelector(sel).addEventListener("input", (e) => { state[key] = e.target.value; apply(); });
  bind("#f-q", "q"); bind("#f-fac", "faction"); bind("#f-cls", "cls");
  bind("#f-star", "stars"); bind("#f-sort", "sort"); bind("#f-fly", "flying");
  apply();
}

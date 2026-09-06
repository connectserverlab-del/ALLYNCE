/**
 * Muster: the inventory on the left, the deck on the right.
 *
 * The inventory holds every unit the player owns. Sorting cards into the deck is the
 * only way a unit reaches the battlefield, and the deck panel validates continuously
 * against the same composition rules the sim enforces.
 */
import { unitCard, unitRow, esc } from "../cards.js";
import * as save from "../save.js";
import { validateDeck, canAdd, autoFill, deckStats, CAPACITY } from "../engine/army.js";

export function musterView(root, { data, go, toast }) {
  const state = { q: "", slot: "", sort: "stars" };

  root.innerHTML = `
    <div class="view-head">
      <div>
        <h1>Muster</h1>
        <p>Your inventory is everything you own. Your deck is the eight-or-more units you take
           into battle. Add from the left, drop from the right; the panel checks the army list as you go.</p>
      </div>
    </div>
    <div class="deck-layout">
      <section>
        <div class="filters">
          <div class="field grow"><label for="m-q">Search inventory</label>
            <input id="m-q" type="search" placeholder="Name, class or keyword"></div>
          <div class="field"><label for="m-slot">Slot</label><select id="m-slot">
            <option value="">All slots</option>
            <option value="Commander">Commander</option><option value="Second">Second</option>
            <option value="Elite">Elite</option><option value="FootSoldier">Foot soldier</option>
            <option value="Specialist">Specialist</option></select></div>
          <div class="field"><label for="m-sort">Sort</label><select id="m-sort">
            <option value="stars">Star rating</option><option value="name">Name</option>
            <option value="cost">Capacity</option></select></div>
          <span class="count" id="m-count"></span>
        </div>
        <div class="card-grid" id="inv"></div>
      </section>

      <aside class="panel deck-panel">
        <div class="panel-head"><h3 id="deck-name">Deck</h3><span class="count" id="deck-count"></span></div>
        <div class="deck-meter" id="meter"></div>
        <div class="deck-list" id="deck"></div>
        <div class="deck-issues" id="issues"></div>
        <div class="deck-actions">
          <button class="btn btn-primary" id="fight">Take to battle</button>
          <button class="btn btn-sm" id="auto">Auto-fill</button>
          <button class="btn btn-sm" id="clear">Clear</button>
        </div>
      </aside>
    </div>`;

  const inv = root.querySelector("#inv");
  const deckList = root.querySelector("#deck");

  function render() {
    const s = save.load();
    const deck = save.deck();
    const q = state.q.trim().toLowerCase();

    /* ------------------------------------------------------------ inventory */
    const ownedIds = Object.entries(s.inventory).filter(([, n]) => n > 0);
    let list = ownedIds.map(([id, n]) => ({ u: data.unit(id), n })).filter((x) => x.u);
    if (state.slot) list = list.filter((x) => x.u.slots.includes(state.slot));
    if (q) list = list.filter((x) => [x.u.name, x.u.className, x.u.tier, ...(x.u.keywords ?? [])].join(" ").toLowerCase().includes(q));
    list.sort(state.sort === "name" ? (a, b) => a.u.name.localeCompare(b.u.name)
      : state.sort === "cost" ? (a, b) => b.u.capacityCost - a.u.capacityCost
        : (a, b) => b.u.stars - a.u.stars || a.u.name.localeCompare(b.u.name));

    root.querySelector("#m-count").textContent = `${list.length} entr${list.length === 1 ? "y" : "ies"}`;
    inv.innerHTML = list.length ? list.map(({ u, n }) => {
      const used = deck.units.filter((x) => x === u.id).length;
      const blocked = canAdd(u.id, deck, data, n);
      return unitCard(u, {
        selected: used > 0,
        extra: `<span class="cost" style="color:var(--text-dim)">${used}/${n}</span>
          <button class="qty-btn" data-act="add" data-id="${esc(u.id)}"
            ${blocked ? `disabled title="${esc(blocked)}"` : 'title="Add to deck"'}>+</button>`,
      });
    }).join("") : `<div class="empty" style="grid-column:1/-1">Nothing in your inventory matches.
      Recruit at the village to add units.</div>`;

    /* ----------------------------------------------------------------- deck */
    const stats = deckStats(deck, data);
    const check = validateDeck(deck, data);
    root.querySelector("#deck-name").textContent = deck.name;
    root.querySelector("#deck-count").textContent = `${deck.units.length} units`;

    const pct = Math.min(100, (stats.capacity / CAPACITY) * 100);
    root.querySelector("#meter").innerHTML = `
      <div class="meter-row"><span>Army Capacity</span><b>${stats.capacity} / ${CAPACITY}</b></div>
      <div class="meter${stats.capacity > CAPACITY ? " over" : ""}"><i style="width:${pct}%"></i></div>
      <div class="meter-row"><span>Dominant theme</span><b>${esc(check.dominantTheme ?? "—")}</b></div>`;

    const grouped = [...stats.counts.entries()].map(([id, n]) => ({ u: data.unit(id), n }))
      .filter((x) => x.u).sort((a, b) => b.u.stars - a.u.stars);
    deckList.innerHTML = grouped.length ? grouped.map(({ u, n }) => unitRow(u, {
      qty: `<span class="mono">×${n}</span> `,
      action: `<button class="qty-btn" data-act="remove" data-id="${esc(u.id)}" title="Remove one">−</button>`,
    })).join("") : `<div class="empty">Empty deck. Add eight units, or use Auto-fill.</div>`;

    root.querySelector("#issues").innerHTML = check.errors.length || check.warnings.length
      ? `<ul>${check.errors.map((e) => `<li>${esc(e)}</li>`).join("")}
          ${check.warnings.map((w) => `<li class="muted">${esc(w)}</li>`).join("")}</ul>`
      : `<ul><li class="ok">Legal army list. Full Platoon Doctrine available.</li></ul>`;
    root.querySelector("#fight").disabled = !check.ok;
  }

  /* -------------------------------------------------------------- handlers */
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    e.stopPropagation();
    const id = btn.dataset.id;
    if (btn.dataset.act === "add") {
      const reason = canAdd(id, save.deck(), data, save.owned(id));
      if (reason) return toast(reason, true);
      save.update((s) => { s.decks[s.activeDeck].units.push(id); });
      render();
    }
    if (btn.dataset.act === "remove") {
      save.update((s) => {
        const arr = s.decks[s.activeDeck].units;
        const i = arr.indexOf(id);
        if (i >= 0) arr.splice(i, 1);
      });
      render();
    }
  });

  root.querySelector("#auto").addEventListener("click", () => {
    save.update((s) => { autoFill(s.decks[s.activeDeck], data, s.inventory); });
    render();
    toast("Auto-filled from your inventory, strongest legal choice first.");
  });
  root.querySelector("#clear").addEventListener("click", () => {
    save.update((s) => { s.decks[s.activeDeck].units = []; });
    render();
  });
  root.querySelector("#fight").addEventListener("click", () => go("battle"));

  const bind = (sel, key) => root.querySelector(sel).addEventListener("input", (e) => { state[key] = e.target.value; render(); });
  bind("#m-q", "q"); bind("#m-slot", "slot"); bind("#m-sort", "sort");
  render();
}

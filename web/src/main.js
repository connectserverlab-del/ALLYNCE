/** App shell: data load, routing, shared card interactions. */
import { loadGameData } from "./data.js";
import { unitSheet } from "./cards.js";
import * as save from "./save.js";

import { armouryView } from "./views/armoury.js";
import { musterView } from "./views/muster.js";
import { villageView } from "./views/village.js";
import { mapView } from "./views/map.js";
import { guideView } from "./views/guide.js";
import { battleView } from "./views/battle.js";

const ROUTES = [
  { id: "guide", label: "Guide", render: guideView },
  { id: "map", label: "Campaign", render: mapView },
  { id: "village", label: "Village", render: villageView },
  { id: "muster", label: "Deck", render: musterView },
  { id: "armoury", label: "Armoury", render: armouryView },
  { id: "battle", label: "Battle", render: battleView },
];

const el = {
  boot: document.getElementById("boot"),
  bar: document.querySelector(".topbar"),
  tabs: document.getElementById("tabs"),
  purse: document.getElementById("purse"),
  view: document.getElementById("view"),
  toast: document.getElementById("toast"),
};

export let data = null;
let current = null;

export function toast(message, bad = false) {
  el.toast.textContent = message;
  el.toast.classList.toggle("bad", bad);
  el.toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.toast.classList.remove("show"), 2600);
}

export function go(route, params = {}) {
  const q = new URLSearchParams(params).toString();
  location.hash = `#/${route}${q ? `?${q}` : ""}`;
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "") || "guide";
  const [id, query] = raw.split("?");
  const found = ROUTES.find((r) => r.id === id) ?? ROUTES[0];
  return { route: found, params: Object.fromEntries(new URLSearchParams(query ?? "")) };
}

function renderTabs(activeId) {
  el.tabs.innerHTML = ROUTES.map((r) =>
    `<button class="tab" data-route="${r.id}"${r.id === activeId ? ' aria-current="page"' : ""}>${r.label}</button>`).join("");
}

function renderPurse() {
  const r = save.load().resources;
  el.purse.innerHTML = `<span>Steel <b>${r.steel}</b></span><span>Grain <b>${r.grain}</b></span><span>Relics <b>${r.relics}</b></span>`;
}

async function render() {
  const { route, params } = parseHash();
  current?.destroy?.();
  renderTabs(route.id);
  renderPurse();
  el.view.innerHTML = "";
  current = route.render(el.view, { data, params, go, toast }) ?? null;
  el.view.scrollTop = 0;
  window.scrollTo(0, 0);
}

/* ------------------------------------------------- shared card interactions */
function openSheet(unitId) {
  const u = data.unit(unitId);
  if (!u) return;
  const host = document.createElement("div");
  host.innerHTML = unitSheet(u, data);
  const backdrop = host.firstElementChild;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
  });
}

document.addEventListener("click", (e) => {
  const tab = e.target.closest("[data-route]");
  if (tab) { go(tab.dataset.route); return; }
  // A card opens its stat sheet unless the click landed on a control inside it.
  const card = e.target.closest("[data-unit]");
  if (card && !e.target.closest("[data-act]")) openSheet(card.dataset.unit);
});

window.addEventListener("hashchange", render);
save.subscribe(renderPurse);

/* -------------------------------------------------------------------- boot */
(async () => {
  try {
    data = await loadGameData();
    seedStarterInventory();
    el.boot.hidden = true;
    el.bar.hidden = false;
    el.view.hidden = false;
    await render();
  } catch (err) {
    el.boot.innerHTML = `<div style="text-align:center;max-width:52ch">
      <p style="color:var(--danger)">${err.message}</p>
      <p class="faint">The page loads game data over fetch, so it needs to be served over HTTP.
      Run <code>npm run web</code> from the repository root and open the address it prints.</p></div>`;
  }
})();

/** First run: a playable starting force so the deck and inventory are not empty. */
function seedStarterInventory() {
  const s = save.load();
  if (Object.keys(s.inventory).length) return;
  const starters = [
    ["SAM_COMMANDER_EMBER-BANNER-DAIMYO", 1], ["SAM_SECOND_WHITE-CRANE-RETAINER", 1],
    ["SAM_ELITE_ONI-GATE-CHAMPION", 1], ["SAM_FOOT_EMBERLINE-ASHIGARU", 6],
    ["SAM_FOOT_ASH-PIKE-CONSCRIPT", 4], ["SAM_RANGED_EMBERLINE-ARCHER", 2],
    ["KNI_FOOT_IVORY-BASTION-MAN-AT-ARMS", 4], ["KNI_GUARD_GATE-OATH-SERGEANT", 2],
    ["SHI_SCOUT_DITCH-LANTERN-SCOUT", 3], ["SHI_SCOUT_SEDGE-MASK-INFILTRATOR", 2],
    ["MNK_FOOT_STAFF-FORM-BROTHER", 2], ["DRG_WING_CLIFF-NEST-FLEDGLING", 2],
  ];
  save.update((st) => {
    for (const [id, n] of starters) if (data.byId.has(id)) st.inventory[id] = n;
    st.decks.deck1 = { name: "First Muster", units: [] };
    st.log.unshift({ t: Date.now(), text: "The muster roll opens. A starting force has been assigned to your inventory." });
  });
}

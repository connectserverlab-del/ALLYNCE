/**
 * Guide: the field manual. Teaches the game from a standing start, then doubles as the
 * rules reference. Numbers here are pulled from the live rules data so the manual cannot
 * drift out of date when the tables change.
 */
import { esc } from "../cards.js";

export function guideView(root, { data, go }) {
  const coh = data.rules.themeCohesion;
  const doc = data.rules.standardPlatoon.doctrine;
  const slots = data.rules.standardPlatoon.slots;

  const SECTIONS = [
    ["start", "Your first battle", () => `
      <h3>Your first battle</h3>
      <p>ALLYNCE is a turn-based tactical game about <strong>keeping a formation together</strong>.
        Individual units are not very strong. Units standing next to the right neighbours are.</p>
      <ol class="steps">
        <li><div><strong>Open the Muster screen.</strong> The left side is your inventory — everything you own.
          The right side is your deck — the units you will actually take into battle.</div></li>
        <li><div><strong>Press Auto-fill.</strong> It builds a legal eight from what you own:
          one Commander, one Second, one Elite and five foot soldiers.
          Then read the checklist under the deck; it explains anything still wrong.</div></li>
        <li><div><strong>Go to the Campaign map</strong> and pick the open objective — the brass diamond.
          Read the briefing: it tells you the opposition and what winning means here.</div></li>
        <li><div><strong>Deploy.</strong> On the battle screen, click one of your units, then click
          a highlighted hex to move, or an adjacent enemy to attack. Each unit gets 2 action points.</div></li>
        <li><div><strong>Keep your units adjacent.</strong> Every neighbouring ally of the same theme
          is worth <code>+${coh.perAdjacentAlly}</code> to attack and defence. A lone unit is a dead unit.</div></li>
        <li><div><strong>End the round</strong> when your units are spent. Win the objective, collect the
          reward, and spend it at the Village on more units.</div></li>
      </ol>
      <div class="callout">If you take one thing from this manual: <strong>a broken formation loses to a
        worse army that kept its shape.</strong> Everything below is a consequence of that.</div>`],

    ["turn", "The turn", () => `
      <h3>The turn</h3>
      <p>A round has four phases, always in this order.</p>
      <table>
        <tr><th>Phase</th><th>What happens</th></tr>
        <tr><td>Command</td><td>Succession resolves if a Commander fell. Each platoon may issue one order.</td></tr>
        <tr><td>Activation</td><td>Sides alternate activating one platoon at a time. Each unit has <strong>2 action points</strong>.</td></tr>
        <tr><td>Objective</td><td>Rituals tick, portals open or close, objectives are scored.</td></tr>
        <tr><td>End</td><td>Statuses expire, clones expire, morale settles, victory is checked.</td></tr>
      </table>
      <p>Actions cost 1 AP each: <strong>Move</strong>, <strong>Attack</strong>, <strong>Defend</strong>
        (+150 DEF), <strong>Overwatch</strong> (shoot the first enemy that enters range),
        <strong>Rally</strong> (recover morale), <strong>Disengage</strong> (leave contact without being hit),
        <strong>Assist</strong> or <strong>Capture</strong>. Turning to face costs nothing before you move.</p>`],

    ["cards", "Cards and star ratings", () => `
      <h3>Cards and star ratings</h3>
      <p>Every unit card carries the same information in the same places: star rating and name at the top,
        art in the middle, the four combat numbers beneath it, and class and capacity cost at the foot.</p>
      <table>
        <tr><th>Stars</th><th>Tier</th><th>What it means</th></tr>
        <tr><td class="mono">1–3</td><td>Levy, Regular, Veteran</td><td>Line troops. Cheap enough to field five of.</td></tr>
        <tr><td class="mono">4–6</td><td>Chosen, Vanguard, Exemplar</td><td>The working core of most armies.</td></tr>
        <tr><td class="mono">7–9</td><td>Paragon, Legend, Mythic</td><td>Army-shaping. Expensive in Army Capacity.</td></tr>
        <tr><td class="mono">10</td><td>Ascendant</td><td>A different category of thing. See below.</td></tr>
      </table>
      <h3>Ascendants</h3>
      <p>Ten-star units are deliberately off the curve rather than one step up it. They:</p>
      <ul>
        <li>carry a <strong>signature ability</strong> no other unit has;</li>
        <li><strong>stagger instead of dying</strong> at zero hit points — they must have every Anchor broken;</li>
        <li>fight without needing Theme Cohesion, Doctrine or a command aura at all;</li>
        <li>change the battlefield on arrival, in a way written on the card;</li>
        <li>are limited to <strong>one Ascendant per army</strong>, and one copy of that unit.</li>
      </ul>
      <div class="callout">Some units below ten stars are also one-copy: every <strong>archangel</strong>
        by name, and several named monastic holders. The deck panel enforces this for you.</div>`],

    ["cohesion", "Theme Cohesion", () => `
      <h3>Theme Cohesion</h3>
      <p>The central mechanic. For each adjacent ally that shares a theme with a unit, that unit gains
        <code>+${coh.perAdjacentAlly}</code> to both ATK and DEF, counting at most
        <code>${coh.maxConnections}</code> neighbours — a maximum of
        <code>+${coh.perAdjacentAlly * coh.maxConnections}</code>.</p>
      <ul>
        <li>Clones never grant cohesion.</li>
        <li>A <strong>Disordered</strong> unit caps its cohesion at <code>+${coh.disorderedCap}</code>.</li>
        <li><strong>Fusion units count for both parent themes</strong>, which is the whole reason to field one:
          a Dragonknight bridges a Knight line and a Dragon wing into one cohesive block.</li>
      </ul>
      <p>This is why formation shape matters more than unit quality, and why flanking a formation
        apart is usually better than killing its best unit.</p>`],

    ["doctrine", "Platoon Doctrine", () => `
      <h3>Platoon Doctrine</h3>
      <p>A standard platoon is ${slots.Commander} Commander, ${slots.Second} Second, ${slots.Elite} Elite
        and ${slots.FootSoldier} foot soldiers — ${data.rules.standardPlatoon.total} units.
        How much of it survives sets the Doctrine state:</p>
      <table>
        <tr><th>State</th><th>Requires</th><th>Bonus</th></tr>
        <tr><td>Full</td><td>Leader, Elite, ${doc.full.minFoot}+ foot</td><td class="mono">+${doc.full.atk} ATK / +${doc.full.def} DEF</td></tr>
        <tr><td>Reduced</td><td>Leader, Elite, ${doc.reduced.minFoot}+ foot</td><td class="mono">+${doc.reduced.atk} ATK / +${doc.reduced.def} DEF</td></tr>
        <tr><td>Broken</td><td>anything less</td><td class="mono">nothing</td></tr>
      </table>
      <p>Losing your fifth foot soldier costs the whole platoon
        <code>${doc.full.atk - doc.reduced.atk}</code> ATK. Foot soldiers are not filler.</p>`],

    ["command", "Command and succession", () => `
      <h3>Command and succession</h3>
      <p>A Commander projects an aura inside its command radius. <strong>Auras never stack</strong> —
        only the strongest eligible one applies.</p>
      <p>When a Commander falls, Doctrine keeps running for one round (<em>Continuity</em>), and in the next
        Command Phase the <strong>Second is promoted</strong>. The promoted unit inherits the orders and keeps
        its own ability, and any Succession-category ability fires at that moment: a rally, a smoke screen,
        a defensive wall, a free reposition.</p>
      <div class="callout">Killing the Second before the Commander is usually the stronger play. It takes the
        recovery away before you take the leader.</div>`],

    ["combat", "Combat maths", () => `
      <h3>Combat maths</h3>
      <p>There are no dice. Damage is <code>max(100, ATK − DEF)</code>, and both numbers come from the
        same pipeline:</p>
      <p class="mono" style="background:var(--ink);border:1px solid var(--line);padding:10px;border-radius:3px">
        Final = Base + Theme&nbsp;Cohesion + Composition + Command + Status + Terrain + abilities</p>
      <ul>
        <li>Attacking a <strong>flank</strong> reduces the defender's DEF by 10%; the <strong>rear</strong>, by 25%.</li>
        <li><strong>Defend</strong> is +150 DEF; a <strong>Fortification</strong> is +200; <strong>high ground</strong> is +100 ATK for ranged.</li>
        <li>Leaving an enemy's zone of control provokes a free attack unless you spend the extra AP to Disengage.</li>
        <li>Every contribution is tagged with its source, so a unit's tooltip shows you exactly where its numbers came from.</li>
      </ul>`],

    ["morale", "Morale", () => `
      <h3>Morale</h3>
      <p>Morale runs 0–100 in five bands: <strong>Steady</strong>, <strong>Shaken</strong> (−50 to ATK and DEF),
        <strong>Disordered</strong> (cohesion capped), <strong>Routed</strong> (the AI takes the unit and retreats it),
        and <strong>Broken</strong>.</p>
      <p>Morale falls when allies die nearby, when a Commander falls, when a unit is surrounded, and when
        something arrives that should not exist. It recovers by rallying, by winning an exchange, and by
        standing next to an intact formation.</p>`],

    ["terrain", "Terrain, flight and anti-air", () => `
      <h3>Terrain, flight and anti-air</h3>
      <ul>
        <li><strong>Forest</strong> and <strong>Smoke</strong> conceal; <strong>High Ground</strong> extends ranged reach;
          <strong>Fortification</strong> adds defence; <strong>Water</strong> blocks ground movement.</li>
        <li><strong>Flying units ignore ground terrain entirely</strong> — cost, cover and defence bonuses alike.
          They also gain nothing from it.</li>
        <li><strong>Anti-air</strong> hexes and binding rituals are the answer. Against the Angelic Host, where
          every single unit flies, one anti-air position can decide the battle.</li>
      </ul>`],

    ["deck", "Building a deck", () => `
      <h3>Building a deck</h3>
      <p>Your <strong>inventory</strong> is everything you own. Your <strong>deck</strong> is what you take
        into battle, and it is limited by <strong>Army Capacity</strong>, not by unit count — a single
        Ascendant costs as much as a squad.</p>
      <ol class="steps">
        <li><div>Fill the four slots first: Commander, Second, Elite, five foot soldiers.</div></li>
        <li><div>Keep one dominant theme. Two half-themes give you half the cohesion of one whole one.</div></li>
        <li><div>Add a fusion unit if you must run two themes — it counts for both.</div></li>
        <li><div>Add ranged or anti-air before you add another melee body.</div></li>
        <li><div>Spend what capacity is left on one high-star piece, not three medium ones.</div></li>
      </ol>
      <p><button class="btn btn-sm" data-goto="muster">Open the Muster screen</button></p>`],

    ["village", "The village economy", () => `
      <h3>The village economy</h3>
      <p>Three resources: <strong>steel</strong> (recruitment and building), <strong>grain</strong>
        (every recruit eats), and <strong>relics</strong> (invocations only).</p>
      <table>
        <tr><th>Building</th><th>What it does for you</th></tr>
        <tr><td>Muster Hall</td><td>Village level. Gates everything else.</td></tr>
        <tr><td>Barracks</td><td>Recruits line units; its level raises the star band it can reach.</td></tr>
        <tr><td>Forge / Granary</td><td>Produce steel and grain in real time; collect them here.</td></tr>
        <tr><td>Wing Aviary</td><td>Recruits anything that flies.</td></tr>
        <tr><td>Cloister Shrine</td><td>Recruits specialists — monks, ritualists, support.</td></tr>
        <tr><td>Training Yard</td><td>Drills three duplicates into one better unit of the same faction.</td></tr>
        <tr><td>Market</td><td>Trades steel and grain at a rate that improves with its level.</td></tr>
        <tr><td>Reliquary</td><td>Invokes a nine- or ten-star unit for relics. This is how an Ascendant reaches your roster.</td></tr>
      </table>`],

    ["glossary", "Glossary", () => `
      <h3>Glossary</h3>
      <table>
        <tr><th>Term</th><th>Meaning</th></tr>
        <tr><td>AP</td><td>Action points. Two per unit per activation.</td></tr>
        <tr><td>Anchor</td><td>What keeps an Ascendant or Divine Entity on the field. Break them all to remove it.</td></tr>
        <tr><td>Arc</td><td>Front, flank or rear, measured against the defender's facing.</td></tr>
        <tr><td>Continuity</td><td>The one round of Doctrine a platoon keeps after its Commander falls.</td></tr>
        <tr><td>Cohesion</td><td>The adjacency bonus from same-theme neighbours.</td></tr>
        <tr><td>Doctrine</td><td>Full / Reduced / Broken, set by how much of the platoon is alive.</td></tr>
        <tr><td>Signature</td><td>An ability unique to one ten-star unit.</td></tr>
        <tr><td>ZoC</td><td>Zone of control. Leaving one provokes a free attack.</td></tr>
      </table>`],
  ];

  root.innerHTML = `
    <div class="view-head">
      <div><h1>Field Manual</h1>
        <p>How to play, then why it works that way. Start at the top if this is your first battle.</p></div>
    </div>
    <div class="guide-layout">
      <nav class="guide-nav" id="gnav">${SECTIONS.map(([id, label], i) =>
        `<button data-sec="${id}"${i === 0 ? ' aria-current="true"' : ""}>${esc(label)}</button>`).join("")}</nav>
      <article class="prose panel" style="padding:20px 24px" id="gbody"></article>
    </div>`;

  const body = root.querySelector("#gbody");
  const show = (id) => {
    const sec = SECTIONS.find(([s]) => s === id) ?? SECTIONS[0];
    body.innerHTML = sec[2]();
    for (const b of root.querySelectorAll("#gnav button")) b.setAttribute("aria-current", String(b.dataset.sec === sec[0]));
  };

  root.querySelector("#gnav").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sec]");
    if (b) show(b.dataset.sec);
  });
  body.addEventListener("click", (e) => {
    const b = e.target.closest("[data-goto]");
    if (b) go(b.dataset.goto);
  });

  show(SECTIONS[0][0]);
}

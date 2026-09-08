# Dragon Host rank ladder

Source of truth: `data/factions/ranks/DRG.json`. Nine ranks ordered low to high. See `docs/samurai-ranks.md`
for the ladder shape this reuses; Ritual Cult has a ladder of its own kind, see `docs/ritual-ranks.md`.

Dragon Host reuses `mounted`, `commandRadiusBonus`, `banner` and `supreme` from the Samurai ladder as-is, and
adds one privilege of its own: `divingCharge`, logged in the stat breakdown as **"Rank: wing dive"**. It is
deliberately not named "Diving Charge" in the log — that string is already the name of `ABL_DIVING_CHARGE`,
an unrelated card ability on the Knight elite Sky-Lance Dragoon (a generic, hex-count `ChargeBonus`). Wing dive
is the aerial counterpart the roadmap asked for: an always-on ATK bonus keyed to **altitude lost this
activation**, not hexes moved, because a faction that fights from the air gets nothing from a ground charge.

| Tier | Rank | Privileges | May lead |
|---:|---|---|---|
| 0 | Hatchling | none | none |
| 1 | Wingling | none | none |
| 2 | Skyrider | none | none |
| 3 | Ridgeback Warden | mounted always | none |
| 4 | Cinder Warden | none | none |
| 5 | Wing Second | command radius +1, wing dive +150 | Patrol, Platoon |
| 6 | Wingbreaker | command radius +1, wing dive +250 | Patrol, Platoon |
| 7 | Dominant | command radius +2, banner, wing dive +300 | Patrol, Platoon, Company |
| 8 | Elder Sovereign | command radius +3, banner, wing dive +400, supreme | Company, Battalion, Army |

## What each privilege does in the engine

| Privilege | Effect | Where |
|---|---|---|
| mounted: always | +1 Movement | `ranks.ts`, `battle.ts` |
| command radius bonus | added to auras, morale recovery, Predatory Airspace | `ranks.ts` |
| banner | +5 extra Morale recovery for units in command radius each Command Phase | `morale.ts` |
| wing dive (`divingCharge`) | +ATK once the unit has lost at least `DIVE_BONUS_MIN_DROP` (1) elevation tier of *net* altitude this activation. Climbing back to a net gain resets it to 0, the same way rough ground breaks a ground charge. Flying-only in practice: `altitudeDropped` only accumulates for flying units (`battle.ts`'s `move`) | `modifiers.ts`, `ranks.ts`, `battle.ts` |
| supreme | reserved for the campaign layer | none yet |

The elevation-advantage term in the base modifier pipeline (`modifiers.ts`) explicitly excludes flying units
(`!d.flying`) — a dragon gets no credit for simply being higher up. Wing dive is the privilege that gives a
*ranked* flier a reason to actually use altitude: dive down onto a target rather than approach at a level
cruise. It is smaller than the Sky-Lance Dragoon's one-shot `ABL_DIVING_CHARGE`/`ABL_CRUSHING_DIVE` card
abilities (250-300 ATK, on a cooldown, with an Exposed drawback) and always-on instead, matching the same
"modest and reliable vs. large and risky" split the Knight lance charge privilege uses for ground cavalry.

Army validation requires a platoon commander whose rank may lead a Platoon, and a second who could assume that
command after succession, exactly as for Samurai and Shinobi.

## Current Dragon Host unit assignments

| Unit | Rank |
|---|---|
| Scree Hatchling (levy) | Hatchling |
| Slatewing Drake (foot) | Skyrider |
| Ridgeback Runner (cavalry) | Ridgeback Warden — the one ground-bound rider; reuses `mounted` rather than wing dive |
| Cinderthroat Siegewyrm (siege) | Cinder Warden — a gun crew, not a flier; carries no wing dive privilege |
| Stormclaw Wingsecond (second) | Wing Second |
| Obsidian Maw (elite) | Wingbreaker |
| Riftwing Dominant (platoon commander) | Dominant |
| Hollow Crown Elder (army-tier, summon/boss-gated) | Elder Sovereign |

Ranks Wingling has no unit yet; it is reserved for the "more cards per faction" pass in `docs/ROADMAP.md`.

# Ritual Cult rank ladder

Source of truth: `data/factions/ranks/RIT.json`. Five ranks ordered low to high. See `docs/samurai-ranks.md`
and `docs/dragon-ranks.md` for the two army-style ladders; this one is built differently on purpose.

Ritual Cult fields specialist teams only and can never unlock an extra commander or elite (its own faction
entry names this as the faction's weakness, and `composition.ts` enforces it independently of rank). So unlike
the Samurai, Knight and Dragon Host ladders, **no rank on this ladder ever grants a `canLead` privilege** —
rank here buys ritual mastery instead of command weight:

| Tier | Rank | Privileges |
|---:|---|---|
| 0 | Affiliated | none |
| 1 | Adept | ritual mastery +1 |
| 2 | Channeler | ritual mastery +2, instability ceiling 4 |
| 3 | Master Ritualist | ritual mastery +3, instability ceiling 5 |
| 4 | Grand Ritualist | ritual mastery +5, instability ceiling 6 |

## What each privilege does in the engine

| Privilege | Effect | Where |
|---|---|---|
| ritual mastery | Flat bonus this ritualist adds to its circle's Progress each Objective Phase tick, source-tracked as its own `rankMastery` field in `RitualCalc` — separate from the unit's own channeling/knowledge/language/affinity stats, exactly the way every other bonus in this engine names its source. | `ranks.ts` (`ritualMasteryBonus`), `rituals.ts` (`computeRitualProgress`) |
| instability ceiling | Raises how many `unstableStacks` a held ritual can sustain before enemy disruption can collapse it. `disruptRitual` takes the highest ceiling among the circle's *current* participants, or `RITUAL_INSTABILITY_BASE` (3, the old hardcoded value) if none of them holds the privilege. | `ranks.ts` (`ritualInstabilityCeiling`), `rituals.ts` (`disruptRitual`) |

## Current Ritual Cult unit assignments

Both current units — Affiliated Summoner (leader/support) and Foreign Ritualist (foot) — sit on the
privilege-free **Affiliated** tier. That is a deliberate choice for this pass, not an oversight: both units
already appear with exact expected numbers in `core/tests/rituals.test.ts` (the fast/slow circle progress
formula, the Unstable damage sequence), and giving either of them a real ritual-mastery or instability bonus
would change those numbers. Adept through Grand Ritualist are reserved for the "more cards per faction" pass —
once Ritual Cult has more than two units, later, more experienced ritualists can actually hold them. Until
then, `core/tests/ritual-ranks.test.ts` exercises the higher tiers directly, against an isolated registry copy
that does not touch the shared fixture the rest of the suite depends on.

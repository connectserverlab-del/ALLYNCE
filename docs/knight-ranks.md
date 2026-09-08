# Knight rank ladder

Source of truth: `data/factions/ranks/KNI.json`. Fourteen ranks ordered low to high, each with mechanical
privileges and the organizations it may lead. See `docs/samurai-ranks.md` for the Samurai ladder; Dragon Host
and Ritual Cult have no ladder yet and are unrestricted.

Unlike the Samurai retainer ladder, the Knight ladder introduces its own privilege: a lance-charge ATK bonus
that arrives with the faction's first true knighthood and scales with the peerage, giving the "controlled
cavalry" identity a mechanical hook of its own rather than reusing two swords.

| Tier | Rank | Privileges | May lead |
|---:|---|---|---|
| 0 | Page | none | none |
| 1 | Squire | none | none |
| 2 | Man-at-Arms | none | none |
| 3 | Knight Errant | none | Patrol |
| 4 | Knight Bachelor | mounted in war, lance charge +30 | Patrol |
| 5 | Knight Banneret | + banner, lance charge +40 | Patrol, Platoon |
| 6 | Baronet | mounted always, banner, lance charge +50 | Patrol, Platoon |
| 7 | Baron | + command radius +1, lance charge +60 | Platoon, Company |
| 8 | Viscount | + castle, lance charge +70 | Platoon, Company |
| 9 | Count | command radius +2, castle, lance charge +80 | Company, Battalion |
| 10 | Marquess | as Count, lance charge +90 | Company, Battalion |
| 11 | Duke | command radius +3, castle, lance charge +100 | Battalion, Army |
| 12 | Prince | as Duke, lance charge +110 | Battalion, Army |
| 13 | King | command radius +4, castle, lance charge +120, supreme | Army |

## What each privilege does in the engine

| Privilege | Effect | Where |
|---|---|---|
| mounted: war | +1 Movement while an enemy is within 6 hexes | `ranks.ts`, `battle.ts` |
| mounted: always | +1 Movement | same |
| command radius bonus | added to auras, morale recovery, Hold the Standard, Predatory Airspace | `ranks.ts` |
| banner | +5 extra Morale recovery for units in command radius each Command Phase | `morale.ts` |
| castle | allies in command radius on Fortification gain a further +100 DEF | `modifiers.ts` |
| lance charge | +ATK once the unit has moved at least `CHARGE_BONUS_MIN_HEXES` (2) hexes this activation without the charge breaking on rough ground | `modifiers.ts`, `ranks.ts` |
| supreme | reserved for the campaign layer | none yet |

The lance charge bonus is smaller than the one-shot `ChargeBonus` card skill some units carry (200-300 ATK,
on a cooldown, with an Exposed drawback) and always-on instead: a disciplined mounted knight gets a modest,
reliable edge on any charge rather than a single large one.

Army validation requires a platoon commander whose rank may lead a Platoon, and a second who could assume that
command after succession, exactly as for Samurai.

## Current Knight unit assignments

| Unit | Rank |
|---|---|
| Bastion Squire (levy) | Squire |
| Bastion Man-at-Arms (foot) | Man-at-Arms |
| Bastion Portal Keeper (support) | Knight Errant |
| Bastion Bombard (siege) | Knight Errant — a gun crew, not a rider; carries no mounted or charge privilege |
| Dawn Lancer (cavalry) | Knight Bachelor — the faction's mounted theme starts here |
| Oathbound Castellan (second) | Knight Banneret |
| Solar Bastion Marshal (platoon commander) | Baron |
| Sky-Lance Dragoon (elite) | Viscount |
| Oathbreaker King (army-tier) | King |

Ranks Page, Baronet, Count, Marquess, Duke and Prince have no unit yet; they are reserved for the
"more cards per faction" pass in `docs/ROADMAP.md`.

# Samurai rank ladder

Source of truth: `data/factions/ranks/SAM.json`. Nineteen ranks ordered low to high, each with mechanical privileges
and the organizations it may lead. Other factions have no ladder yet and are unrestricted.

| Tier | Rank | Privileges | May lead |
|---:|---|---|---|
| 0 | Koyakunin (gate guard) | none | none |
| 1 | Nakakosho (groom, stableman) | none | none |
| 2 | Tomokosho (personal attendant) | none | none |
| 3 | Rusuigumi (junior attendant) | none | none |
| 4 | Koshogumi (senior attendant) | none | Patrol |
| 5 | Umamawari (third-rank retainer) | two swords | Patrol |
| 6 | Churo (second-rank retainer) | two swords, mounted in war | Patrol, Platoon |
| 7 | Koshogumi (first-rank retainer) | two swords, mounted always | Patrol, Platoon |
| 8 | Gokenin (household vassal) | + command radius +1 | Patrol, Platoon |
| 9 | Hatamoto (banner knight) | + banner | Patrol, Platoon, Company |
| 10 | Karo (elder councilor) | as Gokenin | Platoon, Company |
| 11 | Mujo Daimyo (lord without castle, 10k–20k koku) | command radius +2 | Company, Battalion |
| 12 | Joshu Daimyo (lord of a castle) | + castle | Company, Battalion |
| 13 | Jun-kokushu (Tozama) Daimyo | as Joshu | Battalion |
| 14 | Kunimochi-nami (Fudai) Daimyo | as Joshu | Battalion |
| 15 | Kokushu (Tozama) Daimyo, 100k+ koku | command radius +3, castle | Battalion, Army |
| 16 | Kunimochi (Fudai) Daimyo, 100k+ koku | command radius +3, castle | Battalion, Army |
| 17 | Shinpan Daimyo (Shogun's relative) | command radius +3, castle | Battalion, Army |
| 18 | Shogun | command radius +4, castle, supreme | Army |

## What each privilege does in the engine

| Privilege | Effect | Where |
|---|---|---|
| two swords | +50 ATK on reaction attacks (zone of control, Overwatch) | `modifiers.ts` |
| mounted: war | +1 Movement while an enemy is within 6 hexes | `ranks.ts`, `battle.ts` |
| mounted: always | +1 Movement | same |
| command radius bonus | added to auras, morale recovery, Hold the Standard, Predatory Airspace | `ranks.ts` |
| banner | +5 extra Morale recovery for units in command radius each Command Phase | `morale.ts` |
| castle | allies in command radius on Fortification gain a further +100 DEF | `modifiers.ts` |
| supreme | reserved for the campaign layer | none yet |

Army validation now requires a platoon commander whose rank may lead a Platoon, and a second who could assume that
command after succession.

`data/compositions/platoon.json` names Company organization's battlefield effect: "One army-level order per
round." That is now live (`BattleController.useCompanyOrder`, `core/src/battle.ts`): once three or more of a
side's platoons are in the field and not Broken, its one living commander or second who may lead a Company
(`composition.ts`'s `companyLeader`) can spend the side's single Company Order for the round. It reissues that
faction's own signature platoon order (`faction.platoonOrder`) to every non-Broken platoon on the side at once,
through the same effect interpreter each platoon's own order already runs through — a Hatamoto calling Measured
Advance, for instance, gives every fielded Samurai platoon the +100 ATK next-melee bonus in one action instead of
one platoon at a time. A faction with no signature order (`platoonOrder: null`, most of the sworn companies and
divisions) has nothing to reissue and cannot use the Company Order yet.

## Current Samurai unit assignments

| Unit | Rank |
|---|---|
| Emberline Ashigaru (foot) | Koyakunin |
| White Crane Retainer (second) | Churo |
| Oni-Gate Champion (elite) | Umamawari |
| Ember Banner Daimyo (platoon commander) | Hatamoto |

## Open questions from the source list

1. "Koshogumi" appears twice (senior attendant and first-rank retainer). Both are kept under separate ids until confirmed.
2. Three provincial-lord lines arrived merged; they were split into Jun-kokushu, Kunimochi-nami and Kokushu.
3. The platoon commander is named "Daimyo" but sits at Hatamoto in this ladder, since a Daimyo leads a Company or
   Battalion. Renaming the unit to "Ember Banner Hatamoto" would match the ladder; the display name is unchanged for now.

# Faction rank ladders

Source of truth: `data/factions/ranks/<FACTION>.json`. Every faction that fields a standard platoon (Samurai,
Shinobi, Knight, Dragon Host) or specialist teams (Ritual Cult) has a ladder now. A faction with no ladder file
is unrestricted: `canLead` returns true for everyone (see `core/src/ranks.ts`). Each ladder is ordered low to
high and escalates its privileges and movement traits one step at a time; a later rank always carries everything
an earlier one had, plus one new thing.

## What each privilege or trait does in the engine

| Privilege / trait | Effect | Where |
|---|---|---|
| two swords | +50 ATK on reaction attacks (zone of control, Overwatch) | `modifiers.ts` |
| mounted: war | +1 Movement while an enemy is within 6 hexes | `ranks.ts`, `battle.ts` |
| mounted: always | +1 Movement | same |
| command radius bonus | added to auras, morale recovery, Hold the Standard, Predatory Airspace | `ranks.ts` |
| banner | +5 extra Morale recovery for units in command radius each Command Phase | `morale.ts` |
| castle | allies in command radius on Fortification gain a further +100 DEF | `modifiers.ts` |
| supreme | reserved for the campaign layer | none yet |
| canopy | Forest costs 1 Movement instead of 2 (3 for cavalry) | `ranks.ts` |
| surefoot | Mud costs 1 Movement instead of 2 (3 for cavalry) | `ranks.ts` |
| waterwalk | Water and Ford cost 1 Movement instead of impassable/2 | `ranks.ts` |
| climber | Mountain costs 3 Movement instead of 5 (6 for cavalry); never raises the cost for flying units | `ranks.ts` |
| hideOnForestStop | Ending a move on a Forest hex applies Hidden | `battle.ts` |
| ignoreZoc | Leaving an enemy-adjacent hex does not trigger a reaction attack | `battle.ts` |
| passAllies | May move through hexes occupied by allies | `battle.ts` |
| bonusMov | Added to base Movement | `battle.ts` |
| shadowStep | 1 AP action, once per activation: teleport up to N hexes to Forest, Smoke or Ruins | `battle.ts` |

Army validation requires a platoon commander whose rank may lead a Platoon, and a second who could assume that
command after succession (`core/src/composition.ts`).

## Samurai (19 ranks, `SAM.json`)

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
| 11 | Mujo Daimyo (lord without castle, 10k-20k koku) | command radius +2 | Company, Battalion |
| 12 | Joshu Daimyo (lord of a castle) | + castle | Company, Battalion |
| 13 | Jun-kokushu (Tozama) Daimyo | as Joshu | Battalion |
| 14 | Kunimochi-nami (Fudai) Daimyo | as Joshu | Battalion |
| 15 | Kokushu (Tozama) Daimyo, 100k+ koku | command radius +3, castle | Battalion, Army |
| 16 | Kunimochi (Fudai) Daimyo, 100k+ koku | command radius +3, castle | Battalion, Army |
| 17 | Shinpan Daimyo (Shogun's relative) | command radius +3, castle | Battalion, Army |
| 18 | Shogun | command radius +4, castle, supreme | Army |

Unit assignments: Emberline Ashigaru (foot) - Koyakunin; White Crane Retainer (second) - Churo; Oni-Gate
Champion (elite) - Umamawari; Ember Banner Daimyo (platoon commander) - Hatamoto; Ashfall Daimyo (lord) - Joshu
Daimyo; Iron Tide Shogun - Shogun.

Open questions from the source list: "Koshogumi" appears twice (senior attendant and first-rank retainer), kept
under separate ids until confirmed; three provincial-lord lines arrived merged and were split into Jun-kokushu,
Kunimochi-nami and Kokushu; the platoon commander is named "Daimyo" but sits at Hatamoto in this ladder, since a
Daimyo leads a Company or Battalion — the display name is unchanged pending an owner decision.

## Shinobi (6 ranks, `SHI.json`)

Each rank carries a movement trait rather than a combat privilege: Shinobi outrun Knights through forest, where
ground units pay double.

| Tier | Rank | Movement traits | May lead |
|---:|---|---|---|
| 0 | Apprentice | none | none |
| 1 | Genin | canopy | none |
| 2 | Chunin | canopy, hide on forest stop | Patrol, Platoon |
| 3 | Jounin | + ignore ZoC | Patrol, Platoon, Company |
| 4 | Anbu | + pass allies, +1 Movement | Patrol, Platoon, Company |
| 5 | Kage | + Shadow Step (3 hexes) | Company, Battalion, Army |

Unit assignments: Night-Thread Operative (foot) - Genin; Reed Signal Lieutenant (second) - Chunin; Mirror-Shade
Adept (elite) - Jounin; Veiled Moon Jonin (commander) - Jounin by default, promotable to Kage in tests.

## Knight (8 ranks, `KNI.json`)

Defense, protection, controlled cavalry. Surefoot is the ladder's signature trait: a Knight formation does not
bog down in the mud it is built to hold.

| Tier | Rank | Privileges | Movement | May lead |
|---:|---|---|---|---|
| 0 | Squire | none | none | none |
| 1 | Man-at-Arms | none | none | none |
| 2 | Sergeant-at-Arms | none | surefoot | Patrol |
| 3 | Knight-Errant | mounted in war | surefoot | Patrol, Platoon |
| 4 | Knight-Banneret | + two swords, command radius +1 | surefoot | Patrol, Platoon |
| 5 | Castellan | + castle | surefoot | Patrol, Platoon |
| 6 | Marshal | + banner, command radius +2 | surefoot | Platoon, Company, Battalion |
| 7 | King | + supreme, command radius +3 | surefoot | Army |

Unit assignments: Bastion Squire (levy) - Squire; Bastion Man-at-Arms (foot) - Man-at-Arms; Bastion Portal Keeper
(support) and Bastion Bombard (siege) - Sergeant-at-Arms; Dawn Lancer (cavalry) - Knight-Errant; Sky-Lance
Dragoon (elite) - Knight-Banneret; Oathbound Castellan (second) - Castellan; Solar Bastion Marshal (commander) -
Marshal; Oathbreaker King - King.

## Dragon Host (7 ranks, `DRG.json`)

Aerial force and territorial dominance. Most Dragon Host units already fly and ignore terrain cost entirely, so
climber — the ladder's signature trait — only changes anything for the ground-bound wyrm-kin (the Siegewyrm and
the Ridgeback Runner), letting them scale a mountainside built for a foot soldier or a horse.

| Tier | Rank | Privileges | Movement | May lead |
|---:|---|---|---|---|
| 0 | Hatchling | none | none | none |
| 1 | Wingling | none | none | none |
| 2 | Wyrmkin | none | climber | Patrol |
| 3 | Wing Adept | command radius +1 | climber, +1 Movement | Patrol, Platoon |
| 4 | Wingsecond | command radius +1 | climber, +1 Movement | Patrol, Platoon |
| 5 | Wing Dominant | command radius +2 | climber, +1 Movement | Platoon, Company, Battalion |
| 6 | Elder | + supreme, command radius +3 | climber, +2 Movement | Battalion, Army |

Unit assignments: Scree Hatchling (levy) - Hatchling; Slatewing Drake (foot) - Wingling; Cinderthroat Siegewyrm
(siege) and Ridgeback Runner (cavalry) - Wyrmkin; Obsidian Maw (elite) - Wing Adept; Stormclaw Wingsecond
(second) - Wingsecond; Riftwing Dominant (commander) - Wing Dominant; Hollow Crown Elder - Elder.

## Ritual Cult (4 ranks, `RIT.json`)

The Cult fields specialist teams only and never a full platoon (its own faction weakness: it cannot unlock extra
commanders or elites), so this ladder is short and `canLead` mostly goes unused — it exists for the same reason
the Samurai ladder carries ranks no current unit holds. Waterwalk, the signature trait, fits the Cult's
marsh-and-reed territory.

| Tier | Rank | Privileges | Movement | May lead |
|---:|---|---|---|---|
| 0 | Initiate | none | none | none |
| 1 | Adept | none | waterwalk | none |
| 2 | Voice of the Rite | command radius +1 | waterwalk | Patrol |
| 3 | Hierophant | command radius +2 | waterwalk, hide on forest stop | Patrol, Platoon |

Unit assignments: Foreign Ritualist (foot) - Initiate; Affiliated Summoner (leader) - Voice of the Rite.

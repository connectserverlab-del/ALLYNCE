# Shinobi rank ladder

Source of truth: `data/factions/ranks/SHI.json`. Six ranks ordered low to high. Unlike the Samurai ladder, every
Shinobi rank grants a movement trait rather than a combat stat, and the traits stack going up the ladder: each
rank keeps everything the rank below it has and adds one more. Other factions besides Samurai and Shinobi have
no ladder yet and are unrestricted.

| Tier | Rank | Movement traits | Other privileges | May lead |
|---:|---|---|---|---|
| 0 | Apprentice | none — moves like any ground unit | none | none |
| 1 | Genin | Canopy step (Forest costs 1 instead of 2) | none | none |
| 2 | Chunin | + hide on stopping in Forest | none | Patrol, Platoon |
| 3 | Jounin | + ignore zones of control | command radius +1 | Patrol, Platoon, Company |
| 4 | Anbu | + pass through allied hexes, +1 Movement | command radius +1 | Patrol, Platoon, Company |
| 5 | Kage | + Shadow Step (teleport up to 3 hexes into cover) | command radius +2, two swords | Company, Battalion, Army |

## What each trait does in the engine

| Trait | Effect | Where |
|---|---|---|
| canopy | Forest movement cost drops to 1 (tree to tree); Knights and other ground units still pay 2, cavalry 3 | `ranks.ts` (`terrainCostFor`) |
| hideOnForestStop | Ending a move on a Forest hex applies the Hidden status | `battle.ts` |
| ignoreZoc | Leaving a hex adjacent to an enemy does not trigger a reaction attack | `battle.ts` |
| passAllies | May move through hexes occupied by allies | `battle.ts` |
| bonusMov | Added to base Movement | `ranks.ts` (`movementTraits`) |
| shadowStep | 1 AP action, once per activation: relocate up to N hexes to a Forest, Smoke or Ruins hex, ignoring everything between, and arrive Hidden | `battle.ts` (`shadowStep`) |
| two swords (Kage only) | +50 ATK on reaction attacks (zone of control, Overwatch) | `modifiers.ts` |
| command radius bonus | Added to auras, morale recovery, Hold the Standard, Predatory Airspace | `ranks.ts` (`commandRadiusOf`) |

## Current Shinobi unit assignments

| Unit | Rank |
|---|---|
| Thread Apprentice (levy) | Apprentice |
| Night-Thread Operative (foot) | Genin |
| Reed-Smoke Mortar (siege) | Genin |
| Reed-Signal Lieutenant (second) | Chunin |
| Night Courier Rider (cavalry) | Chunin |
| Veiled Moon Jōnin (platoon commander) | Jounin |
| Mirror Shade Adept (elite) | Anbu |
| Void Crown Kage (army boss) | Kage |

Every Shinobi unit currently carries a rank; there is no unranked filler the way the Samurai ladder's lower tiers
serve as unnamed levy. A Shinobi platoon can therefore be led by anything Chunin or above, same as the Samurai
ladder requires a rank that can lead a Platoon plus a second who could assume that command after succession.

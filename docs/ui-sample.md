# Map and HUD sample

The interactive sample is an artifact page built from a real engine state: a generated field (seed 42, "Ashfall
Crossing"), two platoons a side plus siege, cavalry and ritualists deployed by the composition rules, and the engine's
own stat breakdowns in the command bar. Two further generated fields are switchable at the top of the page.

Regenerate the page data with the export script pattern in `core/src/demo.ts`: build a `Battle`, call `applyMap` with a
`generateMap` result, deploy, then serialise units, `computeStat` breakdowns, `reachable`, ritual calc and terrain rules.

## Decisions requested from the owner

1. Map look: painted hex fills with a faint scratched grid (as shown) versus a fully painted ground plate with the grid on hover.
2. Command bar material language: hammered iron and leather straps, scorched-wood portrait, slate ability tiles, parchment tooltips.
3. Field size for the vertical slice: about 300 hexes (two platoons a side) or 450 to 600 for companies.

## Visual identity used

- Ground: soot black-blue `#12141a`; panels: iron `#23272e` to `#2c3139`; parchment `#cfc3a6` for tooltips.
- Faction accents: Samurai ember `#c9562c`, Shinobi moon `#9aa7b3`, Knight dull gold `#b8923f`, Dragon pale cyan `#7fb6c2`, Ritual marsh `#7c9a5a`.
- Type: Alegreya SC for labels, Alegreya Sans for body, JetBrains Mono for numbers.
- Terrain palette matches the two concept paintings in `art/concepts/`.

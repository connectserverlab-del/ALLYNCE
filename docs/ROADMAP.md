# Roadmap and standing intent

This file is the working brief for anyone, human or agent, picking up the next piece of the game. It sits beside the
original engineering brief and records what the owner has decided since. **Decisions here override the original brief
where they conflict.**

## Owner's standing intent (in their words, paraphrased where needed)

- Art: grimdark hand-painted concept illustration. "Less cartoonish", "not AI-looking", "League-style splash quality",
  "more grunge". Round 4 in `art/samples` is the approved bar. Never credit any AI tool in repo content.
- Maps are never even squares or cookie-cutter. Real battlefields are uneven: trenches, mud, mountains, valleys, rivers.
  Playable areas are odd shapes.
- Three universal win conditions: wipe out the opponent, kill their army leader, or force a surrender. Scenario
  objectives sit on top of these.
- Every faction gets rank ladders with mechanical weight. Samurai (19 ranks) and Shinobi (6, each with a movement
  trait; Shinobi outrun Knights through forest) are named directly; the other factions follow the same idea.
- Every faction gets cannons (siege) and cavalry that fit its theme.
- Ritual and Fusion are first-class functions of the engine.
- Samples first. Show the owner a sample of any new visual direction before scaling it.
- Beyond match-to-match battles there is, eventually, a permanent holding: base building, research that upgrades
  units, and recruitment draws. A card-based army (a large main deck plus a small ritual/fusion side deck) sits
  alongside the battle layer. Neither has started yet; the vertical slice below is the foundation both build on.

## Done

- Rules engine (TypeScript reference, 40 tests): hex grid, terrain rules table, elevation, modifier pipeline,
  cohesion, doctrine, succession, combat, morale, effects, clones, rituals, divine entities, portals, objectives,
  utility AI.
- Three universal win conditions layered under scenario objectives: Wipeout (a side with no living units), Army
  Leader Killed (a scenario-designated unit whose death ends the battle immediately, independent of Doctrine
  succession), and Surrender (a side's command structure fully collapsed — `organizationLevel` at "None" — and its
  remaining morale too low to fight on, or an explicit `surrender()` decision). See `docs/mechanics.md`.
- `Threefold Invocation` scenario, fully data-defined and playable start to finish: ritual host vs. portal-backed
  defenders, three linked circles, synchronized release.
- V01 art samples: one commander plus one elite or foot soldier from each of four factions (Samurai, Shinobi,
  Knight, Dragon Host), two dragon tiers. See `docs/art-pipeline.md`.

## Next, in priority order

1. **Irregular battlefield generator.** Maps are currently hand-authored per scenario as fixed hex lists (see
   `data/scenarios/threefold_invocation.json`). The owner's standing intent is uneven, odd-shaped playable areas
   generated with mountains, valleys, rivers, fords, trenches and mud rather than drawn by hand every time.
2. **Rank ladders with mechanical weight, Samurai first (19 ranks), then Shinobi (6, with movement traits).**
   Data-defined per-rank privileges in the same style as the existing platoon Order/passive abilities.

   Note for whoever picks this up: giving a platoon Commander a rank is straightforward, but a rank ladder's top
   rung reads as "the army's leader" in exactly the sense the Army Leader Killed win condition means — and a
   platoon Commander's death is already handled by the succession system (the Second is promoted, Doctrine
   survives through Continuity). Naming a Commander as a scenario's `armyLeader` today would make the battle end
   the instant they fall, before succession ever gets a chance to run, which contradicts a mechanic the owner
   already approved. **Decision needed:** should the army-leader win condition point at the top rank of the
   ladder specifically (once ranks exist, so only the single highest-ranked unit is "the leader", distinct from
   ordinary platoon Commanders who still have a Second to fall back on), or should it stay opt-in per scenario
   for boss/unique units only, with ordinary Commanders never eligible?
3. **Themed siege pieces ("cannons") and cavalry for every faction.** Only the Knight faction has a cavalry-role
   unit today (`KNI_ELITE_SKY-LANCE-DRAGOON`); no faction has a Siege-role unit yet.
4. **Fusion as a first-class engine function**, alongside the existing clone framework (Twin Echo) in
   `effects.ts`.
5. **Remaining unit art and construction sheets**, sample-first per `art/prompts/STYLE_GUIDE.md` — owner review
   gates scaling, so an automated pass should not batch-generate here without a sample already approved.
6. **Card system and permanent holding.** Large, multi-pass pillars (100-card main deck, ritual/fusion side deck,
   base building, research, recruitment) that build on top of the vertical slice above; sequence after the
   battle-layer items so the data model they lean on (ranks, siege/cavalry rosters, Fusion) already exists.

## Brainstorm log

Append dated notes here. Ideas are proposals until the owner approves them.

- 2026-09-06: Proposal — once rank ladders land, derive a scenario's default Army Leader automatically as the
  side's single highest-ranked living unit, rather than requiring every scenario to hand-pick an `armyLeader`
  def id. This gives rank itself a mechanical consequence at the army level (the intent behind "rank ladders
  with mechanical weight") and resolves the succession conflict noted under item 2 above: an ordinary platoon
  Commander below the top rank would never qualify, only the actual army-level leader would.
- 2026-09-06: Proposal — once the irregular battlefield generator lands, add a fourth flavor of the Surrender
  win condition: a side whose organized platoons are terrain-cut off (no path within their movement budget) from
  every ritual circle and portal they own, for a set number of rounds, surrenders even at moderate morale. This
  ties the "odd-shaped battlefields" intent to the win-condition layer so terrain itself can decide a fight, not
  only attrition.

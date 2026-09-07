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
  trait; Shinobi outrun Knights through forest) are in. Knight, Dragon Host and Ritual Cult ladders are next.
- Every faction gets cannons (siege) and cavalry that fit its theme. Four of each exist with art.
- Ritual and Fusion are first-class functions of the engine.
- Samples first. Show the owner a sample of any new visual direction before scaling it.
- Maps are painted **straight down from above**, like a hand-painted satellite photograph, with readable regions,
  roads and rooftops. The three-quarter battlefield paintings were rejected. A Samurai province with a Japanese
  aesthetic is the reference region.
- The army is a **100-card deck** plus a **20-card ritual/fusion side deck**. Cards carry 1 to 10 stars; 10 is
  reserved for deities, gods, Kage, shoguns and kings, 1 for levy and squires. Higher units demand sacrifices,
  as in the collectible card games the owner named.
- Beyond match-to-match battles there is a **permanent holding**: base building, research that upgrades units,
  and recruitment draws.
- Every asset must sit beside the existing characters without breaking immersion. Interface and icons included.
- Battlefields must be large enough that units sit comfortably and the camera zooms in; a unit must never scale a
  mountain instantly. Mountains slow ground movement fivefold; only fliers ignore them.
- Cards are **paper**, never metal, and nothing in the interface may carry punched holes or rows of dots.
- The stronghold's buildings and walls are upgradable and change their look as they rise, which means a growing
  asset list that has to be tracked.

## Done, and what's next

`docs/CHECKLIST.md` is the single source of truth for finished work (its `Done` table) and the live work queue
(its `Queue` table, claimed via open PRs and `agent/*` branches — see that file's claim protocol). Keeping a
second, hand-maintained done/next list here let the two drift apart, so this file no longer carries one; check
`docs/CHECKLIST.md` for what is built and what is queued next, and come back here for the owner's standing
intent below and the brainstorm log.

### Pass note — 2026-09-07

Audited `docs/CHECKLIST.md`'s Queue against open pull requests and `agent/*` branches: every one of the
fourteen open items (`Q-1` through `Q-16`, skipping the ones already merged) has a matching open PR title or a
still-existing claim branch, several dating back to `2026-09-05` and never merged. Per this file's own claim
protocol, that means the queue is fully claimed; this pass did not start a new Queue item, and instead refreshed
this file and `README.md` (stale test count, an implemented-features list that had fallen behind
`docs/CHECKLIST.md`'s `Done` table) and added the brainstorm entry below. **Decision for the owner:** there are
now 60+ open draft pull requests against this repository, the great majority never merged. Until some of that
backlog is reviewed and merged (or closed), the Queue effectively cannot free up new claims for future passes —
worth a look when time allows.

## Brainstorm log

Append dated notes here. Ideas are proposals until the owner approves them.

- 2026-09-05: Weather as a round modifier (rain turns Open to Mud along rivers, fog reduces ranged range by 1).
- 2026-09-05: Siege pieces could target hexes for suppressive fire, laying a temporary "Shelled" terrain (−50 DEF,
  breaks charges) for one round.
- 2026-09-05: Shinobi Kage as an Army-tier unique with a once-per-battle "Night Falls" that hides every Shinobi in
  forest for one round.
- 2026-09-05: Proposal — a Samurai province campaign map where each region is a scenario, won regions feed the
  holding's resource production, and losing a region costs the buildings raised there.
- 2026-09-05: Proposal — duplicate cards from recruitment could feed a "reforge" that raises a card's star by
  one, giving duplicates a purpose instead of dead weight.
- 2026-09-05: Proposal — the side deck could hold a third card kind, a Stratagem, played from the side deck for a
  one-round battlefield effect (a forced march, a smokescreen, a false retreat), keeping the twenty-card cap.
- 2026-09-05: Fusion charges as a scenario resource: defenders start with 2, attackers 1, to make late fusions a comeback tool.
- 2026-09-07: Proposal — a twelfth objective type, `AnchorsBroken`, scoring a scenario loss when a summoned
  Divine Entity's anchors reach zero before its ritual can be repeated. Anchors currently only shrink the
  entity's own combat stats; this would let a scenario built around protecting one big summon risk the whole
  battle on it, as a scenario-authored objective layered on top of the three universal win conditions rather
  than a change to them.
- 2026-09-07: Proposal — once the Dragon Host rank ladder lands, a senior "Wing Rank" privilege that lets its
  riders cross Mountains at a rider's normal cost rather than the sixfold penalty cavalry pay elsewhere, the way
  Shinobi already outrun Knights through Forest. Gives the faction's themed cavalry a rank-gated answer to the
  terrain system rather than a flat stat bonus.

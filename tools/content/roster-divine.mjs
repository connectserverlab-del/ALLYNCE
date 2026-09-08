import { roster } from "./build.mjs";

/**
 * Divine Entities.
 *
 * Summon-only, one copy per battle, no slots and no capacity cost — they arrive through a
 * ritual rather than a muster roll, so they never compete with an army list. Each one
 * changes the battlefield on arrival, and none of them can simply be killed: they stagger
 * at zero hit points until every Anchor is broken.
 */
const D = (manifestation, anchors) => ({ manifestation, anchors });

export const DIVINE = roster(
  { faction: "DIV", className: "Divine Entities", themes: [], keywords: ["Summoned"] },
  [
    ["Sovereign of Thresholds", 6, "colossus", "Presides over doorways. Was invited through one and has not left.",
      { slots: [], summonOnly: true, unique: true, roles: ["Deity", "Boss"], rank: "Deity", size: "Colossal",
        divine: { ...D(2, 2), arrival: "Every portal on the field opens at once, whoever built it." }, capacityOverride: 0 }],
    ["Sovereign of Tallies", 6, "colossus", "Counts. Has never been observed to stop counting.",
      { slots: [], summonOnly: true, unique: true, roles: ["Deity", "Boss"], rank: "Deity", size: "Colossal",
        divine: { ...D(2, 2), arrival: "Every unit's remaining hit points are revealed to both sides permanently." } }],
    ["Sovereign of the Salt Tide", 7, "colossus", "Arrived with the water. The water has not gone back.",
      { slots: [], summonOnly: true, unique: true, roles: ["Deity", "Boss"], rank: "Deity", size: "Colossal", flying: false,
        divine: { ...D(2, 3), arrival: "Open ground within 4 becomes Water; anything standing there is pushed clear." } }],
    ["Sovereign of Unfinished Work", 7, "colossus", "Completes things. Nobody has agreed on what completion means to it.",
      { slots: [], summonOnly: true, unique: true, roles: ["Deity", "Boss"], rank: "Deity", size: "Colossal",
        divine: { ...D(3, 3), arrival: "Every ritual in progress on the field advances by three." } }],
    ["Sovereign of the Long Winter", 8, "colossus", "Does not fight so much as arrive and outlast.",
      { slots: [], summonOnly: true, unique: true, roles: ["Deity", "Boss"], rank: "Deity", size: "Colossal",
        divine: { ...D(3, 3), arrival: "All movement costs are doubled for two rounds, this entity excepted." } }],
    ["Sovereign of Borrowed Faces", 8, "colossus", "Wears the face of whoever summoned it, and keeps wearing it after.",
      { slots: [], summonOnly: true, unique: true, roles: ["Deity", "Boss"], rank: "Deity", size: "Colossal",
        divine: { ...D(3, 3), arrival: "Every Hidden unit is revealed and every clone on the field expires." } }],
    ["Sovereign of the Standing Debt", 9, "colossus", "Collects. The terms were agreed by somebody, at some point.",
      { slots: [], summonOnly: true, unique: true, roles: ["Deity", "Boss"], rank: "Deity", size: "Colossal",
        divine: { ...D(3, 4), arrival: "The summoning side loses 20 morale across the army. The debt is not optional." } }],
    ["Sovereign of Held Breath", 9, "colossus", "Nothing moves while it is deciding.",
      { slots: [], summonOnly: true, unique: true, roles: ["Deity", "Boss"], rank: "Deity", size: "Colossal", flying: true,
        divine: { ...D(3, 4), arrival: "No unit on either side may use a Reaction for two rounds." } }],
    ["Sovereign of Nine Doors", 9, "colossus", "Eight of them are known.",
      { slots: [], summonOnly: true, unique: true, roles: ["Deity", "Boss"], rank: "Deity", size: "Colossal", flying: true,
        divine: { ...D(3, 4), arrival: "Every unit on the summoning side may reposition three hexes immediately." } }],
    ["The Sovereign That Was Asked For", 10, "colossus",
      "Cults spend decades naming precisely what they want. This is what answers, and it is always technically correct.",
      { slots: [], summonOnly: true, unique: true, uniqueLimit: 1, roles: ["Deity", "Boss"], rank: "Deity", size: "Colossal",
        a: ["ABL_S_THRONE_OF_JUDGEMENT"], signature: "ABL_S_THRONE_OF_JUDGEMENT",
        divine: { ...D(4, 5), arrival: "Both armies lose 30 morale. It did not come for either of them." } }],
    ["The Sovereign of the Closed Book", 10, "colossus",
      "Everything it has finished is finished. There is no record of it being asked twice.",
      { slots: [], summonOnly: true, unique: true, uniqueLimit: 1, roles: ["Deity", "Boss"], rank: "Deity", size: "Colossal",
        a: ["ABL_S_MOONLESS_VERDICT"], signature: "ABL_S_MOONLESS_VERDICT",
        divine: { ...D(4, 5), arrival: "Every ritual circle on the field is closed permanently, including the one that called it." } }],
    ["The Sovereign Beneath the Anchors", 10, "colossus",
      "The Anchors were not built to hold it in. They were built to hold it down.",
      { slots: [], summonOnly: true, unique: true, uniqueLimit: 1, roles: ["Deity", "Boss"], rank: "Deity", size: "Colossal", flying: true,
        a: ["ABL_S_ROOT_OF_THE_WORLD"], signature: "ABL_S_ROOT_OF_THE_WORLD",
        divine: { ...D(5, 6), arrival: "Every enemy within 6 is rooted for two rounds; the ground under them stops counting as terrain." } }],
  ],
).map((u) => ({ ...u, capacityCost: 0 }));   // summoned, never mustered

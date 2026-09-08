import { roster } from "./build.mjs";

/**
 * Three new classes.
 *
 * Angelic Host  — every unit flies; the roster is ordered by choir, archangels are
 *                 one-copy-per-army by name, and the ten-star tier is written as the
 *                 unsettling scriptural article rather than the winged-person article.
 * Stormbound    — a clan, not an army: warriors and mages of the same bloodline.
 * Monastic      — orders of a few named holders; several are one-copy.
 */

const ANGEL = { faction: "ANG", className: "Angelic Host", themes: ["Angelic"], keywords: ["Winged"] };

export const ANGELS = roster(ANGEL, [
  /* Ninth choir — Angels: the messengers that are actually sent */
  ["Lamp-Bearer Aniel", 1, "flier", "Carries a light it is not permitted to set down.", { p: ["ABL_X_WINGED_GUARD"] }],
  ["Threshold Seriel", 1, "flier", "Stands in doorways. Only doorways."],
  ["Errand-Wing Kaziel", 2, "flier", "Delivers, waits for an answer, delivers the answer."],
  ["Watch-Feather Nuriel", 2, "archer", "Looses once per watch and records why.", { flying: true }],
  ["Ash-Herald Ophiel", 3, "flier", "Announces what has already been decided.", { a: ["ABL_X_HERALD_CRY"] }],
  ["Choir-Second Ramiel", 3, "support", "Keeps the choir in time when the choir is under fire.", { flying: true, a: ["ABL_X_MENDING_LIGHT"] }],

  /* Eighth choir — Archangels: named, singular, one copy per army */
  ["Archangel Vareliel, the Standard", 6, "skyleader", "The banner the Host forms on. There is one banner.",
    { a: ["ABL_X_HERALD_CRY"], p: ["ABL_X_WINGED_GUARD"], unique: true, uniqueLimit: 1, keywords: ["Archangel"], rank: "Archangel" }],
  ["Archangel Sorachiel, the Answering Blade", 7, "flier", "Answers challenges. Only challenges. Always.",
    { a: ["ABL_X_SMITE"], unique: true, uniqueLimit: 1, keywords: ["Archangel"], rank: "Archangel" }],
  ["Archangel Immureth, the Sealed Gate", 7, "guardian", "Was set at a gate and has not been relieved.",
    { flying: true, p: ["ABL_X_WINGED_GUARD"], a: ["ABL_X_CLEANSING_CHORD"], unique: true, uniqueLimit: 1, keywords: ["Archangel"], rank: "Archangel" }],
  ["Archangel Nethanel, the Mending Hand", 6, "support", "Repairs what the Host breaks, in the order the Host broke it.",
    { flying: true, a: ["ABL_X_MENDING_LIGHT", "ABL_X_CLEANSING_CHORD"], unique: true, uniqueLimit: 1, keywords: ["Archangel"], rank: "Archangel" }],
  ["Archangel Zaruel, the Sundering Trumpet", 8, "skymage", "The note is not music. It is a measurement, and things fail it.",
    { a: ["ABL_X_SMITE", "ABL_X_HERALD_CRY"], unique: true, uniqueLimit: 1, keywords: ["Archangel"], rank: "Archangel" }],
  ["Archangel Kaphriel, the Ledger of Names", 8, "skymage", "Reads a name aloud and the name stops being carried by anyone.",
    { a: ["ABL_X_SMITE"], p: ["ABL_X_WINGED_GUARD"], unique: true, uniqueLimit: 1, keywords: ["Archangel"], rank: "Archangel" }],
  ["Archangel Yehoriel, the Held Line", 9, "guardian", "Has held one line since the line was drawn.",
    { flying: true, p: ["ABL_X_WINGED_GUARD"], a: ["ABL_X_CLEANSING_CHORD"], unique: true, uniqueLimit: 1, keywords: ["Archangel"], rank: "Archangel" }],
  ["Archangel Malkiriel, the Drawn Verdict", 9, "flier", "Does not argue. Has never had to.",
    { a: ["ABL_X_SMITE"], p: ["ABL_X_WINGED_GUARD"], unique: true, uniqueLimit: 1, keywords: ["Archangel"], rank: "Archangel" }],

  /* Seventh choir — Principalities: they govern places, not people */
  ["Principality of the Salt Coast", 4, "skyleader", "Governs a coastline and considers the ships incidental.", { a: ["ABL_X_HERALD_CRY"] }],
  ["Principality of the Kiln Road", 5, "skyleader", "Governs a road; the road has never been closed.", { p: ["ABL_X_WINGED_GUARD"] }],
  ["Principality of the Drowned March", 5, "skymage", "Governs a marsh that has been under water for a century.", { a: ["ABL_X_SMITE"] }],

  /* Sixth choir — Powers: the Host's soldiery against things that should not exist */
  ["Power of the Barred Way", 4, "guardian", "Bars a way. Does not explain the way.", { flying: true, p: ["ABL_X_WINGED_GUARD"] }],
  ["Power of the Ninth Watch", 5, "flier", "Keeps the watch nobody volunteers for.", { a: ["ABL_X_SMITE"] }],
  ["Power of the Broken Circle", 6, "flier", "Assigned exclusively against ritual circles.", { a: ["ABL_X_SMITE"], p: ["ABL_X_WINGED_GUARD"] }],

  /* Fifth choir — Virtues: they move the machinery of a battle */
  ["Virtue of the Turning Hour", 5, "support", "Adjusts when things happen, slightly.", { flying: true, a: ["ABL_X_CLEANSING_CHORD"] }],
  ["Virtue of the Unbroken Vow", 6, "support", "Holds vows upright when the vow-holder cannot.", { flying: true, a: ["ABL_X_MENDING_LIGHT"] }],

  /* Fourth choir — Dominions: they issue, they do not carry out */
  ["Dominion of the Third Sphere", 7, "skyleader", "Issues orders to Powers and never to people.", { a: ["ABL_X_HERALD_CRY"] }],
  ["Dominion of the Silent Register", 7, "skymage", "Keeps the register of what has been permitted.", { a: ["ABL_X_SMITE"] }],

  /* Third choir — Thrones */
  ["Throne of the Weighed Measure", 8, "colossus", "A seat, occupied. The occupant is not the interesting part.", { flying: true, p: ["ABL_X_WINGED_GUARD"] }],
  ["Throne of the Standing Judgement", 9, "colossus", "Judgement, already made, standing where it was made.", { flying: true, p: ["ABL_X_WINGED_GUARD"], a: ["ABL_X_SMITE"] }],

  /* Second choir — Cherubim */
  ["Cherub of the Four Faces", 9, "colossus", "Four faces, four directions, no turning; it goes where the faces already look.", { flying: true, p: ["ABL_X_WINGED_GUARD"] }],

  /* Ten-star tier — written as scripture describes them, not as statues do */
  ["Ophanim, the Wheels Within Wheels", 10, "colossus",
    "Rings inside rings, rimmed with open eyes, and it does not turn as it goes — it is already facing you.",
    { flying: true, a: ["ABL_S_WHEELS_WITHIN_WHEELS"], p: ["ABL_X_WINGED_GUARD"], signature: "ABL_S_WHEELS_WITHIN_WHEELS",
      rank: "Throne", keywords: ["Biblically Accurate"],
      arrival: "The rings open: nothing may be Hidden, and every enemy within 4 is Exposed for two rounds." }],
  ["The Seraph of Six Wings", 10, "skymage",
    "Two wings over the face, two over the feet, two to fly. The covering is a courtesy and the courtesy is for you.",
    { a: ["ABL_S_SIX_WINGS_ONE_VOICE"], p: ["ABL_X_WINGED_GUARD"], signature: "ABL_S_SIX_WINGS_ONE_VOICE",
      rank: "Seraph", keywords: ["Biblically Accurate"],
      arrival: "The voice is heard at the doorposts: enemies within 5 lose 30 morale, allies within 5 are Cleansed." }],
  ["The Seraph of the Burning Coal", 10, "flier",
    "It carries the coal with tongs because even it will not hold that directly.",
    { a: ["ABL_S_THRONE_OF_JUDGEMENT"], p: ["ABL_X_WINGED_GUARD"], signature: "ABL_S_THRONE_OF_JUDGEMENT",
      rank: "Seraph", keywords: ["Biblically Accurate"],
      arrival: "Every allied unit is Cleansed and every enemy ritual loses half its progress." }],
  ["The Cherub of Wheels and Eyes", 10, "colossus",
    "Four faces, four wings, calves like burnished bronze, and beneath it the wheels that do not need it.",
    { flying: true, a: ["ABL_S_EYES_OF_THE_INNER_RING"], p: ["ABL_X_WINGED_GUARD"], signature: "ABL_S_EYES_OF_THE_INNER_RING",
      rank: "Cherub", keywords: ["Biblically Accurate"],
      arrival: "It looks in every direction at once: the whole field is revealed permanently." }],
  ["Archangel Ithuriel, Herald of the Last Hour", 10, "skyleader",
    "The last archangel on the muster, kept back for the hour the Host does not name. One copy exists. There has never been a need for two.",
    { a: ["ABL_S_HERALD_OF_THE_LAST_HOUR"], p: ["ABL_X_WINGED_GUARD"], signature: "ABL_S_HERALD_OF_THE_LAST_HOUR",
      unique: true, uniqueLimit: 1, rank: "Archangel", keywords: ["Archangel", "Biblically Accurate"],
      arrival: "The hour is called: two fallen allies return at half hit points and every ally recovers 30 morale." }],
]);

const STORM = { faction: "STM", className: "Stormbound Clan", themes: ["Storm"], keywords: ["Lightning"] };

export const STORMBOUND = roster(STORM, [
  ["Copper-Wire Levy", 1, "foot", "Wears wire so the clan can find the body afterwards."],
  ["Rod-Bearer Initiate", 1, "support", "Holds the rod. That is the entire duty and it is not a small one."],
  ["Sparkstep Runner", 2, "skirmisher", "Runs the ridge between strikes.", { p: ["ABL_X_STATIC_FIELD"] }],
  ["Fulgurite Spearman", 2, "foot", "Spear tipped with glass the storm made.", { p: ["ABL_X_STATIC_FIELD"] }],
  ["Stormcaller Apprentice", 3, "mage", "Can call the small ones reliably.", { a: ["ABL_X_ARC_STRIKE"] }],
  ["Thunder-Drum Warden", 3, "guardian", "Drums the count the clan fights to.", { p: ["ABL_X_STORMBOND"] }],
  ["Arc-Blade Warrior", 4, "bruiser", "The blade holds a charge for exactly one exchange.", { p: ["ABL_X_STATIC_FIELD"] }],
  ["Bolt-Reader", 4, "support", "Reads where the next one will land, usually in time.", { p: ["ABL_X_STORMBOND"] }],
  ["Skyfall Adept", 5, "mage", "Calls down, never across.", { a: ["ABL_X_SKYFALL_ROD"] }],
  ["Clan-Second of the Long Rod", 5, "second", "Carries the rod that grounds the whole line.", { a: ["ABL_LAST_OATH"], p: ["ABL_X_STORMBOND"] }],
  ["Thunderstep Duelist", 5, "assassin", "Arrives on the sound, not before it.", { a: ["ABL_X_THUNDERSTEP"] }],
  ["Gale-Rider", 5, "cavalry", "Rides ahead of the front and turns with it.", { p: ["ABL_X_STATIC_FIELD"] }],
  ["Stormcaller of the Ninth Peal", 6, "mage", "Counts peals; acts on the ninth.", { a: ["ABL_X_ARC_STRIKE", "ABL_X_SKYFALL_ROD"] }],
  ["Chain-Warden", 6, "guardian", "Chained to the ground on purpose.", { p: ["ABL_X_STATIC_FIELD", "ABL_X_STORMBOND"] }],
  ["Clan-Captain of the Rolling Front", 6, "leader", "Moves the clan the way weather moves.", { a: ["ABL_X_ARC_STRIKE"] }],
  ["Fulgur-Lance Champion", 7, "bruiser", "One lance, held charged for the whole engagement.", { p: ["ABL_X_STATIC_FIELD"], a: ["ABL_X_ARC_STRIKE"] }],
  ["Tempest Warden", 7, "mage", "Keeps the storm off the clan and on everyone else.", { a: ["ABL_X_SKYFALL_ROD"], p: ["ABL_X_STORMBOND"] }],
  ["Sky-Anvil Siege Caller", 7, "siege", "Calls strikes on walls, patiently, all day.", { a: ["ABL_X_SKYFALL_ROD"] }],
  ["Thunderstep Grandmaster", 8, "assassin", "Has crossed a battlefield in four sounds.", { a: ["ABL_X_THUNDERSTEP"], p: ["ABL_X_STATIC_FIELD"] }],
  ["Storm-Clad Vanguard", 8, "colossus", "Armoured in something that is still discharging.", { p: ["ABL_X_STATIC_FIELD", "ABL_X_STORMBOND"] }],
  ["Elder Stormcaller", 8, "mage", "Has called the front down on her own valley twice, deliberately.", { a: ["ABL_X_SKYFALL_ROD", "ABL_X_ARC_STRIKE"] }],
  ["Clan-Lord of the Split Sky", 9, "leader", "Rules a clan that measures rank in strikes survived.", { a: ["ABL_X_ARC_STRIKE"], p: ["ABL_X_STORMBOND"] }],
  ["The Unearthed Blade", 9, "bruiser", "Dug out of a fulgurite field, still warm.", { p: ["ABL_X_STATIC_FIELD"], a: ["ABL_X_THUNDERSTEP"] }],
  ["Archmage of the Standing Column", 9, "mage", "Holds a column of lightning upright for as long as she is standing.", { a: ["ABL_X_SKYFALL_ROD"], p: ["ABL_X_STORMBOND"] }],
  ["Verakh, the First Strike", 10, "bruiser",
    "The clan's founding blade. The clan does not claim he calls the storm — it claims the storm has learned to arrive when he does.",
    { a: ["ABL_S_FIRST_STRIKE_OF_THE_STORM"], p: ["ABL_X_STATIC_FIELD"], signature: "ABL_S_FIRST_STRIKE_OF_THE_STORM",
      arrival: "The front arrives with him: every enemy takes 300 damage and allied Storm units gain +300 ATK." }],
  ["Ilzareth, the Sky Answers", 10, "mage",
    "She does not petition the sky. She states a thing, and the sky agrees loudly enough to break ground.",
    { a: ["ABL_S_THE_SKY_ANSWERS"], p: ["ABL_X_STORMBOND"], signature: "ABL_S_THE_SKY_ANSWERS",
      arrival: "A standing column opens over the field: every round, enemies in the open take 300 damage." }],
]);

const MONK = { faction: "MNK", className: "Monastic Orders", themes: ["Monastic"], keywords: ["Discipline"] };

export const MONKS = roster(MONK, [
  ["Water-Carrier Novice", 1, "foot", "Carries water up the stair. That is the training."],
  ["Bell-Hour Novice", 2, "foot", "Wakes the order and is woken by nobody.", { p: ["ABL_X_BREATH_COUNT"] }],
  ["Staff-Form Brother", 2, "foot", "One form, ten thousand repetitions.", { a: ["ABL_X_OPEN_PALM"] }],
  ["Silent Refectory Cook", 3, "support", "Feeds the order without speaking to it.", { p: ["ABL_X_BREATH_COUNT"] }],
  ["Stone-Garden Sweeper", 3, "guardian", "Rakes the garden; the garden is a defensive diagram.", { p: ["ABL_X_FLOWING_GUARD"] }],
  ["Open-Palm Adept", 4, "bruiser", "Has not held a weapon in nine years.", { a: ["ABL_X_OPEN_PALM"], p: ["ABL_X_FLOWING_GUARD"] }],
  ["Mountain-Stair Runner", 4, "skirmisher", "Runs the thousand stairs twice daily, armoured."],
  ["Breath-Count Healer", 5, "support", "Counts the wounded down to a survivable rhythm.", { a: ["ABL_X_MENDING_LIGHT"], p: ["ABL_X_BREATH_COUNT"] }],
  ["Stillpoint Warden", 5, "guardian", "The stance has a name and the name is the whole technique.", { a: ["ABL_X_STILLPOINT"] }],
  ["Brother of the Turning Wheel", 6, "bruiser", "Fights in a circle so nothing gets behind the order.", { a: ["ABL_X_OPEN_PALM"], p: ["ABL_X_FLOWING_GUARD"] }],
  ["Abbot of the Low Cloister", 6, "leader", "Runs a cloister of forty and a temper of one.", { a: ["ABL_X_MANTRA_OF_HOLD"] }],
  ["Keeper of the Written Breath", 6, "mage", "Writes the breath down; the writing is the technique.", { p: ["ABL_X_BREATH_COUNT"] }],
  ["Iron-Sash Sister", 7, "bruiser", "The sash is iron and so is the pace she sets.", { a: ["ABL_X_OPEN_PALM"], p: ["ABL_X_FLOWING_GUARD"] }],
  ["Warden of the Unswept Path", 7, "guardian", "The path is unswept because nobody has walked it and lived to leave prints.",
    { a: ["ABL_X_STILLPOINT"], p: ["ABL_X_FLOWING_GUARD"], unique: true, uniqueLimit: 1 }],
  ["The Abbot Who Does Not Rise", 8, "guardian", "Has not stood in eleven years. Nothing has needed him to.",
    { a: ["ABL_X_STILLPOINT", "ABL_X_MANTRA_OF_HOLD"], unique: true, uniqueLimit: 1 }],
  ["Grandmaster of the Turning Wheel", 8, "bruiser", "Holds the wheel's only complete lineage.",
    { a: ["ABL_X_OPEN_PALM"], p: ["ABL_X_FLOWING_GUARD", "ABL_X_BREATH_COUNT"], unique: true, uniqueLimit: 1 }],
  ["Sister of the Last Mantra", 9, "mage", "Knows the mantra the order stopped teaching.",
    { p: ["ABL_X_BREATH_COUNT"], a: ["ABL_X_STILLPOINT"], unique: true, uniqueLimit: 1 }],
  ["The Ninefold Ascetic", 9, "bruiser", "Nine disciplines, nine masteries, no possessions.",
    { a: ["ABL_X_OPEN_PALM"], p: ["ABL_X_FLOWING_GUARD"], unique: true, uniqueLimit: 1 }],
  ["Jorenn, the Empty Hand", 10, "bruiser",
    "Sat in the pass for a season. Two armies chose different routes. Neither has explained why.",
    { a: ["ABL_S_EMPTY_HAND_EMPTY_WORLD"], p: ["ABL_X_FLOWING_GUARD"], signature: "ABL_S_EMPTY_HAND_EMPTY_WORLD",
      unique: true, uniqueLimit: 1,
      arrival: "The field goes quiet: no unit may use a Reaction for one round." }],
  ["The Unmoved of the High Cloister", 10, "guardian",
    "Has been described as a person, a doctrine, and a feature of the terrain. The order does not correct any of the three.",
    { a: ["ABL_S_THE_UNMOVED"], p: ["ABL_X_BREATH_COUNT", "ABL_X_FLOWING_GUARD"], signature: "ABL_S_THE_UNMOVED",
      unique: true, uniqueLimit: 1,
      arrival: "Stillness spreads: allies within 4 cannot be pushed, rooted or Routed for two rounds." }],
]);

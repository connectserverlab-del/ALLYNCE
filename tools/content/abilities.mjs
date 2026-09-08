import { ability as A } from "./lib.mjs";

/**
 * Expansion ability library.
 *
 * Shared abilities are reused across a faction's roster; every ten-star unit gets a
 * signature ability of its own so the godly tier never shares a kit with anything below it.
 */

/* ---------------------------------------------------------------- doctrines */
export const DOCTRINES = [
  A("DOC_THORN_TITHE", "Thorn Tithe", "Passive", { kind: "ConditionalAtk", atk: 150, vsIsolated: true },
    "+150 ATK against isolated enemies; the Coven takes what stands alone."),
  A("ORD_CREEPING_BRIAR", "Creeping Briar", "Order", { kind: "PlatoonDef", def: 100, duration: "round" },
    "The platoon roots in place: +100 DEF until the end of the round.", { apCost: 1 }),

  A("DOC_HOST_ALOFT", "Host Aloft", "Passive", { kind: "AuraStat", stat: "DEF", value: 100, radius: 2, theme: "Angelic" },
    "Angelic allies within 2 hexes gain +100 DEF while this unit is airborne."),
  A("ORD_CHOIR_ASCENDANT", "Choir Ascendant", "Order", { kind: "PlatoonMove", mov: 2, duration: "round" },
    "The choir rises: the platoon gains +2 MOV and ignores ground terrain costs this round.", { apCost: 1 }),

  A("DOC_GROUNDING_ROD", "Grounding Rod", "Passive", { kind: "ConditionalDef", def: 150, vsRole: "Ritualist" },
    "+150 DEF against ritualists and casters; the clan earths hostile magic."),
  A("ORD_STORMFRONT", "Stormfront", "Order", { kind: "ChainLightning", damage: 400, jumps: 2, radius: 4 },
    "Call the front: 400 damage to one enemy within 4, arcing to 2 further enemies within 2 of the last.", { apCost: 1, range: 4, target: "enemy" }),

  A("DOC_STILL_MIND", "Still Mind", "Passive", { kind: "ImmuneStatus", statuses: ["Suppressed", "Silenced"] },
    "Monks cannot be Suppressed or Silenced; the breath continues regardless."),
  A("ORD_UNBROKEN_FORM", "Unbroken Form", "Order", { kind: "PlatoonDef", def: 150, duration: "round" },
    "The order sets its stance: +150 DEF and immunity to forced movement this round.", { apCost: 1 }),

  A("DOC_TWO_TRADITIONS", "Two Traditions", "Passive", { kind: "AuraStat", stat: "ATK", value: 100, radius: 1, sameFusion: true },
    "Fusion units adjacent to another fusion unit gain +100 ATK: two schools, one line."),
];

/* ------------------------------------------------------- shared kit, by feel */
export const SHARED = [
  /* Samurai */
  A("ABL_X_IRON_STANCE", "Iron Stance", "Passive", { kind: "ConditionalDef", def: 100, facing: "front" },
    "+100 DEF against frontal attacks."),
  A("ABL_X_DRAWN_ARC", "Drawn Arc", "Active", { kind: "ChargeBonus", minHexesMoved: 2, atk: 250 },
    "After moving at least 2 hexes, the next melee attack gains +250 ATK.", { apCost: 1, cooldown: 2 }),
  A("ABL_X_BANNER_CALL", "Banner Call", "Order", { kind: "RallyPlatoon", morale: 10 },
    "Rally the platoon.", { apCost: 1 }),
  A("ABL_X_SECOND_CUT", "Second Cut", "Reaction", { kind: "Riposte", atkPercent: 60 },
    "When attacked in melee and not defeated, strike back at 60% ATK once per round."),

  /* Shinobi */
  A("ABL_X_SHADOWSTEP", "Shadowstep", "Active", { kind: "Teleport", range: 3, thenStatus: "Hidden" },
    "Move up to 3 hexes ignoring zone of control, then become Hidden.", { apCost: 1, cooldown: 3 }),
  A("ABL_X_POISONED_EDGE", "Poisoned Edge", "Passive", { kind: "Bleed", damage: 150, rounds: 2 },
    "Wounds inflicted by this unit deal a further 150 damage at the end of each of the next 2 rounds."),
  A("ABL_X_FALSE_TRAIL", "False Trail", "Active", { kind: "SpawnClones", count: 1, duration: 2, atkPercent: 30, hp: 1 },
    "Leave one decoy for two rounds; it has 30% ATK, 1 HP, and cannot capture.", { apCost: 1, cooldown: 3 }),
  A("ABL_X_THROAT_OF_NIGHT", "Throat of Night", "Passive", { kind: "ConditionalAtk", atk: 250, vsIsolated: true },
    "+250 ATK against an enemy with no adjacent allies."),

  /* Knight */
  A("ABL_X_SHIELD_LINE", "Shield Line", "Passive", { kind: "ConditionalDef", def: 150, requiresAdjacentTheme: "Knight" },
    "+150 DEF while adjacent to another Knight."),
  A("ABL_X_INTERPOSE", "Interpose", "Reaction", { kind: "Intercept", once: "round" },
    "Once per round, take a melee hit aimed at an adjacent ally."),
  A("ABL_X_COUCHED_LANCE", "Couched Lance", "Active", { kind: "ChargeBonus", minHexesMoved: 3, atk: 350, thenStatus: "Exposed" },
    "Charge 3+ hexes for +350 ATK; the rider is Exposed until its next activation.", { apCost: 1, cooldown: 2 }),
  A("ABL_X_OATHLIGHT", "Oathlight", "Passive", { kind: "AuraStat", stat: "DEF", value: 75, radius: 2 },
    "Allies within 2 hexes gain +75 DEF."),

  /* Dragon */
  A("ABL_X_WINGWASH", "Wingwash", "Active", { kind: "MoraleShock", morale: -10 },
    "Adjacent enemies lose 10 morale.", { apCost: 1, cooldown: 2 }),
  A("ABL_X_SCALED_HIDE", "Scaled Hide", "Passive", { kind: "DamageReduction", flat: 150 },
    "Reduce all incoming damage by 150, to a minimum of the floor."),
  A("ABL_X_STOOP", "Stoop", "Active", { kind: "ChargeBonus", minHexesMoved: 4, atk: 400 },
    "Dive from altitude: +400 ATK after moving 4 or more hexes.", { apCost: 1, cooldown: 2 }),
  A("ABL_X_BREATH_CONE", "Kindled Breath", "Active", { kind: "ConeDamage", damage: 500, length: 2 },
    "Breathe along a two-hex cone for 500 damage.", { apCost: 1, cooldown: 3, range: 2 }),

  /* Thorn Coven */
  A("ABL_X_BRIAR_SNARE", "Briar Snare", "Active", { kind: "Root", rounds: 1, range: 3 },
    "One enemy within 3 cannot move on its next activation.", { apCost: 1, cooldown: 2, range: 3, target: "enemy" }),
  A("ABL_X_BLOOD_LOAM", "Blood Loam", "Passive", { kind: "Lifesteal", percent: 25 },
    "Recover 25% of damage dealt as hit points."),
  A("ABL_X_HEX_SIGN", "Hex Sign", "Active", { kind: "ApplyStatus", status: "Exposed", rounds: 2, range: 3 },
    "One enemy within 3 becomes Exposed for 2 rounds.", { apCost: 1, cooldown: 2, range: 3, target: "enemy" }),
  A("ABL_X_THORNWARD", "Thornward", "Passive", { kind: "Thorns", damage: 200 },
    "Melee attackers take 200 damage."),

  /* Angelic */
  A("ABL_X_WINGED_GUARD", "Winged Guard", "Passive", { kind: "ConditionalDef", def: 150, vsRole: "Ranged" },
    "+150 DEF against ranged attacks while airborne."),
  A("ABL_X_HERALD_CRY", "Herald's Cry", "Active", { kind: "MoraleShock", morale: -15 },
    "Adjacent enemies lose 15 morale and cannot Rally next round.", { apCost: 1, cooldown: 3 }),
  A("ABL_X_MENDING_LIGHT", "Mending Light", "Active", { kind: "Heal", amount: 500, range: 2 },
    "Restore 500 hit points to one ally within 2.", { apCost: 1, cooldown: 2, range: 2, target: "ally" }),
  A("ABL_X_SMITE", "Smite", "Active", { kind: "Smite", damage: 600, range: 3 },
    "Strike one enemy within 3 for 600 damage that ignores terrain cover.", { apCost: 1, cooldown: 2, range: 3, target: "enemy" }),
  A("ABL_X_CLEANSING_CHORD", "Cleansing Chord", "Active", { kind: "Cleanse", radius: 2 },
    "Remove all negative statuses from allies within 2.", { apCost: 1, cooldown: 3 }),

  /* Storm clan */
  A("ABL_X_ARC_STRIKE", "Arc Strike", "Active", { kind: "ChainLightning", damage: 350, jumps: 1, radius: 3 },
    "350 damage to one enemy within 3, arcing to one further enemy within 2.", { apCost: 1, cooldown: 2, range: 3, target: "enemy" }),
  A("ABL_X_STATIC_FIELD", "Static Field", "Passive", { kind: "Thorns", damage: 150 },
    "Melee attackers take 150 damage from discharged charge."),
  A("ABL_X_THUNDERSTEP", "Thunderstep", "Active", { kind: "Teleport", range: 4 },
    "Discharge and reform up to 4 hexes away, ignoring zone of control.", { apCost: 1, cooldown: 3 }),
  A("ABL_X_STORMBOND", "Stormbond", "Passive", { kind: "AuraStat", stat: "ATK", value: 75, radius: 2, theme: "Storm" },
    "Storm allies within 2 hexes gain +75 ATK."),
  A("ABL_X_SKYFALL_ROD", "Skyfall Rod", "Active", { kind: "Smite", damage: 550, range: 4 },
    "Call a bolt onto one enemy within 4 for 550 damage.", { apCost: 1, cooldown: 3, range: 4, target: "enemy" }),

  /* Monastic */
  A("ABL_X_OPEN_PALM", "Open Palm", "Active", { kind: "Push", hexes: 2, damage: 250 },
    "Push an adjacent enemy 2 hexes and deal 250 damage.", { apCost: 1, cooldown: 2, range: 1, target: "enemy" }),
  A("ABL_X_BREATH_COUNT", "Breath Count", "Passive", { kind: "Regen", amount: 200 },
    "Recover 200 hit points at the end of each round while not adjacent to an enemy."),
  A("ABL_X_FLOWING_GUARD", "Flowing Guard", "Reaction", { kind: "Riposte", atkPercent: 50 },
    "When attacked in melee, strike back at 50% ATK once per round."),
  A("ABL_X_STILLPOINT", "Stillpoint", "Active", { kind: "Ward", def: 400, rounds: 1 },
    "Take the stillpoint stance: +400 DEF until the start of the next activation.", { apCost: 1, cooldown: 2 }),
  A("ABL_X_MANTRA_OF_HOLD", "Mantra of Holding", "Order", { kind: "PreventRouted", scope: "commandRadius", duration: "round" },
    "Allies in command radius cannot become Routed this round.", { apCost: 1 }),

  /* Ritual Cult */
  A("ABL_X_LESSER_CIRCLE", "Lesser Circle", "Active", { kind: "RitualChannel", rating: "channeling" },
    "Channel into an adjacent ritual circle.", { apCost: 1 }),
  A("ABL_X_ANCHOR_STAKE", "Anchor Stake", "Active", { kind: "PortalCall", capacity: 2 },
    "Open a reinforcement portal with capacity 2.", { apCost: 1, cooldown: 4 }),
  A("ABL_X_BORROWED_TONGUE", "Borrowed Tongue", "Passive", { kind: "ConditionalAtk", atk: 200, vsRoles: ["Ritualist", "PortalKeeper"] },
    "+200 ATK against ritualists and portal keepers."),

  /* Fusion shared */
  A("ABL_X_TWO_SCHOOLS", "Two Schools", "Passive", { kind: "AuraStat", stat: "ATK", value: 100, radius: 1 },
    "Adjacent allies gain +100 ATK; the fused form teaches while it fights."),
  A("ABL_X_BRIDGED_FORM", "Bridged Form", "Active", { kind: "Ward", def: 300, rounds: 1 },
    "Hold both stances at once: +300 DEF for one round.", { apCost: 1, cooldown: 3 }),
];

/* ------------------------------------------------- ten-star signature kits */
const SIG = (id, name, effect, text) => A(id, name, "Active", effect, text, { apCost: 1, cooldown: 4 });

export const SIGNATURES = [
  SIG("ABL_S_SUNDERING_OATH", "Sundering Oath", { kind: "Smite", damage: 1600, range: 2 },
    "Speak the oath that ends houses: 1600 damage to one enemy within 2, ignoring Fortification."),
  SIG("ABL_S_TEN_THOUSAND_CUTS", "Ten Thousand Cuts", { kind: "ConeDamage", damage: 900, length: 3 },
    "One draw, three hexes, nine hundred damage along the line."),
  SIG("ABL_S_MOONLESS_VERDICT", "Moonless Verdict", { kind: "Execute", threshold: 40, damage: 1200, range: 2 },
    "1200 damage to one enemy within 2; an enemy already below 40% hit points is removed outright."),
  SIG("ABL_S_HUNDRED_SHADOWS", "Hundred Shadows", { kind: "SpawnClones", count: 4, duration: 3, atkPercent: 60, hp: 1 },
    "Four shadows for three rounds at 60% ATK; they cannot capture and grant no cohesion."),
  SIG("ABL_S_UNBREAKABLE_DAWN", "Unbreakable Dawn", { kind: "Ward", def: 900, rounds: 2, radius: 2 },
    "The wall holds: this unit and allies within 2 gain +900 DEF for two rounds."),
  SIG("ABL_S_LANCE_OF_THE_LAST_KING", "Lance of the Last King", { kind: "ChargeBonus", minHexesMoved: 3, atk: 1500 },
    "Charge three hexes or more for +1500 ATK; the impact pushes survivors one hex."),
  SIG("ABL_S_GARDEN_OF_KNIVES", "Garden of Knives", { kind: "Thorns", damage: 700, radius: 2, rounds: 2 },
    "Briars erupt for two rounds: any enemy that attacks or ends its move within 2 takes 700 damage."),
  SIG("ABL_S_ROOT_OF_THE_WORLD", "Root of the World", { kind: "Root", rounds: 2, radius: 3 },
    "Every enemy within 3 is rooted for two rounds and loses 20 morale."),
  SIG("ABL_S_SKYBREAKER", "Skybreaker", { kind: "ConeDamage", damage: 1400, length: 4 },
    "A four-hex breath of split air for 1400 damage; flying targets take a further 300."),
  SIG("ABL_S_TERRITORIAL_EDICT", "Territorial Edict", { kind: "DenyFlyingMovement", radius: 5, rounds: 2 },
    "For two rounds no enemy may fly within 5 hexes, and enemies below take −200 DEF."),
  SIG("ABL_S_WYRMFIRE_JUDGEMENT", "Wyrmfire Judgement", { kind: "Smite", damage: 1800, range: 4 },
    "1800 damage to one enemy within 4; if it is defeated, every enemy within 2 loses 25 morale."),
  SIG("ABL_S_THE_LONG_INVITATION", "The Long Invitation", { kind: "PortalCall", capacity: 5, free: true },
    "Open a portal of capacity five that costs no Reserve Points this round."),
  SIG("ABL_S_SIX_WINGS_ONE_VOICE", "Six Wings, One Voice", { kind: "Judgement", damage: 1500, radius: 3, blind: true },
    "1500 damage to every enemy within 3; survivors are Exposed and cannot use Reactions next round."),
  SIG("ABL_S_WHEELS_WITHIN_WHEELS", "Wheels Within Wheels", { kind: "Teleport", range: 8, thenStatus: "Guarded", allySwap: true },
    "The wheels turn: move up to 8 hexes ignoring everything, and one ally within 3 moves with you."),
  SIG("ABL_S_THRONE_OF_JUDGEMENT", "Throne of Judgement", { kind: "Judgement", damage: 1200, radius: 4, moraleShock: -30 },
    "1200 damage and −30 morale to every enemy within 4; allies within 4 are Cleansed."),
  SIG("ABL_S_HERALD_OF_THE_LAST_HOUR", "Herald of the Last Hour", { kind: "Resurrect", count: 2, hpPercent: 50 },
    "Return two fallen allies at 50% hit points adjacent to this unit."),
  SIG("ABL_S_EYES_OF_THE_INNER_RING", "Eyes of the Inner Ring", { kind: "RevealAll", radius: 99, rounds: 2 },
    "Nothing is Hidden for two rounds and allies gain +150 ATK against revealed targets."),
  SIG("ABL_S_FIRST_STRIKE_OF_THE_STORM", "First Strike of the Storm", { kind: "ChainLightning", damage: 1300, jumps: 4, radius: 5 },
    "1300 damage to one enemy within 5, arcing to four further enemies at no falloff."),
  SIG("ABL_S_THE_SKY_ANSWERS", "The Sky Answers", { kind: "Judgement", damage: 1000, radius: 3, chain: true },
    "A standing column of lightning: 1000 damage in a 3-hex radius, repeating at the end of the round."),
  SIG("ABL_S_EMPTY_HAND_EMPTY_WORLD", "Empty Hand, Empty World", { kind: "Execute", threshold: 50, damage: 1400, range: 1 },
    "1400 damage to one adjacent enemy; below half hit points it is simply stopped."),
  SIG("ABL_S_THE_UNMOVED", "The Unmoved", { kind: "Ward", def: 1200, rounds: 3, immovable: true },
    "+1200 DEF for three rounds; this unit cannot be moved, rooted, pushed or routed."),
  SIG("ABL_S_TWO_BLADES_ONE_BREATH", "Two Blades, One Breath", { kind: "MultiStrike", strikes: 3, atkPercent: 70 },
    "Three strikes at 70% ATK, each able to choose a different adjacent target."),
  SIG("ABL_S_SILENT_TEMPLE", "Silent Temple", { kind: "ApplyStatus", status: "Silenced", rounds: 2, radius: 3 },
    "Every enemy within 3 is Silenced for two rounds; rituals in the area lose all progress."),
  SIG("ABL_S_DRAGON_AND_CROWN", "Dragon and Crown", { kind: "Judgement", damage: 1100, radius: 2, mount: true },
    "The wyrm and the rider strike as one: 1100 damage within 2, and the pair gains +400 DEF for a round."),
  SIG("ABL_S_STORMCLAD_HOST", "Stormclad Host", { kind: "AuraStat", stat: "ATK", value: 400, radius: 3, rounds: 2 },
    "For two rounds allies within 3 gain +400 ATK and their attacks arc to a second target."),
  SIG("ABL_S_THORNED_ASCENT", "Thorned Ascent", { kind: "Lifesteal", percent: 100, rounds: 2 },
    "For two rounds this unit heals for the full damage it deals and cannot be healed by anything else."),
];

export const EXPANSION_ABILITIES = [...DOCTRINES, ...SHARED, ...SIGNATURES];

import { roster } from "./build.mjs";

/**
 * Fusion archetypes. A fusion unit belongs to the FUS faction but keeps both parent
 * themes, so it counts for Theme Cohesion with either side of its lineage — the whole
 * point of fielding one. Each archetype has five units and one ten-star capstone.
 */

const fusion = (a, b, label) => ({ of: [a, b], label });

export const SOHEI = roster(
  { faction: "FUS", className: "Warrior-Monk (Samurai + Monastic)", themes: ["Samurai", "Monastic"], keywords: ["Fusion"] },
  [
    ["Temple-Gate Sohei", 4, "foot", "Took the vow and kept the naginata.", { p: ["ABL_X_FLOWING_GUARD"], fusion: fusion("SAM", "MNK", "Sohei") }],
    ["Ash-Robe Ronin Monk", 5, "bruiser", "Masterless twice: once by the house, once by the order.", { a: ["ABL_X_DRAWN_ARC"], p: ["ABL_X_BREATH_COUNT"], fusion: fusion("SAM", "MNK", "Sohei") }],
    ["Abbot-Captain of the Kiln Cloister", 7, "leader", "Runs a cloister that musters like a company.", { a: ["ABL_X_MANTRA_OF_HOLD"], p: ["ABL_X_FLOWING_GUARD"], fusion: fusion("SAM", "MNK", "Sohei") }],
    ["Steel-Mantra Duelist", 8, "bruiser", "Recites the form while cutting it.", { a: ["ABL_X_OPEN_PALM", "ABL_X_DRAWN_ARC"], fusion: fusion("SAM", "MNK", "Sohei") }],
    ["Sesshu, the Silent Temple", 10, "bruiser",
      "The temple did not fall. Everything that came to take it stopped speaking, and then stopped.",
      { a: ["ABL_S_SILENT_TEMPLE"], p: ["ABL_X_FLOWING_GUARD", "ABL_X_SECOND_CUT"], signature: "ABL_S_SILENT_TEMPLE",
        fusion: fusion("SAM", "MNK", "Sohei"),
        arrival: "The bell does not ring: every enemy caster is Silenced for one round." }],
  ],
);

export const KAGEBUSHI = roster(
  { faction: "FUS", className: "Shadow-Blade (Shinobi + Samurai)", themes: ["Shinobi", "Samurai"], keywords: ["Fusion"] },
  [
    ["Night-Draw Retainer", 4, "skirmisher", "Serves a house that does not list him.", { p: ["ABL_X_POISONED_EDGE"], fusion: fusion("SHI", "SAM", "Kage-Bushi") }],
    ["Veiled Banner Ronin", 5, "assassin", "Carries a banner rolled up so it cannot be read.", { a: ["ABL_X_SHADOWSTEP"], fusion: fusion("SHI", "SAM", "Kage-Bushi") }],
    ["Two-School Duelist", 7, "assassin", "Opens formally, finishes otherwise.", { a: ["ABL_FORMAL_DUEL", "ABL_X_SHADOWSTEP"], fusion: fusion("SHI", "SAM", "Kage-Bushi") }],
    ["Shadow-Sworn Captain", 8, "leader", "Commands openly, is obeyed quietly.", { a: ["ABL_SILENT_DIRECTIVE"], p: ["ABL_X_SECOND_CUT"], fusion: fusion("SHI", "SAM", "Kage-Bushi") }],
    ["Rin, Two Blades One Breath", 10, "assassin",
      "Trained in a school that no longer admits it existed, by a house that no longer admits she did.",
      { a: ["ABL_S_TWO_BLADES_ONE_BREATH"], p: ["ABL_X_THROAT_OF_NIGHT", "ABL_X_SECOND_CUT"], signature: "ABL_S_TWO_BLADES_ONE_BREATH",
        fusion: fusion("SHI", "SAM", "Kage-Bushi"),
        arrival: "Two openings at once: enemy commanders lose all Guarded status and are Exposed for a round." }],
  ],
);

export const DRAGONKNIGHTS = roster(
  { faction: "FUS", className: "Dragonknight (Knight + Dragon)", themes: ["Knight", "Dragon"], keywords: ["Fusion", "Airborne"] },
  [
    ["Wyrm-Oath Squire", 4, "cavalry", "Swore to a knight and to something much older.", { flying: true, fusion: fusion("KNI", "DRG", "Dragonknight") }],
    ["Scaled Bastion Rider", 5, "flier", "Carries a tower shield aloft, which should not work.", { p: ["ABL_X_SHIELD_LINE"], fusion: fusion("KNI", "DRG", "Dragonknight") }],
    ["Lance of the Ridge Chapter", 7, "flier", "A knightly order that keeps its stables on a cliff.", { a: ["ABL_X_COUCHED_LANCE"], p: ["ABL_X_SCALED_HIDE"], fusion: fusion("KNI", "DRG", "Dragonknight") }],
    ["Drake-Marshal of the Blue Field", 8, "skyleader", "Musters horse and wing in the same formation.", { a: ["ABL_HOLD_THE_STANDARD"], p: ["ABL_X_SCALED_HIDE"], fusion: fusion("KNI", "DRG", "Dragonknight") }],
    ["Caelvane, Dragon and Crown", 10, "skyleader",
      "The order will not say whether the rider commands the wyrm. The wyrm has never been asked.",
      { a: ["ABL_S_DRAGON_AND_CROWN"], p: ["ABL_X_SCALED_HIDE", "ABL_X_OATHLIGHT"], signature: "ABL_S_DRAGON_AND_CROWN",
        fusion: fusion("KNI", "DRG", "Dragonknight"),
        arrival: "Crown and wing arrive together: allied Knights and Dragons gain +300 DEF for two rounds." }],
  ],
);

export const STORMSERAPH = roster(
  { faction: "FUS", className: "Storm-Seraph (Angelic + Stormbound)", themes: ["Angelic", "Storm"], keywords: ["Fusion", "Winged"] },
  [
    ["Rod-Bearer of the Choir", 4, "flier", "Grounds the choir so the choir can sing louder.", { p: ["ABL_X_STORMBOND"], fusion: fusion("ANG", "STM", "Storm-Seraph") }],
    ["Arc-Winged Herald", 5, "flier", "Announces with a noise that is technically weather.", { a: ["ABL_X_ARC_STRIKE"], fusion: fusion("ANG", "STM", "Storm-Seraph") }],
    ["Fulgurite Archangel-Sworn", 7, "skymage", "Swore to an archangel and to a storm front, in that order.", { a: ["ABL_X_SKYFALL_ROD"], p: ["ABL_X_WINGED_GUARD"], fusion: fusion("ANG", "STM", "Storm-Seraph") }],
    ["Dominion of the Rolling Front", 8, "skyleader", "Governs weather the way a magistrate governs a district.", { a: ["ABL_X_ARC_STRIKE"], p: ["ABL_X_STORMBOND"], fusion: fusion("ANG", "STM", "Storm-Seraph") }],
    ["Zeruthiel, the Stormclad Host", 10, "skymage",
      "Six wings and a charge that never fully discharges. The wings are not the frightening part.",
      { a: ["ABL_S_STORMCLAD_HOST"], p: ["ABL_X_WINGED_GUARD", "ABL_X_STATIC_FIELD"], signature: "ABL_S_STORMCLAD_HOST",
        fusion: fusion("ANG", "STM", "Storm-Seraph"), keywords: ["Biblically Accurate"],
        arrival: "The host arrives charged: allies gain +200 ATK and enemies in the open take 250 damage each round." }],
  ],
);

export const THORNWYRM = roster(
  { faction: "FUS", className: "Thornwyrm (Thorn Coven + Dragon)", themes: ["Thorn", "Dragon"], keywords: ["Fusion", "Airborne"] },
  [
    ["Briar-Scaled Whelp", 4, "flier", "Hatched in a hedge and never left it entirely.", { p: ["ABL_X_THORNWARD"], fusion: fusion("THC", "DRG", "Thornwyrm") }],
    ["Root-Winged Drake", 5, "flier", "Roosts by growing into the roost.", { p: ["ABL_X_SCALED_HIDE"], fusion: fusion("THC", "DRG", "Thornwyrm") }],
    ["Gallows-Grove Wyrm", 7, "colossus", "Cannot fly far, does not need to.", { flying: true, p: ["ABL_X_THORNWARD", "ABL_X_BLOOD_LOAM"], fusion: fusion("THC", "DRG", "Thornwyrm") }],
    ["Hexwing Broodmother", 8, "skymage", "Her clutch grows rather than hatches.", { a: ["ABL_X_HEX_SIGN"], p: ["ABL_X_SCALED_HIDE"], fusion: fusion("THC", "DRG", "Thornwyrm") }],
    ["Vethrys, the Thorned Ascent", 10, "colossus",
      "The coven planted a wyrm. It is not clear that they intended it to keep growing.",
      { flying: true, a: ["ABL_S_THORNED_ASCENT"], p: ["ABL_X_THORNWARD", "ABL_X_SCALED_HIDE"], signature: "ABL_S_THORNED_ASCENT",
        fusion: fusion("THC", "DRG", "Thornwyrm"),
        arrival: "The grove takes flight: all terrain within 4 becomes Forest and enemies there lose 200 hit points a round." }],
  ],
);

export const THUNDERSTEP = roster(
  { faction: "FUS", className: "Thunderstep (Shinobi + Stormbound)", themes: ["Shinobi", "Storm"], keywords: ["Fusion"] },
  [
    ["Static-Veil Scout", 4, "skirmisher", "Hides in the noise before the strike.", { p: ["ABL_X_STATIC_FIELD"], fusion: fusion("SHI", "STM", "Thunderstep") }],
    ["Flash-Blind Infiltrator", 5, "assassin", "Enters on the flash, works during the blindness.", { a: ["ABL_X_THUNDERSTEP"], fusion: fusion("SHI", "STM", "Thunderstep") }],
    ["Peal-Count Handler", 7, "leader", "Runs cells that report only between peals.", { a: ["ABL_SILENT_DIRECTIVE"], p: ["ABL_X_STORMBOND"], fusion: fusion("SHI", "STM", "Thunderstep") }],
    ["Arc-Shadow Adept", 8, "assassin", "Two ways to cross a room, both instantaneous.", { a: ["ABL_X_THUNDERSTEP", "ABL_X_SHADOWSTEP"], fusion: fusion("SHI", "STM", "Thunderstep") }],
    ["Kaen, the Sky Answers Quietly", 10, "assassin",
      "Calls the strike, then arrives inside the noise it makes. Witnesses report only the noise.",
      { a: ["ABL_S_FIRST_STRIKE_OF_THE_STORM"], p: ["ABL_X_THROAT_OF_NIGHT", "ABL_X_STATIC_FIELD"], signature: "ABL_S_FIRST_STRIKE_OF_THE_STORM",
        fusion: fusion("SHI", "STM", "Thunderstep"),
        arrival: "Every light on the field fails for a round; nothing may use Overwatch." }],
  ],
);

export const ASCETIC_CHOIR = roster(
  { faction: "FUS", className: "Ascetic Choir (Monastic + Angelic)", themes: ["Monastic", "Angelic"], keywords: ["Fusion", "Winged"] },
  [
    ["Barefoot Herald", 4, "flier", "Flies, but walks the last stretch out of habit.", { p: ["ABL_X_BREATH_COUNT"], fusion: fusion("MNK", "ANG", "Ascetic Choir") }],
    ["Cloister-Winged Sister", 5, "support", "Keeps the cloister's hours from above it.", { flying: true, a: ["ABL_X_MENDING_LIGHT"], fusion: fusion("MNK", "ANG", "Ascetic Choir") }],
    ["Stillpoint Seraph-Sworn", 7, "guardian", "Holds a stance that is also a vigil.", { flying: true, a: ["ABL_X_STILLPOINT"], p: ["ABL_X_WINGED_GUARD"], fusion: fusion("MNK", "ANG", "Ascetic Choir") }],
    ["Abbot of the Upper Choir", 8, "skyleader", "Runs an order that meets at altitude.", { a: ["ABL_X_MANTRA_OF_HOLD", "ABL_X_CLEANSING_CHORD"], fusion: fusion("MNK", "ANG", "Ascetic Choir") }],
    ["Hesperiel, the Throne of Judgement", 10, "colossus",
      "The order calls it a brother. It has four faces and none of them are looking at the order.",
      { flying: true, a: ["ABL_S_THRONE_OF_JUDGEMENT"], p: ["ABL_X_WINGED_GUARD", "ABL_X_FLOWING_GUARD"], signature: "ABL_S_THRONE_OF_JUDGEMENT",
        fusion: fusion("MNK", "ANG", "Ascetic Choir"), keywords: ["Biblically Accurate"],
        arrival: "Judgement is seated: enemies within 4 lose 25 morale and all allied statuses are cleansed." }],
  ],
);

export const FUSIONS = [...SOHEI, ...KAGEBUSHI, ...DRAGONKNIGHTS, ...STORMSERAPH, ...THORNWYRM, ...THUNDERSTEP, ...ASCETIC_CHOIR];

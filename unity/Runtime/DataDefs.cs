// ScriptableObject shapes for the data the JSON importer (unity/Editor/DataImporter.cs) produces.
// Field names match core/src/types.ts UnitDef / AbilityDef / FactionDef. See docs/mechanics.md
// "Unity port guidance": these are generated *assets*, not generated *code* — the importer creates
// one .asset per data/units/units.json entry (etc), it does not regenerate these class definitions.
using System;
using System.Collections.Generic;
using UnityEngine;

namespace Allynce.Runtime
{
    [Serializable]
    public class RitualRatings
    {
        public int Knowledge;
        public int Language;
        public int Affinity;
        public int Channeling;
    }

    [Serializable]
    public class DivineDef
    {
        public int Manifestation;
        public int Anchors;
        public string Arrival;
    }

    [Serializable]
    public class SiegeDef
    {
        public bool SetupRequired;
        public int StructureAtk;
    }

    [CreateAssetMenu(menuName = "Allynce/Unit", fileName = "UnitDef")]
    public class UnitDef : ScriptableObject
    {
        public string Id;
        public string DisplayName;
        public string Faction;
        public List<string> Themes = new List<string>();
        public List<RoleKind> Roles = new List<RoleKind>();
        public string Rank;
        public SizeKind Size;
        public int Hp;
        public int Atk;
        public int Def;
        public int Mov;
        public int Range;
        public int Initiative;
        public int Morale;
        public int CommandRadius;
        public int CapacityCost;
        public List<string> Passives = new List<string>();
        public List<string> Actives = new List<string>();
        public List<SlotName> Slots = new List<SlotName>();
        public bool Unique;
        public bool SummonOnly;
        public string Ai;
        public bool Flying;
        public RitualRatings Ritual;
        public DivineDef Divine;
        public string FactionRank;
        public int Stars;
        public int MinRange;
        public SiegeDef Siege;
    }

    /// <summary>
    /// The effect payload is free-form in the TypeScript reference (`{ kind: string } & Record&lt;string, unknown&gt;`),
    /// so it is kept as a kind string plus the raw JSON here rather than a strongly typed field per
    /// kind. Each ported IEffectHandler parses only the fields its own kind defines — see
    /// unity/Runtime/IEffectHandler.cs and core/src/effects.ts for the reference behaviour.
    /// </summary>
    [Serializable]
    public class AbilityEffectDef
    {
        public string Kind;
        public string RawJson;
    }

    [CreateAssetMenu(menuName = "Allynce/Ability", fileName = "AbilityDef")]
    public class AbilityDef : ScriptableObject
    {
        public string Id;
        public string DisplayName;
        public string Category; // "Active" | "Passive" | "Reaction" | "Order" | "Succession" | "Objective"
        public string Faction;
        public int ApCost;
        public int Range;
        public int Cooldown;
        public string Target;
        public AbilityEffectDef Effect;
        public string Text;
    }

    [CreateAssetMenu(menuName = "Allynce/Faction", fileName = "FactionDef")]
    public class FactionDef : ScriptableObject
    {
        public string Id;
        public string DisplayName;
        public string Identity;
        public List<string> Palette = new List<string>();
        public string PrimaryTheme;
        public string PlatoonOrder;
        public string PassiveDoctrine;
        public string Weakness;
    }
}

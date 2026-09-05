// Structural mirror of core/src/types.ts. Field names match the TypeScript so a reader can hold
// the two files side by side; this file declares shape only. Generated values (the terrain table)
// live in unity/Generated/TerrainRules.g.cs — see docs/mechanics.md "Unity port guidance".
using System;
using System.Collections.Generic;

namespace Allynce.Runtime
{
    public enum RoleKind { FootSoldier, Commander, Second, Elite, Cavalry, Ranged, Ritualist, PortalKeeper, Support, Siege, Boss, Deity }
    public enum SlotName { Commander, Second, Elite, FootSoldier, Specialist }
    public enum SizeKind { Standard, Large, Colossal }
    public enum StatusKind { Guarded, Exposed, Suppressed, Hidden, Revealed, Silenced, Routed, Unstable }
    public enum TerrainKind { Open, Forest, HighGround, Fortification, Smoke, AntiAir, Water, Mountain, Valley, Trench, Mud, Road, Ford, Ruins }
    public enum DoctrineState { Full, Reduced, Broken }

    /// <summary>Per-terrain rule. costFoot/costCavalry/costFlying are movement points; null means impassable.</summary>
    [Serializable]
    public struct TerrainRule
    {
        public int? CostFoot;
        public int? CostCavalry;
        public int? CostFlying;
        public int Def;
        public bool Concealment;
        public bool BlocksSight;
        public bool ChargeBreaks;
        public int RangedAtk;
        public int RangedRange;
    }

    [Serializable]
    public class StatusInstance
    {
        public StatusKind Status;
        public int RoundsLeft;
        public int? Stacks;
        public string Source;
    }

    /// <summary>One named contribution to a stat. The whole point of the pipeline is that every
    /// value a unit fights with can be traced back to a Source string for the breakdown UI.</summary>
    [Serializable]
    public class Modifier
    {
        public string Source;
        public string Stat; // "ATK" | "DEF" | "MOV" | "RANGE"
        public int Value;
    }

    [Serializable]
    public class StatBreakdown
    {
        public int Base;
        public List<Modifier> Modifiers = new List<Modifier>();
        public int Final;
    }

    /// <summary>Runtime instance of a unit in a battle. Mirrors UnitState in core/src/types.ts;
    /// TODO port field by field as battle.ts/state.ts move over (this is scaffolding, not the port).</summary>
    [Serializable]
    public class UnitState
    {
        public string Uid;
        public string DefId;
        public string Side;
        public string PlatoonId;
        public int Hp;
        public int Morale;
        public int Ap;
        public List<StatusInstance> Statuses = new List<StatusInstance>();
        public bool IsClone;
        public string CloneOf;
        public int? SplitBodies;
        public bool Defeated;
    }

    [Serializable]
    public class PlatoonState
    {
        public string Id;
        public string Side;
        public string Faction;
        public string CommanderUid;
        public string SecondUid;
        public string EliteUid;
        public List<string> FootUids = new List<string>();
        public bool OrderUsedThisRound;
        public int ContinuityRoundsLeft;
        public bool PendingSuccession;
    }

    /// <summary>Mirrors GameEvent in core/src/types.ts. Data is untyped like the TS `Record<string, unknown>`;
    /// deserialize with Newtonsoft's JObject and read fields per event `Type`.</summary>
    [Serializable]
    public class GameEvent
    {
        public int Round;
        public string Phase;
        public string Type;
        public Dictionary<string, object> Data = new Dictionary<string, object>();
    }
}

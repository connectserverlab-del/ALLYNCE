// GENERATED FILE — do not hand-edit.
// Run `npm run unity:scaffold` to regenerate from core/src and data/.

using System.Collections.Generic;

namespace Allynce.Generated
{
    /// <summary>
    /// Mirrors TERRAIN_RULES in core/src/types.ts. The shape (TerrainKind, TerrainRule) lives in
    /// unity/Runtime/BattleTypes.cs; only the values are generated here.
    /// </summary>
    public static class TerrainRules
    {
        public static readonly Dictionary<TerrainKind, TerrainRule> All = new Dictionary<TerrainKind, TerrainRule>
        {
            { TerrainKind.Open, new TerrainRule {
                CostFoot = 1, CostCavalry = 1, CostFlying = 1,
                Def = 0, Concealment = false, BlocksSight = false,
                ChargeBreaks = false, RangedAtk = 0, RangedRange = 0,
            } },
            { TerrainKind.Road, new TerrainRule {
                CostFoot = 1, CostCavalry = 1, CostFlying = 1,
                Def = -50, Concealment = false, BlocksSight = false,
                ChargeBreaks = false, RangedAtk = 0, RangedRange = 0,
            } },
            { TerrainKind.Forest, new TerrainRule {
                CostFoot = 2, CostCavalry = 3, CostFlying = 2,
                Def = 50, Concealment = true, BlocksSight = true,
                ChargeBreaks = true, RangedAtk = 0, RangedRange = 0,
            } },
            { TerrainKind.HighGround, new TerrainRule {
                CostFoot = 2, CostCavalry = 2, CostFlying = 1,
                Def = 50, Concealment = false, BlocksSight = false,
                ChargeBreaks = false, RangedAtk = 100, RangedRange = 1,
            } },
            { TerrainKind.Mountain, new TerrainRule {
                CostFoot = 5, CostCavalry = 6, CostFlying = 2,
                Def = 0, Concealment = false, BlocksSight = true,
                ChargeBreaks = true, RangedAtk = 0, RangedRange = 0,
            } },
            { TerrainKind.Valley, new TerrainRule {
                CostFoot = 1, CostCavalry = 1, CostFlying = 1,
                Def = -50, Concealment = false, BlocksSight = false,
                ChargeBreaks = false, RangedAtk = 0, RangedRange = 0,
            } },
            { TerrainKind.Trench, new TerrainRule {
                CostFoot = 2, CostCavalry = null, CostFlying = 1,
                Def = 150, Concealment = true, BlocksSight = false,
                ChargeBreaks = true, RangedAtk = 0, RangedRange = 0,
            } },
            { TerrainKind.Mud, new TerrainRule {
                CostFoot = 2, CostCavalry = 3, CostFlying = 1,
                Def = -50, Concealment = false, BlocksSight = false,
                ChargeBreaks = true, RangedAtk = 0, RangedRange = 0,
            } },
            { TerrainKind.Fortification, new TerrainRule {
                CostFoot = 1, CostCavalry = 2, CostFlying = 1,
                Def = 200, Concealment = false, BlocksSight = true,
                ChargeBreaks = true, RangedAtk = 0, RangedRange = 0,
            } },
            { TerrainKind.Ruins, new TerrainRule {
                CostFoot = 2, CostCavalry = 3, CostFlying = 1,
                Def = 100, Concealment = true, BlocksSight = true,
                ChargeBreaks = true, RangedAtk = 0, RangedRange = 0,
            } },
            { TerrainKind.Water, new TerrainRule {
                CostFoot = null, CostCavalry = null, CostFlying = 1,
                Def = 0, Concealment = false, BlocksSight = false,
                ChargeBreaks = true, RangedAtk = 0, RangedRange = 0,
            } },
            { TerrainKind.Ford, new TerrainRule {
                CostFoot = 2, CostCavalry = 2, CostFlying = 1,
                Def = -100, Concealment = false, BlocksSight = false,
                ChargeBreaks = true, RangedAtk = 0, RangedRange = 0,
            } },
            { TerrainKind.Smoke, new TerrainRule {
                CostFoot = 1, CostCavalry = 1, CostFlying = 1,
                Def = 0, Concealment = true, BlocksSight = true,
                ChargeBreaks = false, RangedAtk = 0, RangedRange = 0,
            } },
            { TerrainKind.AntiAir, new TerrainRule {
                CostFoot = 1, CostCavalry = 1, CostFlying = null,
                Def = 0, Concealment = false, BlocksSight = false,
                ChargeBreaks = false, RangedAtk = 0, RangedRange = 0,
            } },
        };
    }
}

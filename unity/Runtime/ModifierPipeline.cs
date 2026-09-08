// Structural stub for core/src/modifiers.ts computeStat. Not ported: the real function walks theme
// cohesion, platoon doctrine, command bonuses, status effects and terrain (see the ordered comment
// at the top of computeStat) and every step pushes a named Modifier. Port that ordering here once
// the systems it reads from (cohesion, composition, command, morale, terrain) exist in C#.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Allynce.Runtime
{
    public static class ModifierPipeline
    {
        /// <summary>
        /// Sums modifiers onto a base value and returns a StatBreakdown, matching the TypeScript
        /// return shape so the same UI can be reused for the tooltip breakdown.
        /// </summary>
        public static StatBreakdown Compute(int baseValue, IEnumerable<Modifier> modifiers)
        {
            var mods = modifiers?.ToList() ?? new List<Modifier>();
            return new StatBreakdown
            {
                Base = baseValue,
                Modifiers = mods,
                Final = baseValue + mods.Sum(m => m.Value),
            };
        }

        /// <summary>Entry point matching core/src/modifiers.ts's `computeStat(b, u, stat, ctx)` signature.
        /// Throws until the pipeline steps are ported; kept here so callers have the right shape to
        /// build against instead of inventing their own.</summary>
        public static StatBreakdown ComputeStat(UnitState unit, string stat)
        {
            throw new NotImplementedException(
                "Port core/src/modifiers.ts computeStat: theme cohesion, platoon doctrine, command, " +
                "status, terrain, then ability conditionals, each pushing a named Modifier.");
        }
    }
}

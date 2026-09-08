// Structural mirror of the applyEffect switch in core/src/effects.ts. There the interpreter is one
// function with one case per effect.kind; here each kind gets its own handler class registered by
// name, so a port can land kind by kind instead of needing the whole switch translated at once.
using System;
using System.Collections.Generic;

namespace Allynce.Runtime
{
    /// <summary>Everything a handler needs to resolve one ability use. Mirrors EffectContext in
    /// core/src/effects.ts (`{ platoon?, target?, targetHex? }`).</summary>
    public class EffectContext
    {
        public PlatoonState Platoon;
        public UnitState Target;
        public (int q, int r)? TargetHex;
    }

    /// <summary>One implementation per effect.kind (see Allynce.Generated.EffectKinds for the full,
    /// generated list of kinds the data is allowed to use). Returns whether the ability resolved,
    /// matching applyEffect's `boolean` return in the TypeScript reference.</summary>
    public interface IEffectHandler
    {
        bool Apply(UnitState user, AbilityDef ability, EffectContext ctx);
    }

    /// <summary>Placeholder registered for every known kind at startup so a missing port fails loudly
    /// (NotImplementedException) instead of silently doing nothing, the way an empty `default:` would.</summary>
    public sealed class NotImplementedEffectHandler : IEffectHandler
    {
        private readonly string kind;
        public NotImplementedEffectHandler(string kind) { this.kind = kind; }
        public bool Apply(UnitState user, AbilityDef ability, EffectContext ctx) =>
            throw new NotImplementedException($"Effect kind '{kind}' has no C# handler yet. Reference: core/src/effects.ts.");
    }

    public static class EffectHandlerRegistry
    {
        private static readonly Dictionary<string, IEffectHandler> handlers = new Dictionary<string, IEffectHandler>();

        static EffectHandlerRegistry()
        {
            // Every generated kind starts out unimplemented; Register(kind, ...) overrides one at a
            // time as it's ported. This loop is what makes "not ported yet" a hard failure rather
            // than a silent pass, matching the spirit (if not the letter) of core/tests/skills.test.ts.
            foreach (var kind in Allynce.Generated.EffectKinds.All)
                handlers[kind] = new NotImplementedEffectHandler(kind);
        }

        public static void Register(string kind, IEffectHandler handler) => handlers[kind] = handler;

        public static bool Apply(string kind, UnitState user, AbilityDef ability, EffectContext ctx)
        {
            if (!handlers.TryGetValue(kind, out var handler))
                throw new ArgumentException($"Unknown effect kind '{kind}'. Regenerate unity/Generated/EffectKinds.g.cs (npm run unity:scaffold) if this is new data.");
            return handler.Apply(user, ability, ctx);
        }
    }
}

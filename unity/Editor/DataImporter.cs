// Editor-only importer: reads the JSON in data/ and creates/updates one ScriptableObject asset per
// entry, per docs/mechanics.md "Unity port guidance" ("UnitDef, AbilityDef, FactionDef →
// ScriptableObjects generated from the JSON by an editor importer"). Requires the Newtonsoft Json
// Unity package (com.unity.nuget.newtonsoft-json) — not vendored here, add it via the Package
// Manager once this scaffold lands in a real Unity project.
//
// This has not been compiled; there is no Unity project or CI job for it in this repository yet.
// Treat it as a structural reference for the real importer, not a finished tool.
using System.IO;
using System.Linq;
using Allynce.Runtime;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEngine;

namespace Allynce.Editor
{
    public static class DataImporter
    {
        // Path from this Unity project's Assets folder to the repository's data/ folder. Adjust to
        // match wherever this scaffold ends up relative to the ALLYNCE checkout.
        private const string RepoDataRoot = "../../data";
        private const string GeneratedAssetRoot = "Assets/Generated";

        [MenuItem("ALLYNCE/Import Data From JSON")]
        public static void ImportAll()
        {
            ImportFactions();
            ImportUnits();
            ImportAbilities();
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log("ALLYNCE data import complete.");
        }

        private static JArray ReadJsonArray(string relativePath)
        {
            var path = Path.Combine(RepoDataRoot, relativePath);
            return JArray.Parse(File.ReadAllText(path));
        }

        private static JObject ReadJsonObject(string relativePath)
        {
            var path = Path.Combine(RepoDataRoot, relativePath);
            return JObject.Parse(File.ReadAllText(path));
        }

        private static T LoadOrCreateAsset<T>(string folder, string id) where T : ScriptableObject
        {
            EnsureFolder(folder);
            var path = $"{folder}/{id}.asset";
            var asset = AssetDatabase.LoadAssetAtPath<T>(path);
            if (asset == null)
            {
                asset = ScriptableObject.CreateInstance<T>();
                AssetDatabase.CreateAsset(asset, path);
            }
            return asset;
        }

        private static void EnsureFolder(string folder)
        {
            if (AssetDatabase.IsValidFolder(folder)) return;
            var parent = Path.GetDirectoryName(folder)?.Replace('\\', '/');
            var name = Path.GetFileName(folder);
            if (!string.IsNullOrEmpty(parent) && !AssetDatabase.IsValidFolder(parent)) EnsureFolder(parent);
            AssetDatabase.CreateFolder(parent, name);
        }

        // factions/factions.json is a map of id -> FactionDef, not an array (see core/src/data.ts loadRegistry).
        private static void ImportFactions()
        {
            var root = ReadJsonObject("factions/factions.json");
            foreach (var prop in root.Properties())
            {
                var f = (JObject)prop.Value;
                var asset = LoadOrCreateAsset<FactionDef>($"{GeneratedAssetRoot}/Factions", prop.Name);
                asset.Id = (string)f["id"];
                asset.DisplayName = (string)f["name"];
                asset.Identity = (string)f["identity"];
                asset.Palette = f["palette"]?.Select(v => (string)v).ToList() ?? new System.Collections.Generic.List<string>();
                asset.PrimaryTheme = (string)f["primaryTheme"];
                asset.PlatoonOrder = (string)f["platoonOrder"];
                asset.PassiveDoctrine = (string)f["passiveDoctrine"];
                asset.Weakness = (string)f["weakness"];
                EditorUtility.SetDirty(asset);
            }
        }

        private static void ImportUnits()
        {
            var units = ReadJsonArray("units/units.json");
            foreach (JObject u in units)
            {
                var id = (string)u["id"];
                var asset = LoadOrCreateAsset<UnitDef>($"{GeneratedAssetRoot}/Units", id);
                asset.Id = id;
                asset.DisplayName = (string)u["name"];
                asset.Faction = (string)u["faction"];
                asset.Themes = u["themes"]?.Select(v => (string)v).ToList() ?? new System.Collections.Generic.List<string>();
                asset.Rank = (string)u["rank"];
                asset.Hp = (int)u["hp"];
                asset.Atk = (int)u["atk"];
                asset.Def = (int)u["def"];
                asset.Mov = (int)u["mov"];
                asset.Range = (int)u["range"];
                asset.Initiative = (int)u["initiative"];
                asset.Morale = (int)u["morale"];
                asset.CommandRadius = (int?)u["commandRadius"] ?? 0;
                asset.CapacityCost = (int)u["capacityCost"];
                asset.Passives = u["passives"]?.Select(v => (string)v).ToList() ?? new System.Collections.Generic.List<string>();
                asset.Actives = u["actives"]?.Select(v => (string)v).ToList() ?? new System.Collections.Generic.List<string>();
                asset.Unique = (bool)u["unique"];
                asset.SummonOnly = (bool)u["summonOnly"];
                asset.Ai = (string)u["ai"];
                asset.Flying = (bool?)u["flying"] ?? false;
                asset.FactionRank = (string)u["factionRank"];
                asset.Stars = (int?)u["stars"] ?? 1;
                asset.MinRange = (int?)u["minRange"] ?? 0;
                // Size, Roles, Slots, Ritual, Divine, Siege: enum/nested-object fields left for the
                // next pass on this importer — straightforward, just more parsing boilerplate.
                EditorUtility.SetDirty(asset);
            }
        }

        private static void ImportAbilities()
        {
            var abilities = ReadJsonArray("abilities/abilities.json");
            foreach (JObject a in abilities)
            {
                var id = (string)a["id"];
                var asset = LoadOrCreateAsset<AbilityDef>($"{GeneratedAssetRoot}/Abilities", id);
                asset.Id = id;
                asset.DisplayName = (string)a["name"];
                asset.Category = (string)a["category"];
                asset.Faction = (string)a["faction"];
                asset.ApCost = (int?)a["apCost"] ?? 0;
                asset.Range = (int?)a["range"] ?? 0;
                asset.Cooldown = (int?)a["cooldown"] ?? 0;
                asset.Target = (string)a["target"];
                asset.Text = (string)a["text"];
                var effect = (JObject)a["effect"];
                asset.Effect = new AbilityEffectDef { Kind = (string)effect["kind"], RawJson = effect.ToString() };
                EditorUtility.SetDirty(asset);
            }
        }
    }
}

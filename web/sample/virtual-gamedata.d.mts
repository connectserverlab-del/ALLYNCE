/** Shape of the build-time module `scripts/gamedata-plugin.mjs` injects. */
declare module "virtual:gamedata" {
  const data: Record<string, unknown> & {
    units: unknown[]; abilities: unknown[]; factions: unknown; platoon: unknown;
    ranks: unknown[]; fusions: unknown; deckRules: unknown; sideCards: unknown;
    buildings: unknown; research: unknown; banners: unknown; wanted: unknown;
    marchRules: unknown; weather: unknown;
  };
  export default data;
}

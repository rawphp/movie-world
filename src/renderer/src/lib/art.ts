/**
 * Map an app-owned cache poster/fanart path to the `mw-art://` protocol URL
 * registered in the main process (REQ-011 / REQ-043).
 *
 * Cache-only contract: pass only paths from `displayPosterPath` /
 * `displayFanartPath` (or raw `cachedPosterPath` / `cachedFanartPath`).
 * Never pass Drive/source `posterPath` / `fanartPath` — when cache is null,
 * returns empty string so the UI shows a placeholder.
 */
export const artSrc = (cachePath: string | null | undefined): string => {
  return cachePath ? `mw-art://${encodeURIComponent(cachePath)}` : ''
}

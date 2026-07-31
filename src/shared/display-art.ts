/**
 * Display-art contract (UR-011 / REQ-042): the renderer paints only
 * app-owned cache paths (`cachedPosterPath` / `cachedFanartPath`).
 * Drive sidecars (`posterPath` / `fanartPath`) are never selected for paint.
 */

export type DisplayPosterSource = {
  cachedPosterPath?: string | null
  /** Present for callers; ignored for display selection. */
  posterPath?: string | null
}

export type DisplayFanartSource = {
  cachedFanartPath?: string | null
  /** Present for callers; ignored for display selection. */
  fanartPath?: string | null
}

/** Paint path for poster — cache only; never falls back to Drive `posterPath`. */
export function displayPosterPath(source: DisplayPosterSource): string | null {
  return source.cachedPosterPath ?? null
}

/** Paint path for fanart — cache only; never falls back to Drive `fanartPath`. */
export function displayFanartPath(source: DisplayFanartSource): string | null {
  return source.cachedFanartPath ?? null
}

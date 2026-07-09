/**
 * Map an on-disk poster/fanart path to the `mw-art://` protocol URL registered
 * in the main process (REQ-011). Returns an empty string for a null path so the
 * caller can treat the result as a falsy placeholder. When a cached artwork path
 * exists, prefer it over the source sidecar path so rendering does not hydrate
 * cloud-backed movie folders.
 */
export const artSrc = (path: string | null, cachedPath?: string | null): string => {
  const selected = cachedPath || path
  return selected ? `mw-art://${encodeURIComponent(selected)}` : ''
}

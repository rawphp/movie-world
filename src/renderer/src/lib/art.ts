/**
 * Map an on-disk poster/fanart path to the `mw-art://` protocol URL registered
 * in the main process (REQ-011). Returns an empty string for a null path so the
 * caller can treat the result as a falsy placeholder.
 */
export const artSrc = (path: string | null): string =>
  path ? `mw-art://${encodeURIComponent(path)}` : ''

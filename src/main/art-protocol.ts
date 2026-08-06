import { existsSync as defaultExistsSync, readFileSync as defaultReadFileSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { measureSync, type TimingSink } from './startup-timings'

/** Injectable FS for serveArtFile so slow/cloud-only Drive can be simulated (REQ-037). */
export interface ArtFileSystem {
  existsSync: (path: string) => boolean
  readFileSync: (path: string) => Buffer
}

export interface ServeArtOptions {
  fs?: ArtFileSystem
  onTiming?: TimingSink
  /**
   * App userData directory (required). Only paths under `{userData}/cache` are
   * opened; non-cache (e.g. Google Drive source) paths fail-fast 404 without
   * sync FS so one cloud-only poster cannot stall the main process (REQ-038,
   * REQ-047 strict cache protocol).
   */
  userDataPath: string
}

/**
 * True when `filePath` is under the app-owned artwork cache tree
 * (`{userDataPath}/cache/...`). Used by serveArtFile fail-fast policy.
 */
export function isAppOwnedCachePath(filePath: string, userDataPath: string): boolean {
  const cacheRoot = resolve(userDataPath, 'cache')
  const target = resolve(filePath)
  return target === cacheRoot || target.startsWith(cacheRoot + sep)
}

/** Custom scheme used to serve on-disk artwork to the sandboxed renderer. */
export const MW_ART_SCHEME = 'mw-art'
export const YOUTUBE_EMBED_REFERER = 'https://www.youtube.com/'
export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube.com'
export const YOUTUBE_NOCOOKIE_EMBED_REFERER = 'https://www.youtube-nocookie.com/'
export const YOUTUBE_NOCOOKIE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com'

const PREFIX = `${MW_ART_SCHEME}://`
const SHORT_PREFIX = `${MW_ART_SCHEME}:`
const YOUTUBE_EMBED_HOSTS = new Set(['www.youtube.com', 'www.youtube-nocookie.com'])
const YOUTUBE_EMBED_IDENTITIES: Record<string, { Referer: string; Origin: string }> = {
  'www.youtube.com': {
    Referer: YOUTUBE_EMBED_REFERER,
    Origin: YOUTUBE_EMBED_ORIGIN
  },
  'www.youtube-nocookie.com': {
    Referer: YOUTUBE_NOCOOKIE_EMBED_REFERER,
    Origin: YOUTUBE_NOCOOKIE_EMBED_ORIGIN
  }
}

/**
 * Decode a `mw-art://<encoded-abs-path>` request URL back to the on-disk
 * absolute path. The renderer builds these as `mw-art://${encodeURIComponent(absPath)}`
 * (REQ-014), so slashes and other reserved characters are percent-encoded and
 * must be decoded here — no host component is ever present.
 */
export function decodeArtUrl(url: string): string {
  const raw = url.startsWith(PREFIX)
    ? url.slice(PREFIX.length)
    : url.startsWith(SHORT_PREFIX)
      ? url.slice(SHORT_PREFIX.length)
      : url
  return decodeURIComponent(raw)
}

/**
 * Map an on-disk file path to an image Content-Type from its extension.
 * Matched-movie artwork is `.jpg`/`.jpeg`; `.png`/`.webp` are supported for
 * completeness. Unknown extensions fall back to `application/octet-stream`.
 */
export function contentTypeFor(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    default:
      return 'application/octet-stream'
  }
}

/**
 * Serve the on-disk bytes for a `mw-art://` request URL as a Web `Response`.
 *
 * This deliberately reads the file directly with `fs` and has no compile-time
 * dependency on Electron's `net`/`protocol`, so it is unit-testable and — more
 * importantly — it removes the `net.fetch(pathToFileURL(...))` failure mode that
 * left matched-movie posters rendering as broken-image icons (REQ-018). A
 * missing or undecodable path returns a 404 Response; an existing file returns
 * a 200 Response carrying its exact bytes and a correct image `Content-Type`.
 *
 * `userDataPath` is required. Only app-owned cache paths under `{userData}/cache`
 * are opened. Residual Drive/source `mw-art` URLs fail-fast 404 without
 * existsSync/readFileSync so cloud-only files cannot freeze the main process
 * (REQ-037 root cause a_mw_art_sync_reads; REQ-038 / REQ-047). Renderer
 * `artSrc` uses only `cachedPosterPath`/`cachedFanartPath` so successful paint
 * never depends on opening Drive.
 */
export function serveArtFile(url: string, options: ServeArtOptions): Response {
  const fs = options.fs ?? {
    existsSync: defaultExistsSync,
    readFileSync: defaultReadFileSync
  }
  return measureSync(
    'serveArtFile',
    () => {
      const filePath = decodeArtUrl(url)
      if (!filePath) return new Response(null, { status: 404 })
      // Fail-fast for non-cache paths: never touch potentially cloud-backed FS.
      if (!isAppOwnedCachePath(filePath, options.userDataPath)) {
        return new Response(null, { status: 404 })
      }
      if (!fs.existsSync(filePath)) return new Response(null, { status: 404 })
      try {
        const body = fs.readFileSync(filePath)
        // BodyInit without a full second allocation. Node Buffer is a
        // Uint8Array subclass at runtime and is a valid body; DOM lib
        // typings reject Buffer / ArrayBufferLike views, so cast rather
        // than Uint8Array.from(body) which copies every byte (REQ-047).
        return new Response(body as unknown as BodyInit, {
          status: 200,
          headers: { 'Content-Type': contentTypeFor(filePath) }
        })
      } catch {
        return new Response(null, { status: 404 })
      }
    },
    { sink: options.onTiming, detail: decodeArtUrl(url) }
  )
}

/**
 * Build the renderer Content-Security-Policy string. Always permits `mw-art:`
 * artwork images and the `https://www.youtube.com` trailer iframe, without which
 * posters and the embedded trailer silently fail. In dev the script/style/connect
 * directives are loosened so Vite's HMR client and injected styles keep working.
 */
export function buildCsp(isDev: boolean): string {
  const scriptSrc = isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'"
  const connectSrc = isDev ? "'self' https: ws: wss:" : "'self' https://api.themoviedb.org"
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    // image.tmdb.org: Fix match candidate posters (search results are remote URLs).
    "img-src 'self' data: mw-art: https://image.tmdb.org",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
    'child-src https://www.youtube.com https://www.youtube-nocookie.com'
  ].join('; ')
}

/**
 * Decide whether a response belongs to the renderer shell and should receive
 * the app CSP. Electron's session-wide webRequest hook also observes remote
 * subframes; applying the renderer CSP to YouTube's own embed response blocks
 * YouTube's inline player scripts and leaves the iframe blank.
 */
export function shouldApplyRendererCsp(
  requestUrl: string,
  isDev: boolean,
  rendererUrl?: string
): boolean {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return false
  }

  if (url.protocol === 'file:') return true

  if (!isDev || !rendererUrl) return false

  try {
    return url.origin === new URL(rendererUrl).origin
  } catch {
    return false
  }
}

/**
 * YouTube's embedded player rejects file-origin Electron renderers when the
 * top-level embed request has no valid HTTP Referer/Origin. Scope the injected
 * identity to the actual YouTube embed host so the request headers match the
 * iframe origin; subresources such as googlevideo and every app/TMDB/local URL
 * must pass through untouched.
 */
export function shouldSetYoutubeReferer(requestUrl: string): boolean {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return false
  }

  return url.protocol === 'https:' && YOUTUBE_EMBED_HOSTS.has(url.hostname)
}

export function withYoutubeRefererHeaders<T extends Record<string, string | string[]>>(
  requestUrl: string,
  requestHeaders: T
): T {
  if (!shouldSetYoutubeReferer(requestUrl)) return requestHeaders

  const identity = YOUTUBE_EMBED_IDENTITIES[new URL(requestUrl).hostname]

  const headers = Object.fromEntries(
    Object.entries(requestHeaders).filter(([key]) => {
      const normalized = key.toLowerCase()
      return normalized !== 'referer' && normalized !== 'origin'
    })
  ) as T

  return {
    ...headers,
    Referer: identity.Referer,
    Origin: identity.Origin
  }
}

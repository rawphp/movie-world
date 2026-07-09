import { existsSync, readFileSync } from 'node:fs'
import { extname } from 'node:path'

/** Custom scheme used to serve on-disk artwork to the sandboxed renderer. */
export const MW_ART_SCHEME = 'mw-art'
export const YOUTUBE_EMBED_REFERER = 'https://www.youtube.com/'
export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube.com'

const PREFIX = `${MW_ART_SCHEME}://`
const SHORT_PREFIX = `${MW_ART_SCHEME}:`
const YOUTUBE_EMBED_HOSTS = new Set(['www.youtube.com', 'www.youtube-nocookie.com'])

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
 */
export function serveArtFile(url: string): Response {
  const filePath = decodeArtUrl(url)
  if (!filePath || !existsSync(filePath)) return new Response(null, { status: 404 })
  try {
    const body = readFileSync(filePath)
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': contentTypeFor(filePath) }
    })
  } catch {
    return new Response(null, { status: 404 })
  }
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
    "img-src 'self' data: mw-art:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    'frame-src https://www.youtube.com',
    'child-src https://www.youtube.com'
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
 * YouTube's embedded player rejects file-origin Electron renderers with Error
 * 153 when the top-level embed request has no HTTP Referer/Origin. Scope the
 * spoofed app identity to YouTube embed hosts only; subresources such as
 * googlevideo and every app/TMDB/local URL must pass through untouched.
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

  const headers = Object.fromEntries(
    Object.entries(requestHeaders).filter(([key]) => {
      const normalized = key.toLowerCase()
      return normalized !== 'referer' && normalized !== 'origin'
    })
  ) as T

  return {
    ...headers,
    Referer: YOUTUBE_EMBED_REFERER,
    Origin: YOUTUBE_EMBED_ORIGIN
  }
}

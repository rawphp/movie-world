import { existsSync, readFileSync } from 'node:fs'
import { extname } from 'node:path'

/** Custom scheme used to serve on-disk artwork to the sandboxed renderer. */
export const MW_ART_SCHEME = 'mw-art'

const PREFIX = `${MW_ART_SCHEME}://`
const SHORT_PREFIX = `${MW_ART_SCHEME}:`

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
  const body = readFileSync(filePath)
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': contentTypeFor(filePath) }
  })
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

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

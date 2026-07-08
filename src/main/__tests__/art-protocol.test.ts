import { describe, it, expect } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  decodeArtUrl,
  buildCsp,
  serveArtFile,
  contentTypeFor,
  MW_ART_SCHEME,
  shouldApplyRendererCsp
} from '../art-protocol'

describe('decodeArtUrl', () => {
  it('decodes an encoded absolute path', () => {
    const p = '/Users/me/Movies/My Film (2020)/poster.jpg'
    expect(decodeArtUrl(`${MW_ART_SCHEME}://${encodeURIComponent(p)}`)).toBe(p)
  })

  it('round-trips paths with reserved and unicode characters', () => {
    const p = '/movies/a & b/#1/póster.jpg'
    expect(decodeArtUrl(`${MW_ART_SCHEME}://${encodeURIComponent(p)}`)).toBe(p)
  })

  it('tolerates the short scheme form without a double slash', () => {
    const p = '/movies/x.jpg'
    expect(decodeArtUrl(`${MW_ART_SCHEME}:${encodeURIComponent(p)}`)).toBe(p)
  })
})

describe('buildCsp', () => {
  it('permits mw-art: image sources and the youtube trailer frame', () => {
    const csp = buildCsp(false)
    expect(csp).toMatch(/img-src[^;]*mw-art:/)
    expect(csp).toMatch(/frame-src[^;]*https:\/\/www\.youtube\.com/)
    expect(csp).toMatch(/child-src[^;]*https:\/\/www\.youtube\.com/)
  })

  it('loosens script-src for HMR only in dev', () => {
    expect(buildCsp(true)).toContain("'unsafe-eval'")
    expect(buildCsp(false)).not.toContain("'unsafe-eval'")
  })
})

describe('shouldApplyRendererCsp', () => {
  it('applies packaged CSP only to file-backed renderer responses', () => {
    expect(
      shouldApplyRendererCsp('file:///Applications/MovieWorld/out/renderer/index.html', false)
    ).toBe(true)
    expect(shouldApplyRendererCsp('https://www.youtube.com/embed/eogpIG53Cis', false)).toBe(false)
  })

  it('applies dev CSP only to the configured renderer origin', () => {
    const rendererUrl = 'http://localhost:5173'
    expect(shouldApplyRendererCsp('http://localhost:5173/src/main.ts', true, rendererUrl)).toBe(
      true
    )
    expect(
      shouldApplyRendererCsp('https://www.youtube.com/embed/eogpIG53Cis', true, rendererUrl)
    ).toBe(false)
  })
})

describe('contentTypeFor', () => {
  it('maps image extensions and defaults to octet-stream', () => {
    expect(contentTypeFor('/x/a.jpg')).toBe('image/jpeg')
    expect(contentTypeFor('/x/a.JPEG')).toBe('image/jpeg')
    expect(contentTypeFor('/x/a.png')).toBe('image/png')
    expect(contentTypeFor('/x/a.webp')).toBe('image/webp')
    expect(contentTypeFor('/x/a.bin')).toBe('application/octet-stream')
  })
})

describe('serveArtFile', () => {
  it('serves an existing file as a 200 with image/jpeg and the exact bytes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mw-art-'))
    const file = join(dir, 'A Man Called Otto (2022)-poster.jpg')
    // A real (if tiny) JPEG: SOI + APP0/JFIF header + EOI.
    const bytes = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9
    ])
    writeFileSync(file, bytes)

    const res = serveArtFile(`${MW_ART_SCHEME}://${encodeURIComponent(file)}`)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/jpeg')
    const got = Buffer.from(await res.arrayBuffer())
    expect(got.equals(bytes)).toBe(true)
  })

  it('returns a 404 Response for a non-existent path', () => {
    const missing = '/no/such/dir/definitely-missing-poster.jpg'
    const res = serveArtFile(`${MW_ART_SCHEME}://${encodeURIComponent(missing)}`)
    expect(res.status).toBe(404)
  })
})

describe('renderer index.html CSP (regression: UR-002 broken posters)', () => {
  // The actual UR-002 root cause: index.html shipped a static
  // <meta http-equiv="Content-Security-Policy"> with `img-src 'self' data:`.
  // Browsers enforce the INTERSECTION of every CSP source, so that stricter
  // meta tag overrode the correct header policy (buildCsp) and blocked the
  // mw-art: scheme before any request reached the main-process handler.
  // CSP is owned by buildCsp at runtime; index.html must not re-declare a
  // policy that omits mw-art:.
  const html = readFileSync(
    fileURLToPath(new URL('../../renderer/index.html', import.meta.url)),
    'utf8'
  )
  const metaCsp = /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i.exec(html)

  it('does not carry a meta CSP that blocks the mw-art: image scheme', () => {
    if (metaCsp) {
      // If a meta policy is ever reintroduced it must not exclude mw-art: from img-src.
      expect(metaCsp[0]).toMatch(/img-src[^"';]*mw-art:/)
    } else {
      expect(metaCsp).toBeNull()
    }
  })
})

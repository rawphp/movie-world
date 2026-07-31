import { describe, it, expect } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  decodeArtUrl,
  buildCsp,
  serveArtFile,
  contentTypeFor,
  MW_ART_SCHEME,
  shouldApplyRendererCsp,
  shouldSetYoutubeReferer,
  withYoutubeRefererHeaders,
  YOUTUBE_EMBED_ORIGIN,
  YOUTUBE_EMBED_REFERER
} from '../art-protocol'
import {
  createTimingBuffer,
  classifyStartupFreeze,
  PRIMARY_FREEZE_ROOT_CAUSE
} from '../startup-timings'

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
    expect(csp).toMatch(/frame-src[^;]*https:\/\/www\.youtube-nocookie\.com/)
    expect(csp).toMatch(/child-src[^;]*https:\/\/www\.youtube\.com/)
    expect(csp).toMatch(/child-src[^;]*https:\/\/www\.youtube-nocookie\.com/)
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

describe('YouTube embed referer injection', () => {
  it('matches only YouTube embed hosts that need packaged file-origin headers', () => {
    expect(shouldSetYoutubeReferer('https://www.youtube.com/embed/abc')).toBe(true)
    expect(shouldSetYoutubeReferer('https://www.youtube-nocookie.com/embed/abc')).toBe(true)
    expect(shouldSetYoutubeReferer('mw-art://x')).toBe(false)
    expect(shouldSetYoutubeReferer('file:///Applications/MovieWorld/out/renderer/index.html')).toBe(
      false
    )
    expect(shouldSetYoutubeReferer('http://localhost:5173/')).toBe(false)
    expect(shouldSetYoutubeReferer('https://api.themoviedb.org/3/movie/1')).toBe(false)
    expect(shouldSetYoutubeReferer('https://rr1---sn.googlevideo.com/videoplayback')).toBe(false)
  })

  it('sets referer and origin only for matched YouTube requests', () => {
    const baseHeaders = { Accept: 'text/html' }

    expect(withYoutubeRefererHeaders('https://www.youtube.com/embed/abc', baseHeaders)).toEqual({
      Accept: 'text/html',
      Referer: YOUTUBE_EMBED_REFERER,
      Origin: YOUTUBE_EMBED_ORIGIN
    })

    expect(
      withYoutubeRefererHeaders('https://www.youtube-nocookie.com/embed/abc', baseHeaders)
    ).toEqual({
      Accept: 'text/html',
      Referer: 'https://www.youtube-nocookie.com/',
      Origin: 'https://www.youtube-nocookie.com'
    })

    const nonYoutubeUrls = [
      'mw-art://x',
      'file:///Applications/MovieWorld/out/renderer/index.html',
      'http://localhost:5173/',
      'https://api.themoviedb.org/3/movie/1',
      'https://rr1---sn.googlevideo.com/videoplayback'
    ]

    for (const url of nonYoutubeUrls) {
      expect(withYoutubeRefererHeaders(url, baseHeaders)).toBe(baseHeaders)
    }
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

  it('returns a 404 Response for an existing path that cannot be read as artwork', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mw-art-unreadable-'))
    const unreadable = join(dir, 'poster.jpg')
    mkdirSync(unreadable)

    const res = serveArtFile(`${MW_ART_SCHEME}://${encodeURIComponent(unreadable)}`)

    expect(res.status).toBe(404)
  })

  it('emits serveArtFile timing for the hot path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mw-art-time-'))
    const file = join(dir, 'poster.jpg')
    writeFileSync(file, Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
    const buffer = createTimingBuffer()

    serveArtFile(`${MW_ART_SCHEME}://${encodeURIComponent(file)}`, { onTiming: buffer.sink })

    expect(buffer.durationsFor('serveArtFile').length).toBe(1)
    expect(buffer.events[0]?.detail).toBe(file)
  })

  it('blocks the UI-critical path for the full slow-FS delay (cloud-only Drive poster)', () => {
    // Reproduce freeze scenario: grid painted from cache with posterPath on Drive
    // and no cachedPosterPath → artSrc falls back to Drive path → serveArtFile
    // does sync existsSync/readFileSync on a cloud-only file (REQ-037).
    const drivePoster = '/Google Drive/Movies/The Matrix (1999)-poster.jpg'
    const delayMs = 120
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
    const buffer = createTimingBuffer()
    const slowFs = {
      existsSync: (p: string): boolean => {
        const start = Date.now()
        while (Date.now() - start < delayMs) {
          /* busy-wait: cloud-only hydrate */
        }
        return p === drivePoster
      },
      readFileSync: (p: string): Buffer => {
        if (p !== drivePoster) throw new Error('ENOENT')
        return bytes
      }
    }

    const wallStart = performance.now()
    const res = serveArtFile(`${MW_ART_SCHEME}://${encodeURIComponent(drivePoster)}`, {
      fs: slowFs,
      onTiming: buffer.sink
    })
    const wallMs = performance.now() - wallStart

    expect(res.status).toBe(200)
    expect(wallMs).toBeGreaterThanOrEqual(delayMs - 5)
    const timed = buffer.durationsFor('serveArtFile')[0] ?? 0
    expect(timed).toBeGreaterThanOrEqual(delayMs - 5)

    // loadLibrary is not on this path — classify freeze as mw-art sync reads.
    expect(
      classifyStartupFreeze({
        loadLibraryMs: 5,
        backgroundDiscoverMs: 500,
        serveArtFileMs: timed,
        loadLibraryWaitedOnDiscover: false,
        blockingMs: 100
      })
    ).toBe(PRIMARY_FREEZE_ROOT_CAUSE)
    expect(PRIMARY_FREEZE_ROOT_CAUSE).toBe('a_mw_art_sync_reads')
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

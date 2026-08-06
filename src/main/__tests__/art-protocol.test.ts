import { describe, it, expect, vi } from 'vitest'
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
  it('permits mw-art: and TMDB image sources and the youtube trailer frame', () => {
    const csp = buildCsp(false)
    expect(csp).toMatch(/img-src[^;]*mw-art:/)
    expect(csp).toMatch(/img-src[^;]*https:\/\/image\.tmdb\.org/)
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
  /** userDataPath is required; artwork must live under `{userData}/cache` (REQ-047). */
  function makeCacheArt(
    name = 'poster.jpg'
  ): { userData: string; file: string; bytes: Buffer } {
    const userData = mkdtempSync(join(tmpdir(), 'mw-art-userdata-'))
    const file = join(userData, 'cache', 'sidecars', 'abc', name)
    mkdirSync(join(userData, 'cache', 'sidecars', 'abc'), { recursive: true })
    // A real (if tiny) JPEG: SOI + APP0/JFIF header + EOI.
    const bytes = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9
    ])
    writeFileSync(file, bytes)
    return { userData, file, bytes }
  }

  it('serves an existing cache file as a 200 with image/jpeg and the exact bytes', async () => {
    const { userData, file, bytes } = makeCacheArt('A Man Called Otto (2022)-poster.jpg')

    const res = serveArtFile(`${MW_ART_SCHEME}://${encodeURIComponent(file)}`, {
      userDataPath: userData
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/jpeg')
    const got = Buffer.from(await res.arrayBuffer())
    expect(got.equals(bytes)).toBe(true)
  })

  it('returns a 404 Response for a non-existent cache path without dual-mode bypass', () => {
    const userData = mkdtempSync(join(tmpdir(), 'mw-art-missing-'))
    const missing = join(userData, 'cache', 'sidecars', 'nope', 'poster.jpg')
    const res = serveArtFile(`${MW_ART_SCHEME}://${encodeURIComponent(missing)}`, {
      userDataPath: userData
    })
    expect(res.status).toBe(404)
  })

  it('returns a 404 Response for an existing cache path that cannot be read as artwork', () => {
    const userData = mkdtempSync(join(tmpdir(), 'mw-art-unreadable-'))
    const unreadable = join(userData, 'cache', 'sidecars', 'abc', 'poster.jpg')
    mkdirSync(unreadable, { recursive: true })

    const res = serveArtFile(`${MW_ART_SCHEME}://${encodeURIComponent(unreadable)}`, {
      userDataPath: userData
    })

    expect(res.status).toBe(404)
  })

  it('emits serveArtFile timing for the hot path', () => {
    const { userData, file } = makeCacheArt()
    const buffer = createTimingBuffer()

    serveArtFile(`${MW_ART_SCHEME}://${encodeURIComponent(file)}`, {
      onTiming: buffer.sink,
      userDataPath: userData
    })

    expect(buffer.durationsFor('serveArtFile').length).toBe(1)
    expect(buffer.events[0]?.detail).toBe(file)
  })

  it('fail-fast 404 for non-cache Drive paths without exists/read (REQ-047 strict cache)', () => {
    // Residual mw-art requests may still carry a Drive posterPath when
    // cachedPosterPath is missing. userDataPath is always required; serveArtFile
    // must not call existsSync/readFileSync on non-cache paths.
    const userData = '/Users/me/Library/Application Support/movie-world'
    const drivePoster = '/Google Drive/Movies/The Matrix (1999)-poster.jpg'
    const delayMs = 120
    let existsCalls = 0
    let readCalls = 0
    const buffer = createTimingBuffer()
    const slowFs = {
      existsSync: (p: string): boolean => {
        existsCalls++
        const start = Date.now()
        while (Date.now() - start < delayMs) {
          /* busy-wait: cloud-only hydrate */
        }
        return p === drivePoster
      },
      readFileSync: (p: string): Buffer => {
        readCalls++
        if (p !== drivePoster) throw new Error('ENOENT')
        return Buffer.from([0xff, 0xd8, 0xff, 0xd9])
      }
    }

    const wallStart = performance.now()
    const res = serveArtFile(`${MW_ART_SCHEME}://${encodeURIComponent(drivePoster)}`, {
      fs: slowFs,
      onTiming: buffer.sink,
      userDataPath: userData
    })
    const wallMs = performance.now() - wallStart

    expect(res.status).toBe(404)
    expect(existsCalls).toBe(0)
    expect(readCalls).toBe(0)
    expect(wallMs).toBeLessThan(delayMs / 2)

    const timed = buffer.durationsFor('serveArtFile')[0] ?? 0
    expect(timed).toBeLessThan(delayMs / 2)
    // Historical root cause label from REQ-037 still names the freeze class.
    expect(PRIMARY_FREEZE_ROOT_CAUSE).toBe('a_mw_art_sync_reads')
    expect(
      classifyStartupFreeze({
        loadLibraryMs: 5,
        backgroundDiscoverMs: 500,
        serveArtFileMs: timed,
        loadLibraryWaitedOnDiscover: false,
        blockingMs: 100
      })
    ).not.toBe(PRIMARY_FREEZE_ROOT_CAUSE)
  })

  it('serves app-owned cache paths without opening a Drive source path (REQ-038)', async () => {
    const userData = mkdtempSync(join(tmpdir(), 'mw-art-userdata-'))
    const cacheFile = join(userData, 'cache', 'sidecars', 'abc', 'poster.jpg')
    mkdirSync(join(userData, 'cache', 'sidecars', 'abc'), { recursive: true })
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
    writeFileSync(cacheFile, bytes)

    const drivePoster = '/Google Drive/Movies/The Matrix (1999)-poster.jpg'
    const delayMs = 120
    let driveTouched = false
    const slowFs = {
      existsSync: (p: string): boolean => {
        if (p === drivePoster || p.startsWith('/Google Drive/')) {
          driveTouched = true
          const start = Date.now()
          while (Date.now() - start < delayMs) {
            /* cloud-only */
          }
          return false
        }
        return p === cacheFile
      },
      readFileSync: (p: string): Buffer => {
        if (p === drivePoster || p.startsWith('/Google Drive/')) {
          driveTouched = true
          throw new Error('should not open Drive')
        }
        if (p !== cacheFile) throw new Error('ENOENT')
        return bytes
      }
    }

    const wallStart = performance.now()
    const res = serveArtFile(`${MW_ART_SCHEME}://${encodeURIComponent(cacheFile)}`, {
      fs: slowFs,
      userDataPath: userData
    })
    const wallMs = performance.now() - wallStart

    expect(res.status).toBe(200)
    expect(driveTouched).toBe(false)
    expect(wallMs).toBeLessThan(delayMs / 2)
    const got = Buffer.from(await res.arrayBuffer())
    expect(got.equals(bytes)).toBe(true)
  })

  it('does not allocate a full second copy via Uint8Array.from on cache serve (REQ-047)', async () => {
    const { userData, file, bytes } = makeCacheArt()
    const fromSpy = vi.spyOn(Uint8Array, 'from')

    const res = serveArtFile(`${MW_ART_SCHEME}://${encodeURIComponent(file)}`, {
      userDataPath: userData
    })

    expect(res.status).toBe(200)
    // Implementation must not Uint8Array.from(entireBuffer) — that doubles peak memory.
    expect(fromSpy).not.toHaveBeenCalled()
    fromSpy.mockRestore()

    const got = Buffer.from(await res.arrayBuffer())
    expect(got.equals(bytes)).toBe(true)
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

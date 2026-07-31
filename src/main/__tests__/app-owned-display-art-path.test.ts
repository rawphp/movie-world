/**
 * REQ-041 path-unit integration: display helpers → artSrc → serveArtFile.
 * Proves the user-visible paint path never opens Drive source art.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { displayFanartPath, displayPosterPath } from '../../shared/display-art'
import { artSrc } from '../../renderer/src/lib/art'
import { MW_ART_SCHEME, serveArtFile } from '../art-protocol'

describe('app-owned display art path (REQ-041)', () => {
  it('warm-start paint uses cache only: mw-art URL never encodes Drive posterPath', async () => {
    const userData = mkdtempSync(join(tmpdir(), 'mw-path-041-'))
    const cachePoster = join(userData, 'cache', 'sidecars', 'film', 'poster.jpg')
    mkdirSync(join(userData, 'cache', 'sidecars', 'film'), { recursive: true })
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
    writeFileSync(cachePoster, bytes)

    const drivePoster = '/Google Drive/Movies/Film-poster.jpg'
    const movie = {
      posterPath: drivePoster,
      fanartPath: '/Google Drive/Movies/Film-fanart.jpg',
      cachedPosterPath: cachePoster,
      cachedFanartPath: null as string | null
    }

    const paintPoster = displayPosterPath(movie)
    const paintFanart = displayFanartPath(movie)
    expect(paintPoster).toBe(cachePoster)
    expect(paintFanart).toBeNull()

    const posterUrl = artSrc(paintPoster)
    const fanartUrl = artSrc(paintFanart)
    expect(posterUrl).toBe(`${MW_ART_SCHEME}://${encodeURIComponent(cachePoster)}`)
    expect(posterUrl).not.toContain(encodeURIComponent(drivePoster))
    expect(fanartUrl).toBe('')

    let existsCalls = 0
    let readCalls = 0
    const res = serveArtFile(posterUrl, {
      userDataPath: userData,
      fs: {
        existsSync: (p: string): boolean => {
          existsCalls++
          return p === cachePoster
        },
        readFileSync: (p: string): Buffer => {
          readCalls++
          if (p !== cachePoster) throw new Error('ENOENT')
          return bytes
        }
      }
    })
    expect(res.status).toBe(200)
    expect(existsCalls).toBe(1)
    expect(readCalls).toBe(1)
    expect(Buffer.from(await res.arrayBuffer()).equals(bytes)).toBe(true)
  })

  it('incomplete cache (Drive only) paints empty src and protocol never opens Drive', () => {
    const userData = '/Users/me/Library/Application Support/movie-world'
    const drivePoster = '/Google Drive/Movies/Incomplete-poster.jpg'
    const movie = {
      posterPath: drivePoster,
      fanartPath: null as string | null,
      cachedPosterPath: null as string | null,
      cachedFanartPath: null as string | null
    }

    const paint = displayPosterPath(movie)
    expect(paint).toBeNull()
    expect(artSrc(paint)).toBe('')

    // Residual bad URL (legacy dual artSrc) must still fail-fast without FS.
    let existsCalls = 0
    let readCalls = 0
    const residual = `${MW_ART_SCHEME}://${encodeURIComponent(drivePoster)}`
    const res = serveArtFile(residual, {
      userDataPath: userData,
      fs: {
        existsSync: (): boolean => {
          existsCalls++
          return true
        },
        readFileSync: (): Buffer => {
          readCalls++
          return Buffer.from([0xff, 0xd8, 0xff, 0xd9])
        }
      }
    })
    expect(res.status).toBe(404)
    expect(existsCalls).toBe(0)
    expect(readCalls).toBe(0)
  })
})

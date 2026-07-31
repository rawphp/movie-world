import { describe, expect, it } from 'vitest'
import { artSrc } from '../art'
import { displayFanartPath, displayPosterPath } from '../../../../shared/display-art'

describe('artSrc (cache-only paint contract)', () => {
  it('encodes a non-null cache path as mw-art URL', () => {
    const cache = '/Users/me/Library/Application Support/movie-world/cache/poster.jpg'
    expect(artSrc(cache)).toBe(`mw-art://${encodeURIComponent(cache)}`)
  })

  it('returns empty string when cache path is null', () => {
    expect(artSrc(null)).toBe('')
  })

  it('returns empty string when cache path is undefined', () => {
    expect(artSrc(undefined)).toBe('')
  })

  it('never encodes Drive posterPath when cache is null (via display helpers)', () => {
    const movie = {
      cachedPosterPath: null as string | null,
      posterPath: '/Google Drive/Movies/Film-poster.jpg'
    }
    const paint = displayPosterPath(movie)
    const src = artSrc(paint)
    expect(paint).toBeNull()
    expect(src).toBe('')
    expect(src).not.toContain('Google Drive')
    expect(src).not.toContain(encodeURIComponent('/Google Drive/Movies/Film-poster.jpg'))
  })

  it('never encodes Drive fanartPath when cache is null (via display helpers)', () => {
    const movie = {
      cachedFanartPath: null as string | null,
      fanartPath: '/Google Drive/Movies/Film-fanart.jpg'
    }
    const paint = displayFanartPath(movie)
    const src = artSrc(paint)
    expect(paint).toBeNull()
    expect(src).toBe('')
    expect(src).not.toContain('Google Drive')
  })

  it('builds mw-art from cache path even when Drive path is also set', () => {
    const movie = {
      cachedPosterPath: '/userData/cache/art/poster.jpg',
      posterPath: '/Google Drive/Movies/Film-poster.jpg'
    }
    const src = artSrc(displayPosterPath(movie))
    expect(src).toContain(encodeURIComponent('/userData/cache/art/poster.jpg'))
    expect(src).not.toContain(encodeURIComponent('/Google Drive/Movies/Film-poster.jpg'))
  })

  it('does not accept dual-arg Drive fallback (single cache path only)', () => {
    // artSrc is cache-only: one optional path arg, not (drivePath, cachedPath)
    expect(artSrc.length).toBeLessThanOrEqual(1)
  })
})

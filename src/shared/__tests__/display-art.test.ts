import { describe, expect, it } from 'vitest'
import { displayFanartPath, displayPosterPath } from '../display-art'
import type { MovieRecord } from '../types'

function partialMovie(
  overrides: Partial<Pick<MovieRecord, 'posterPath' | 'fanartPath' | 'cachedPosterPath' | 'cachedFanartPath'>>
): Pick<MovieRecord, 'posterPath' | 'fanartPath' | 'cachedPosterPath' | 'cachedFanartPath'> {
  return {
    posterPath: null,
    fanartPath: null,
    cachedPosterPath: null,
    cachedFanartPath: null,
    ...overrides
  }
}

describe('display art helpers (cache-only paint contract)', () => {
  it('returns cachedPosterPath when cache is non-null', () => {
    const movie = partialMovie({
      cachedPosterPath: '/userData/cache/art/poster.jpg',
      posterPath: '/Google Drive/Movies/Film-poster.jpg'
    })
    expect(displayPosterPath(movie)).toBe('/userData/cache/art/poster.jpg')
  })

  it('returns null when cache poster is null even if Drive posterPath is set', () => {
    const movie = partialMovie({
      cachedPosterPath: null,
      posterPath: '/Google Drive/Movies/Film-poster.jpg'
    })
    expect(displayPosterPath(movie)).toBeNull()
  })

  it('returns null when both cachedPosterPath and posterPath are null', () => {
    const movie = partialMovie({
      cachedPosterPath: null,
      posterPath: null
    })
    expect(displayPosterPath(movie)).toBeNull()
  })

  it('returns cachedFanartPath when cache is non-null', () => {
    const movie = partialMovie({
      cachedFanartPath: '/userData/cache/art/fanart.jpg',
      fanartPath: '/Google Drive/Movies/Film-fanart.jpg'
    })
    expect(displayFanartPath(movie)).toBe('/userData/cache/art/fanart.jpg')
  })

  it('returns null when cache fanart is null even if Drive fanartPath is set', () => {
    const movie = partialMovie({
      cachedFanartPath: null,
      fanartPath: '/Google Drive/Movies/Film-fanart.jpg'
    })
    expect(displayFanartPath(movie)).toBeNull()
  })

  it('returns null when both cachedFanartPath and fanartPath are null', () => {
    const movie = partialMovie({
      cachedFanartPath: null,
      fanartPath: null
    })
    expect(displayFanartPath(movie)).toBeNull()
  })

  it('treats missing (undefined) cache fields as null and ignores Drive paths', () => {
    const movie = partialMovie({
      cachedPosterPath: undefined,
      cachedFanartPath: undefined,
      posterPath: '/drive/poster.jpg',
      fanartPath: '/drive/fanart.jpg'
    })
    expect(displayPosterPath(movie)).toBeNull()
    expect(displayFanartPath(movie)).toBeNull()
  })
})

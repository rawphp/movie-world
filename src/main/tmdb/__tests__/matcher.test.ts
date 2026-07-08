import { describe, it, expect } from 'vitest'
import { pickConfidentMatch, applyDetails } from '../matcher'
import type { TmdbMovieDetails } from '../client'
import type { MovieRecord } from '../../../shared/types'

const r = (
  id: number,
  title: string,
  date?: string
): { id: number; title: string; release_date?: string } => ({
  id,
  title,
  release_date: date
})

describe('pickConfidentMatch', () => {
  it('matches normalized title + year within ±1', () => {
    expect(
      pickConfidentMatch({ title: 'the matrix', year: 2000 }, [r(603, 'The Matrix', '1999-03-30')])
        ?.id
    ).toBe(603)
  })
  it('rejects when year is too far off', () => {
    expect(
      pickConfidentMatch({ title: 'The Matrix', year: 1985 }, [r(603, 'The Matrix', '1999-03-30')])
    ).toBeNull()
  })
  it('skips year check when filename had no year, but requires exact title', () => {
    expect(
      pickConfidentMatch({ title: 'Alien', year: null }, [r(348, 'Alien', '1979-05-25')])?.id
    ).toBe(348)
    expect(
      pickConfidentMatch({ title: 'Alien', year: null }, [r(8078, 'Aliens', '1986-07-18')])
    ).toBeNull()
  })
  it('finds the right candidate below the top result', () => {
    const results = [
      r(1, 'The Matrix Resurrections', '2021-12-16'),
      r(603, 'The Matrix', '1999-03-30')
    ]
    expect(pickConfidentMatch({ title: 'The Matrix', year: 1999 }, results)?.id).toBe(603)
  })
})

describe('applyDetails', () => {
  const pending: MovieRecord = {
    id: 'x',
    filePath: '/m/f.mkv',
    fileSize: 0,
    folderPath: '/m',
    parsedTitle: 'The Matrix',
    parsedYear: 1999,
    matchStatus: 'pending',
    tmdbId: null,
    title: null,
    originalTitle: null,
    year: null,
    overview: null,
    runtime: null,
    voteAverage: null,
    genres: [],
    cast: [],
    certifications: {},
    certificationAu: null,
    trailerYoutubeKey: null,
    playCount: 0,
    lastPlayedAt: null,
    fileMissing: false,
    sidecarWriteFailed: false,
    fetchFailed: false,
    posterPath: null,
    fanartPath: null
  }

  it('maps details into a matched MovieRecord', () => {
    const details: TmdbMovieDetails = {
      id: 603,
      title: 'The Matrix',
      original_title: 'The Matrix',
      release_date: '1999-03-30',
      overview: 'plot',
      runtime: 136,
      vote_average: 8.22,
      genres: [{ id: 28, name: 'Action' }],
      poster_path: '/p.jpg',
      backdrop_path: '/b.jpg',
      credits: { cast: [0, 1, 2, 3, 4, 5].map((i) => ({ name: `Actor ${i}`, order: i })) },
      videos: {
        results: [
          { site: 'YouTube', type: 'Teaser', key: 'teaser', official: true },
          { site: 'YouTube', type: 'Trailer', key: 'trailerKey', official: true }
        ]
      },
      release_dates: {
        results: [
          { iso_3166_1: 'AU', release_dates: [{ certification: 'MA15+' }] },
          { iso_3166_1: 'US', release_dates: [{ certification: '' }, { certification: 'R' }] }
        ]
      }
    }

    const m = applyDetails(pending, details)
    expect(m).not.toBe(pending)
    expect(pending.matchStatus).toBe('pending') // original untouched
    expect(m.matchStatus).toBe('matched')
    expect(m.tmdbId).toBe(603)
    expect(m.title).toBe('The Matrix')
    expect(m.year).toBe(1999)
    expect(m.runtime).toBe(136)
    expect(m.overview).toBe('plot')
    expect(m.voteAverage).toBe(8.22)
    expect(m.genres).toEqual(['Action'])
    expect(m.cast).toHaveLength(5) // top 5 only
    expect(m.cast[0]).toEqual({ name: 'Actor 0', order: 0 })
    expect(m.certificationAu).toBe('MA15+')
    expect(m.certifications).toEqual({ AU: 'MA15+', US: 'R' })
    expect(m.trailerYoutubeKey).toBe('trailerKey') // prefers official Trailer over Teaser
  })

  it('falls back US → GB → first-available when there is no AU certification', () => {
    const noAu: TmdbMovieDetails = {
      id: 1,
      title: 'X',
      release_dates: {
        results: [
          { iso_3166_1: 'GB', release_dates: [{ certification: '15' }] },
          { iso_3166_1: 'US', release_dates: [{ certification: 'R' }] },
          { iso_3166_1: 'FR', release_dates: [{ certification: '12' }] }
        ]
      }
    }
    const usFallback = applyDetails(pending, noAu)
    expect(usFallback.certificationAu).toBe('R') // US preferred over GB
    expect(usFallback.certifications).toEqual({ GB: '15', US: 'R', FR: '12' })

    const gbFallback = applyDetails(pending, {
      id: 2,
      title: 'Y',
      release_dates: {
        results: [
          { iso_3166_1: 'GB', release_dates: [{ certification: '15' }] },
          { iso_3166_1: 'FR', release_dates: [{ certification: '12' }] }
        ]
      }
    })
    expect(gbFallback.certificationAu).toBe('15') // GB preferred over first-available

    const firstAvailable = applyDetails(pending, {
      id: 3,
      title: 'Z',
      release_dates: {
        results: [{ iso_3166_1: 'FR', release_dates: [{ certification: '12' }] }]
      }
    })
    expect(firstAvailable.certificationAu).toBe('12') // first-available when no AU/US/GB
  })

  it('leaves certificationAu null when no certifications exist', () => {
    const m = applyDetails(pending, { id: 4, title: 'Q' })
    expect(m.certificationAu).toBeNull()
    expect(m.certifications).toEqual({})
    expect(m.trailerYoutubeKey).toBeNull()
  })
})

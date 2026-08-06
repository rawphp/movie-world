import { describe, it, expect } from 'vitest'
import {
  filterMovies,
  filtersAreActive,
  normalizeCertification,
  sortMovies,
  EMPTY_FILTERS
} from '../filtering'
import type { MovieRecord } from '../../../../shared/types'

const movie = (over: Partial<MovieRecord>): MovieRecord => ({
  id: over.title ?? 'id',
  filePath: '/f',
  fileSize: 0,
  folderPath: '/',
  parsedTitle: '',
  parsedYear: null,
  matchStatus: 'matched',
  tmdbId: 1,
  title: 'T',
  originalTitle: null,
  year: 2000,
  overview: null,
  runtime: null,
  voteAverage: 5,
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
  fanartPath: null,
  ...over
})

const matrix = movie({
  title: 'The Matrix',
  year: 1999,
  genres: ['Action'],
  voteAverage: 8.2,
  certificationAu: 'MA15+',
  cast: [{ name: 'Keanu Reeves', order: 0 }],
  playCount: 2,
  lastPlayedAt: '2026-07-01T00:00:00.000Z'
})
const alien = movie({
  title: 'Alien',
  year: 1979,
  genres: ['Horror'],
  voteAverage: 8.1,
  certificationAu: 'M',
  cast: [{ name: 'Sigourney Weaver', order: 0 }]
})
const up = movie({
  title: 'Up',
  year: 2009,
  genres: ['Animation'],
  voteAverage: 7.9,
  certificationAu: 'PG',
  cast: []
})
const all = [matrix, alien, up]

describe('filterMovies', () => {
  it('empty filters return everything', () =>
    expect(filterMovies(all, EMPTY_FILTERS)).toHaveLength(3))
  it('search matches title case-insensitively', () =>
    expect(filterMovies(all, { ...EMPTY_FILTERS, search: 'matr' })).toEqual([matrix]))
  it('filters by genre, certification, min rating, actor', () => {
    expect(filterMovies(all, { ...EMPTY_FILTERS, genre: 'Horror' })).toEqual([alien])
    expect(filterMovies(all, { ...EMPTY_FILTERS, certification: 'PG' })).toEqual([up])
    expect(filterMovies(all, { ...EMPTY_FILTERS, minRating: 8 })).toEqual([matrix, alien])
    expect(filterMovies(all, { ...EMPTY_FILTERS, actor: 'Sigourney Weaver' })).toEqual([alien])
  })
  it('matches actor names partially and normalizes AU certification variants', () => {
    expect(filterMovies(all, { ...EMPTY_FILTERS, actor: 'keanu' })).toEqual([matrix])
    expect(filterMovies(all, { ...EMPTY_FILTERS, certification: 'MA 15+' })).toEqual([matrix])
    expect(filterMovies(all, { ...EMPTY_FILTERS, certification: 'MA15+' })).toEqual([matrix])
  })
  it('detects active filters', () => {
    expect(filtersAreActive(EMPTY_FILTERS)).toBe(false)
    expect(filtersAreActive({ ...EMPTY_FILTERS, search: 'x' })).toBe(true)
    expect(filtersAreActive({ ...EMPTY_FILTERS, watched: 'watched' })).toBe(true)
  })
  it('normalizes certification display forms', () => {
    expect(normalizeCertification('MA15+')).toBe('MA 15+')
    expect(normalizeCertification('MA 15+')).toBe('MA 15+')
    expect(normalizeCertification('R18+')).toBe('R 18+')
  })
  it('filters by year', () =>
    expect(filterMovies(all, { ...EMPTY_FILTERS, year: 2009 })).toEqual([up]))
  it('filters by watched state', () => {
    expect(filterMovies(all, { ...EMPTY_FILTERS, watched: 'watched' })).toEqual([matrix])
    expect(filterMovies(all, { ...EMPTY_FILTERS, watched: 'unwatched' })).toEqual([alien, up])
  })
  it('combines filters with AND', () =>
    expect(filterMovies(all, { ...EMPTY_FILTERS, minRating: 7, genre: 'Action' })).toEqual([
      matrix
    ]))
})

describe('sortMovies', () => {
  it('sorts by title, year, rating, lastWatched', () => {
    expect(sortMovies(all, 'title').map((m) => m.title)).toEqual(['Alien', 'The Matrix', 'Up'])
    expect(sortMovies(all, 'year').map((m) => m.title)).toEqual(['Up', 'The Matrix', 'Alien'])
    expect(sortMovies(all, 'rating').map((m) => m.title)).toEqual(['The Matrix', 'Alien', 'Up'])
    expect(sortMovies(all, 'lastWatched')[0].title).toBe('The Matrix')
  })
})

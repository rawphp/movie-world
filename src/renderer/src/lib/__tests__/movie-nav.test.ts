import { describe, expect, it } from 'vitest'
import { adjacentMovieId } from '../movie-nav'
import type { MovieRecord } from '../../../../shared/types'

const movie = (id: string): MovieRecord => ({ id }) as MovieRecord

describe('adjacentMovieId', () => {
  it('returns next and previous ids in list order', () => {
    const list = [movie('a'), movie('b'), movie('c')]

    expect(adjacentMovieId(list, 'b', 'next')).toBe('c')
    expect(adjacentMovieId(list, 'b', 'prev')).toBe('a')
  })

  it('wraps at both edges', () => {
    const list = [movie('a'), movie('b'), movie('c')]

    expect(adjacentMovieId(list, 'c', 'next')).toBe('a')
    expect(adjacentMovieId(list, 'a', 'prev')).toBe('c')
  })

  it('returns null for empty and single-item lists', () => {
    expect(adjacentMovieId([], 'a', 'next')).toBeNull()
    expect(adjacentMovieId([movie('a')], 'a', 'next')).toBeNull()
    expect(adjacentMovieId([movie('a')], 'missing', 'prev')).toBeNull()
  })

  it('falls back to first or last when the current id is absent', () => {
    const list = [movie('a'), movie('b'), movie('c')]

    expect(adjacentMovieId(list, 'missing', 'next')).toBe('a')
    expect(adjacentMovieId(list, 'missing', 'prev')).toBe('c')
  })
})

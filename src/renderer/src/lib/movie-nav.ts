import type { MovieRecord } from '../../../shared/types'

export type MovieNavDirection = 'prev' | 'next'

export function adjacentMovieId(
  list: MovieRecord[],
  currentId: string,
  direction: MovieNavDirection
): string | null {
  if (list.length <= 1) {
    return null
  }

  const currentIndex = list.findIndex((movie) => movie.id === currentId)

  if (currentIndex === -1) {
    return direction === 'next' ? list[0].id : list[list.length - 1].id
  }

  const nextIndex =
    direction === 'next'
      ? (currentIndex + 1) % list.length
      : (currentIndex - 1 + list.length) % list.length

  return list[nextIndex].id
}

import { describe, it, expect } from 'vitest'
import { parseFilename } from '../filename-parser'

// [input, expectedTitle, expectedYear]
const cases: Array<[string, string, number | null]> = [
  // Dotted name with release tags stripped.
  ['The.Matrix.1999.1080p.BluRay.x264.mkv', 'The Matrix', 1999],
  ['Inception (2010).mp4', 'Inception', 2010],
  // Year-less files.
  ['Alien.mkv', 'Alien', null],
  ['Up.mov', 'Up', null],
  // Leading digits that form part of the title, not the year.
  ['2001.A.Space.Odyssey.1968.720p.mkv', '2001 A Space Odyssey', 1968],
  // Release-tag-laden names.
  ['Heat 1995 REMASTERED 1080p WEB-DL.mkv', 'Heat', 1995],
  ['Blade_Runner_[1982]_Directors_Cut.avi', 'Blade Runner', 1982],
  ['Parasite.2019.KOREAN.2160p.4K.HDR.x265-GRP.mkv', 'Parasite', 2019],
  // A resolution-like 4-digit sequence must not be treated as a year.
  ['Interstellar.2160p.mkv', 'Interstellar', null],
  // Folder-name fallback (UR-001): caller passes the parent folder name when the
  // filename itself is unhelpful. Folder names have no file extension.
  ['The Matrix (1999)', 'The Matrix', 1999],
  // Unhelpful filename that triggers the folder-name fallback upstream.
  ['movie.mkv', 'movie', null]
]

describe('parseFilename', () => {
  it.each(cases)('%s → %s (%s)', (input, title, year) => {
    expect(parseFilename(input)).toEqual({ title, year })
  })
})

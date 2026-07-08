import { describe, it, expect } from 'vitest'
import type {
  CastMember,
  MatchStatus,
  MovieRecord,
  ParsedFilename,
  ScanProgress,
  Settings
} from '@shared/types'

describe('shared domain types', () => {
  it('constructs a fully-populated MovieRecord', () => {
    const cast: CastMember = { name: 'Jane Doe', order: 0 }
    const parsed: ParsedFilename = { title: 'Blade Runner', year: 1982 }
    const status: MatchStatus = 'matched'

    const record: MovieRecord = {
      id: 'abc123',
      filePath: '/Movies/Blade Runner (1982).mkv',
      fileSize: 1024,
      folderPath: '/Movies',
      parsedTitle: parsed.title,
      parsedYear: parsed.year,
      matchStatus: status,
      tmdbId: 78,
      title: 'Blade Runner',
      originalTitle: 'Blade Runner',
      year: 1982,
      overview: 'A blade runner hunts replicants.',
      runtime: 117,
      voteAverage: 8.1,
      genres: ['Science Fiction'],
      cast: [cast],
      certifications: { US: 'R', AU: 'M' },
      certificationAu: 'M',
      trailerYoutubeKey: 'eogpIG53Cis',
      playCount: 0,
      lastPlayedAt: null,
      fileMissing: false,
      sidecarWriteFailed: false,
      fetchFailed: false,
      posterPath: '/Movies/Blade Runner (1982)-poster.jpg',
      fanartPath: null
    }

    expect(record.matchStatus).toBe('matched')
    expect(record.cast[0].order).toBe(0)
  })

  it('constructs Settings and ScanProgress', () => {
    const settings: Settings = { folders: ['/Movies'], tmdbApiKey: null }
    const progress: ScanProgress = {
      folder: '/Movies',
      discovered: 3,
      ingested: 3,
      done: true
    }

    expect(settings.folders).toEqual(['/Movies'])
    expect(progress.done).toBe(true)
  })
})

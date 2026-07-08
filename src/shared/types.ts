export type MatchStatus = 'pending' | 'matched' | 'unmatched'

export interface CastMember {
  name: string
  order: number
}

export interface ParsedFilename {
  title: string
  year: number | null
}

export interface MovieRecord {
  id: string // sha1 of filePath
  filePath: string
  fileSize: number
  folderPath: string // the registered library folder containing this file
  parsedTitle: string
  parsedYear: number | null
  matchStatus: MatchStatus
  tmdbId: number | null
  title: string | null
  originalTitle: string | null
  year: number | null
  overview: string | null
  runtime: number | null // minutes
  voteAverage: number | null // 0–10 TMDB scale
  genres: string[]
  cast: CastMember[] // top 5, billing order
  certifications: Record<string, string> // ISO country -> certification
  certificationAu: string | null
  trailerYoutubeKey: string | null
  playCount: number
  lastPlayedAt: string | null // ISO 8601
  fileMissing: boolean
  sidecarWriteFailed: boolean
  fetchFailed: boolean
  posterPath: string | null // absolute path on disk
  fanartPath: string | null
}

export interface Settings {
  folders: string[]
  tmdbApiKey: string | null
}

export interface ScanProgress {
  folder: string
  discovered: number
  ingested: number
  done: boolean
}

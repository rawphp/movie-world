# Movie World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An installable Electron desktop app that turns folders of movie files into a filterable, TMDB-enriched poster library, persisting everything as Kodi-compatible NFO sidecar files.

**Architecture:** Electron main process owns all filesystem/network work (scanning, NFO read/write, TMDB fetching, external-player launch) and streams `MovieRecord` updates to a Vue 3 renderer over typed IPC. There is no database: NFO sidecars on disk are the persistence layer, loaded into memory at launch; filtering/sorting is in-memory in a Pinia store. Spec: `docs/superpowers/specs/2026-07-08-movie-world-design.md`.

**Tech Stack:** Electron + electron-vite (Vue 3 + TypeScript template), Tailwind CSS 4, Pinia, Vue Router (hash mode), fast-xml-parser, Vitest (+ @vue/test-utils, jsdom), electron-builder.

## Global Constraints

- TypeScript throughout; `npx tsc --noEmit` must pass with zero errors.
- `npx eslint . --max-warnings 0` must pass before every commit.
- `npx vitest run` must pass 100% before every commit. Never skip a test.
- Video extensions: `.mkv .mp4 .avi .mov .m4v .wmv .webm` (exactly this set).
- Displayed age rating: Australian certification (G/PG/M/MA15+/R18+); all countries stored.
- Sidecar naming (Kodi convention, next to the movie file): `<stem>.nfo`, `<stem>-poster.jpg`, `<stem>-fanart.jpg`.
- Watch state lives in NFO tags `<playcount>` and `<lastplayed>` — never in a separate store.
- TMDB fetch concurrency: 4. Retries: 3 with exponential backoff.
- Renderer has no Node/fs access: `contextIsolation: true`, everything via the preload-exposed `window.api`.
- Match confidence rule: normalized-title equality AND year within ±1 (year check skipped when filename has no year).
- Commit after every task. No co-author trailers on commits.

## File Structure

```
src/shared/types.ts                     MovieRecord, Settings, IPC payloads (single source of truth)
src/main/index.ts                       app lifecycle, BrowserWindow, wiring
src/main/settings.ts                    JSON settings store (folders, apiKey) — factory, testable
src/main/library/filename-parser.ts     title/year extraction from filenames
src/main/library/nfo.ts                 NFO XML build/parse + sidecar path mapping
src/main/library/scanner.ts             recursive video discovery + per-file ingest (NFO or pending)
src/main/library/manager.ts             in-memory library: load/rescan/fixMatch/play orchestration
src/main/tmdb/client.ts                 TMDB v3 HTTP client (injectable fetch)
src/main/tmdb/matcher.ts                confidence matching + details→record mapping
src/main/tmdb/fetcher.ts                concurrency-limited fetch queue with retries; writes sidecars
src/main/player.ts                      shell.openPath + watch-state stamping
src/main/ipc.ts                         ipcMain.handle registrations (thin: delegates to manager)
src/preload/index.ts                    contextBridge window.api
src/renderer/src/lib/filtering.ts       pure filter/sort functions
src/renderer/src/stores/library.ts      Pinia: movies, filters, sort, live updates
src/renderer/src/router.ts              routes: / (library), /movie/:id, /settings
src/renderer/src/views/*.vue            LibraryView, MovieDetailView, SettingsView
src/renderer/src/components/*.vue       MovieCard, FilterBar, FixMatchDialog, StarRating
tests mirror sources: src/**/__tests__/<name>.test.ts (node env default; jsdom pragma in component tests)
```

---

### Task 1: Scaffold project & tooling

**Files:**

- Create: entire electron-vite scaffold, `tailwind` wiring, `vitest.config.ts`
- Modify: `package.json`, `.gitignore`

**Interfaces:**

- Produces: working `npm run dev` (Electron window), `npx vitest run`, `npx eslint .`, `npx tsc --noEmit`.

- [ ] **Step 1: Scaffold electron-vite Vue-TS template into the repo**

The repo already contains `docs/` and `.git`, so scaffold into a temp dir and merge:

```bash
cd /Users/tomkaczocha/EA/projects/movie-world
npm create @quick-start/electron@latest tmp-scaffold -- --template vue-ts --skip
rsync -a tmp-scaffold/ . && rm -rf tmp-scaffold
npm install
```

(If the creator prompts interactively, answer: no Electron updater, no install-and-run.)

- [ ] **Step 2: Add runtime + test dependencies**

```bash
npm i pinia vue-router fast-xml-parser
npm i -D tailwindcss @tailwindcss/vite vitest @vue/test-utils jsdom
```

- [ ] **Step 3: Wire Tailwind 4**

In `electron.vite.config.ts`, add to the **renderer** section:

```ts
import tailwindcss from '@tailwindcss/vite'
// renderer: { plugins: [vue(), tailwindcss()] }
```

Replace `src/renderer/src/assets/main.css` (or the template's base css import) content with:

```css
@import 'tailwindcss';
```

- [ ] **Step 4: Add Vitest config**

Create `vitest.config.ts` at repo root:

```ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'node', // component tests opt into jsdom via // @vitest-environment jsdom
    include: ['src/**/__tests__/**/*.test.ts']
  },
  resolve: {
    alias: { '@renderer': '/src/renderer/src', '@shared': '/src/shared' }
  }
})
```

Add scripts to `package.json`: `"test": "vitest run"`.

- [ ] **Step 5: Verify everything runs**

```bash
npm run dev &   # expect an Electron window to open; then kill it
npx vitest run  # expect "no test files found" exit 0 (or template sample passes)
npx eslint . --max-warnings 0
npx tsc --noEmit
```

Fix any template lint/type noise now (delete unused template demo components rather than suppressing).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold electron-vite vue-ts app with tailwind, vitest, eslint"
```

---

### Task 2: Shared types & settings store

**Files:**

- Create: `src/shared/types.ts`, `src/main/settings.ts`
- Test: `src/main/__tests__/settings.test.ts`

**Interfaces:**

- Produces: `MovieRecord`, `MatchStatus`, `CastMember`, `Settings`, `ParsedFilename` types; `createSettingsStore(filePath)` with `read(): Settings`, `setApiKey(key: string): Settings`, `addFolder(path: string): Settings`, `removeFolder(path: string): Settings`. Every later task imports these types — copy signatures exactly.

- [ ] **Step 1: Write `src/shared/types.ts`**

```ts
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
```

- [ ] **Step 2: Write the failing settings test**

`src/main/__tests__/settings.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSettingsStore } from '../settings'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mw-settings-'))
  return () => rmSync(dir, { recursive: true, force: true })
})

describe('settings store', () => {
  it('returns defaults when file does not exist', () => {
    const s = createSettingsStore(join(dir, 'settings.json'))
    expect(s.read()).toEqual({ folders: [], tmdbApiKey: null })
  })

  it('persists api key and folders across instances', () => {
    const file = join(dir, 'settings.json')
    const a = createSettingsStore(file)
    a.setApiKey('k123')
    a.addFolder('/Movies')
    a.addFolder('/Movies') // dedupe
    a.addFolder('/More')
    a.removeFolder('/More')
    const b = createSettingsStore(file)
    expect(b.read()).toEqual({ folders: ['/Movies'], tmdbApiKey: 'k123' })
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/main/__tests__/settings.test.ts`
Expected: FAIL — cannot resolve `../settings`.

- [ ] **Step 4: Implement `src/main/settings.ts`**

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Settings } from '../shared/types'

const DEFAULTS: Settings = { folders: [], tmdbApiKey: null }

export type SettingsStore = ReturnType<typeof createSettingsStore>

export function createSettingsStore(file: string) {
  function read(): Settings {
    if (!existsSync(file)) return { ...DEFAULTS }
    return { ...DEFAULTS, ...(JSON.parse(readFileSync(file, 'utf8')) as Partial<Settings>) }
  }
  function write(patch: Partial<Settings>): Settings {
    const next = { ...read(), ...patch }
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(next, null, 2))
    return next
  }
  return {
    read,
    setApiKey: (key: string) => write({ tmdbApiKey: key }),
    addFolder: (path: string) => write({ folders: [...new Set([...read().folders, path])] }),
    removeFolder: (path: string) => write({ folders: read().folders.filter((f) => f !== path) })
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/main/__tests__/settings.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
npx eslint . --max-warnings 0 && npx tsc --noEmit
git add -A && git commit -m "feat: shared MovieRecord types and JSON settings store"
```

---

### Task 3: Filename parser

**Files:**

- Create: `src/main/library/filename-parser.ts`
- Test: `src/main/library/__tests__/filename-parser.test.ts`

**Interfaces:**

- Consumes: `ParsedFilename` from `@shared/types` (Task 2)
- Produces: `parseFilename(basename: string): ParsedFilename`

- [ ] **Step 1: Write the failing table-driven test**

`src/main/library/__tests__/filename-parser.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseFilename } from '../filename-parser'

const cases: Array<[string, string, number | null]> = [
  ['The.Matrix.1999.1080p.BluRay.x264.mkv', 'The Matrix', 1999],
  ['Inception (2010).mp4', 'Inception', 2010],
  ['Alien.mkv', 'Alien', null],
  ['2001.A.Space.Odyssey.1968.720p.mkv', '2001 A Space Odyssey', 1968],
  ['Heat 1995 REMASTERED 1080p WEB-DL.mkv', 'Heat', 1995],
  ['Blade_Runner_[1982]_Directors_Cut.avi', 'Blade Runner', 1982],
  ['Parasite.2019.KOREAN.2160p.4K.HDR.x265-GRP.mkv', 'Parasite', 2019],
  ['Up.mov', 'Up', null]
]

describe('parseFilename', () => {
  it.each(cases)('%s → %s (%s)', (input, title, year) => {
    expect(parseFilename(input)).toEqual({ title, year })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/library/__tests__/filename-parser.test.ts`
Expected: FAIL — cannot resolve `../filename-parser`.

- [ ] **Step 3: Implement `src/main/library/filename-parser.ts`**

```ts
import type { ParsedFilename } from '../../shared/types'

// Everything from the first release-tag onward is noise.
const RELEASE_TAGS =
  /\b(480p|576p|720p|1080p|2160p|4k|uhd|bluray|blu-ray|bdrip|brrip|webrip|web-dl|webdl|hdtv|dvdrip|hdrip|remux|x264|x265|h\.?264|h\.?265|hevc|avc|aac|ac3|dts|atmos|10bit|hdr|proper|repack|remastered|extended|unrated|imax|korean|directors cut)\b.*$/i

export function parseFilename(basename: string): ParsedFilename {
  const stem = basename.replace(/\.[^.]+$/, '')
  let working = stem.replace(/[._]/g, ' ').replace(/[[\]]/g, ' ').replace(/\s+/g, ' ').trim()

  let year: number | null = null
  // Last standalone 19xx/20xx not at position 0 (so "2001 A Space Odyssey" keeps its title).
  const matches = [...working.matchAll(/(?:^|[( ])((?:19|20)\d{2})(?:[) ]|$)/g)].filter(
    (m) => (m.index ?? 0) > 0
  )
  const last = matches.at(-1)
  if (last) {
    year = Number(last[1])
    working = working.slice(0, last.index)
  }

  working = working.replace(RELEASE_TAGS, '')
  const title = working
    .replace(/[({[\-\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return { title: title || stem, year }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/library/__tests__/filename-parser.test.ts`
Expected: PASS (8 cases). If a case fails, fix the parser — do not change expected values.

- [ ] **Step 5: Commit**

```bash
npx eslint . --max-warnings 0 && npx tsc --noEmit
git add -A && git commit -m "feat: filename parser extracting title and year from release names"
```

---

### Task 4: NFO read/write

**Files:**

- Create: `src/main/library/nfo.ts`
- Test: `src/main/library/__tests__/nfo.test.ts`

**Interfaces:**

- Consumes: `MovieRecord`, `CastMember` (Task 2)
- Produces:
  - `sidecarPathsFor(filePath: string): { nfo: string; poster: string; fanart: string }`
  - `movieToNfoXml(movie: MovieRecord): string`
  - `parseNfoXml(xml: string): NfoData` where `NfoData = { tmdbId, title, originalTitle, year, overview, runtime, voteAverage, genres, cast, certifications, certificationAu, trailerYoutubeKey, playCount, lastPlayedAt }` (same field types as the matching `MovieRecord` fields)
  - `writeSidecarNfo(movie: MovieRecord): void` (throws on fs error — caller handles)
  - `readSidecarNfo(filePath: string): NfoData | null` (null when no NFO exists)

- [ ] **Step 1: Write the failing round-trip test**

`src/main/library/__tests__/nfo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { movieToNfoXml, parseNfoXml, sidecarPathsFor, readSidecarNfo } from '../nfo'
import type { MovieRecord } from '../../../shared/types'

const movie: MovieRecord = {
  id: 'abc',
  filePath: '/Movies/The Matrix (1999)/The Matrix (1999).mkv',
  fileSize: 1,
  folderPath: '/Movies',
  parsedTitle: 'The Matrix',
  parsedYear: 1999,
  matchStatus: 'matched',
  tmdbId: 603,
  title: 'The Matrix',
  originalTitle: 'The Matrix',
  year: 1999,
  overview: 'A hacker learns the truth. <Reality> & "choice".',
  runtime: 136,
  voteAverage: 8.2,
  genres: ['Action', 'Science Fiction'],
  cast: [
    { name: 'Keanu Reeves', order: 0 },
    { name: 'Laurence Fishburne', order: 1 }
  ],
  certifications: { AU: 'MA15+', US: 'R' },
  certificationAu: 'MA15+',
  trailerYoutubeKey: 'vKQi3bBA1y8',
  playCount: 2,
  lastPlayedAt: '2026-07-01T10:00:00.000Z',
  fileMissing: false,
  sidecarWriteFailed: false,
  fetchFailed: false,
  posterPath: null,
  fanartPath: null
}

describe('nfo', () => {
  it('maps sidecar paths from the movie file stem', () => {
    expect(sidecarPathsFor('/m/Alien.mkv')).toEqual({
      nfo: '/m/Alien.nfo',
      poster: '/m/Alien-poster.jpg',
      fanart: '/m/Alien-fanart.jpg'
    })
  })

  it('round-trips all metadata through Kodi XML', () => {
    const data = parseNfoXml(movieToNfoXml(movie))
    expect(data).toEqual({
      tmdbId: 603,
      title: 'The Matrix',
      originalTitle: 'The Matrix',
      year: 1999,
      overview: 'A hacker learns the truth. <Reality> & "choice".',
      runtime: 136,
      voteAverage: 8.2,
      genres: ['Action', 'Science Fiction'],
      cast: movie.cast,
      certifications: { AU: 'MA15+', US: 'R' },
      certificationAu: 'MA15+',
      trailerYoutubeKey: 'vKQi3bBA1y8',
      playCount: 2,
      lastPlayedAt: '2026-07-01T10:00:00.000Z'
    })
  })

  it('readSidecarNfo returns null when absent, data when present', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mw-nfo-'))
    const file = join(dir, 'The Matrix (1999).mkv')
    expect(readSidecarNfo(file)).toBeNull()
    writeFileSync(sidecarPathsFor(file).nfo, movieToNfoXml(movie))
    expect(readSidecarNfo(file)?.tmdbId).toBe(603)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/library/__tests__/nfo.test.ts`
Expected: FAIL — cannot resolve `../nfo`.

- [ ] **Step 3: Implement `src/main/library/nfo.ts`**

Kodi mapping notes: single `<mpaa>` string holds ALL certifications joined as `AU:MA15+ / US:R` (AU first — Kodi shows it as-is, we parse it back). Trailer stored in Kodi's YouTube-plugin URL form. Watch state in `<playcount>`/`<lastplayed>`.

```ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import type { CastMember, MovieRecord } from '../../shared/types'

export interface NfoData {
  tmdbId: number | null
  title: string | null
  originalTitle: string | null
  year: number | null
  overview: string | null
  runtime: number | null
  voteAverage: number | null
  genres: string[]
  cast: CastMember[]
  certifications: Record<string, string>
  certificationAu: string | null
  trailerYoutubeKey: string | null
  playCount: number
  lastPlayedAt: string | null
}

export function sidecarPathsFor(filePath: string) {
  const stem = filePath.replace(/\.[^.]+$/, '')
  return { nfo: `${stem}.nfo`, poster: `${stem}-poster.jpg`, fanart: `${stem}-fanart.jpg` }
}

const TRAILER_PREFIX = 'plugin://plugin.video.youtube/?action=play_video&videoid='

export function movieToNfoXml(m: MovieRecord): string {
  const asList = <T>(v: T[]) => (v.length ? v : undefined)
  const doc = {
    movie: {
      title: m.title ?? m.parsedTitle,
      originaltitle: m.originalTitle ?? undefined,
      year: m.year ?? undefined,
      plot: m.overview ?? undefined,
      runtime: m.runtime ?? undefined,
      rating: m.voteAverage ?? undefined,
      mpaa: Object.keys(m.certifications).length
        ? [
            'AU',
            ...Object.keys(m.certifications)
              .filter((c) => c !== 'AU')
              .sort()
          ]
            .filter((c) => m.certifications[c])
            .map((c) => `${c}:${m.certifications[c]}`)
            .join(' / ')
        : undefined,
      playcount: m.playCount,
      lastplayed: m.lastPlayedAt ?? undefined,
      trailer: m.trailerYoutubeKey ? TRAILER_PREFIX + m.trailerYoutubeKey : undefined,
      uniqueid:
        m.tmdbId != null ? { '@_type': 'tmdb', '@_default': 'true', '#text': m.tmdbId } : undefined,
      genre: asList(m.genres),
      actor: asList(m.cast.map((c) => ({ name: c.name, order: c.order })))
    }
  }
  return new XMLBuilder({ ignoreAttributes: false, format: true, suppressEmptyNode: true }).build(
    doc
  )
}

export function parseNfoXml(xml: string): NfoData {
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(xml)
  const mv = parsed.movie ?? {}
  const list = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v])
  const num = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))
  const str = (v: unknown): string | null => (v == null || v === '' ? null : String(v))

  const certifications: Record<string, string> = {}
  for (const part of String(mv.mpaa ?? '').split(' / ')) {
    const [country, ...rest] = part.split(':')
    if (country && rest.length) certifications[country.trim()] = rest.join(':').trim()
  }

  const uniqueids = list(mv.uniqueid)
  const tmdbEntry = uniqueids.find((u: Record<string, unknown>) => u['@_type'] === 'tmdb')

  const trailer = str(mv.trailer)
  return {
    tmdbId: tmdbEntry ? num(tmdbEntry['#text']) : null,
    title: str(mv.title),
    originalTitle: str(mv.originaltitle),
    year: num(mv.year),
    overview: str(mv.plot),
    runtime: num(mv.runtime),
    voteAverage: num(mv.rating),
    genres: list(mv.genre).map(String),
    cast: list(mv.actor).map((a: Record<string, unknown>) => ({
      name: String(a.name),
      order: Number(a.order ?? 0)
    })),
    certifications,
    certificationAu: certifications['AU'] ?? null,
    trailerYoutubeKey: trailer?.startsWith(TRAILER_PREFIX)
      ? trailer.slice(TRAILER_PREFIX.length)
      : null,
    playCount: num(mv.playcount) ?? 0,
    lastPlayedAt: str(mv.lastplayed)
  }
}

export function writeSidecarNfo(movie: MovieRecord): void {
  writeFileSync(sidecarPathsFor(movie.filePath).nfo, movieToNfoXml(movie))
}

export function readSidecarNfo(filePath: string): NfoData | null {
  const { nfo } = sidecarPathsFor(filePath)
  if (!existsSync(nfo)) return null
  return parseNfoXml(readFileSync(nfo, 'utf8'))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/library/__tests__/nfo.test.ts`
Expected: PASS (3 tests). Watch for XML entity escaping — fast-xml-parser's builder must be escaping `<`, `&`, `"` in the plot (the round-trip test covers this; if it fails, set `processEntities: true` on both builder and parser).

- [ ] **Step 5: Commit**

```bash
npx eslint . --max-warnings 0 && npx tsc --noEmit
git add -A && git commit -m "feat: Kodi NFO sidecar read/write with full metadata round-trip"
```

---

### Task 5: TMDB client, matcher & details mapping

**Files:**

- Create: `src/main/tmdb/client.ts`, `src/main/tmdb/matcher.ts`
- Test: `src/main/tmdb/__tests__/client.test.ts`, `src/main/tmdb/__tests__/matcher.test.ts`

**Interfaces:**

- Consumes: `ParsedFilename`, `MovieRecord` (Task 2)
- Produces:
  - `createTmdbClient(apiKey: string, fetchFn?: typeof fetch)` with `searchMovies(query: string, year?: number | null): Promise<TmdbSearchResult[]>` and `getMovieDetails(id: number): Promise<TmdbMovieDetails>`
  - `TmdbSearchResult = { id: number; title: string; release_date?: string; poster_path?: string | null; overview?: string }`
  - `TmdbError` (has `status: number`)
  - `pickConfidentMatch(parsed: ParsedFilename, results: TmdbSearchResult[]): TmdbSearchResult | null`
  - `applyDetails(movie: MovieRecord, details: TmdbMovieDetails): MovieRecord` — returns a new record with matchStatus `'matched'` and all TMDB fields populated
  - `TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/'` and `imageUrl(path: string, size: 'w500' | 'original'): string`

- [ ] **Step 1: Write the failing client test**

`src/main/tmdb/__tests__/client.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { createTmdbClient, TmdbError } from '../client'

function fakeFetch(payload: unknown, ok = true, status = 200) {
  return vi.fn(async () => ({ ok, status, json: async () => payload })) as unknown as typeof fetch
}

describe('tmdb client', () => {
  it('searches with query, year and api key', async () => {
    const f = fakeFetch({ results: [{ id: 603, title: 'The Matrix', release_date: '1999-03-30' }] })
    const client = createTmdbClient('KEY', f)
    const results = await client.searchMovies('The Matrix', 1999)
    expect(results[0].id).toBe(603)
    const url = new URL(String((f as ReturnType<typeof vi.fn>).mock.calls[0][0]))
    expect(url.pathname).toBe('/3/search/movie')
    expect(url.searchParams.get('query')).toBe('The Matrix')
    expect(url.searchParams.get('year')).toBe('1999')
    expect(url.searchParams.get('api_key')).toBe('KEY')
  })

  it('requests details with append_to_response', async () => {
    const f = fakeFetch({ id: 603 })
    await createTmdbClient('KEY', f).getMovieDetails(603)
    const url = new URL(String((f as ReturnType<typeof vi.fn>).mock.calls[0][0]))
    expect(url.pathname).toBe('/3/movie/603')
    expect(url.searchParams.get('append_to_response')).toBe('credits,videos,release_dates')
  })

  it('throws TmdbError with status on non-ok response', async () => {
    const f = fakeFetch({}, false, 429)
    await expect(createTmdbClient('KEY', f).searchMovies('x')).rejects.toThrowError(TmdbError)
  })
})
```

- [ ] **Step 2: Write the failing matcher test**

`src/main/tmdb/__tests__/matcher.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { pickConfidentMatch, applyDetails } from '../matcher'
import type { MovieRecord } from '../../../shared/types'

const r = (id: number, title: string, date?: string) => ({ id, title, release_date: date })

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
  it('maps details into a matched MovieRecord', () => {
    const pending = {
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
    } satisfies MovieRecord

    const details = {
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
    expect(m.matchStatus).toBe('matched')
    expect(m.tmdbId).toBe(603)
    expect(m.year).toBe(1999)
    expect(m.voteAverage).toBe(8.22)
    expect(m.cast).toHaveLength(5) // top 5 only
    expect(m.certificationAu).toBe('MA15+')
    expect(m.certifications).toEqual({ AU: 'MA15+', US: 'R' })
    expect(m.trailerYoutubeKey).toBe('trailerKey') // prefers official Trailer over Teaser
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/main/tmdb`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `src/main/tmdb/client.ts`**

```ts
export interface TmdbSearchResult {
  id: number
  title: string
  release_date?: string
  poster_path?: string | null
  overview?: string
}

export interface TmdbMovieDetails {
  id: number
  title: string
  original_title?: string
  release_date?: string
  overview?: string
  runtime?: number | null
  vote_average?: number
  genres?: Array<{ id: number; name: string }>
  poster_path?: string | null
  backdrop_path?: string | null
  credits?: { cast?: Array<{ name: string; order: number }> }
  videos?: { results?: Array<{ site: string; type: string; key: string; official?: boolean }> }
  release_dates?: {
    results?: Array<{ iso_3166_1: string; release_dates: Array<{ certification: string }> }>
  }
}

export class TmdbError extends Error {
  constructor(public status: number) {
    super(`TMDB request failed with status ${status}`)
  }
}

export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/'
export const imageUrl = (path: string, size: 'w500' | 'original') =>
  `${TMDB_IMAGE_BASE}${size}${path}`

export type TmdbClient = ReturnType<typeof createTmdbClient>

export function createTmdbClient(apiKey: string, fetchFn: typeof fetch = fetch) {
  async function get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`https://api.themoviedb.org/3${path}`)
    url.searchParams.set('api_key', apiKey)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    const res = await fetchFn(url)
    if (!res.ok) throw new TmdbError(res.status)
    return res.json() as Promise<T>
  }
  return {
    searchMovies: async (query: string, year?: number | null) =>
      (
        await get<{ results: TmdbSearchResult[] }>('/search/movie', {
          query,
          ...(year ? { year: String(year) } : {})
        })
      ).results,
    getMovieDetails: (id: number) =>
      get<TmdbMovieDetails>(`/movie/${id}`, { append_to_response: 'credits,videos,release_dates' })
  }
}
```

- [ ] **Step 5: Implement `src/main/tmdb/matcher.ts`**

```ts
import type { MovieRecord, ParsedFilename } from '../../shared/types'
import type { TmdbMovieDetails, TmdbSearchResult } from './client'

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export function pickConfidentMatch(
  parsed: ParsedFilename,
  results: TmdbSearchResult[]
): TmdbSearchResult | null {
  const target = norm(parsed.title)
  for (const r of results.slice(0, 5)) {
    if (norm(r.title) !== target) continue
    if (parsed.year == null) return r
    const ry = r.release_date ? Number(r.release_date.slice(0, 4)) : null
    if (ry != null && Math.abs(ry - parsed.year) <= 1) return r
  }
  return null
}

export function applyDetails(movie: MovieRecord, d: TmdbMovieDetails): MovieRecord {
  const certifications: Record<string, string> = {}
  for (const entry of d.release_dates?.results ?? []) {
    const cert = entry.release_dates.map((r) => r.certification).find((c) => c !== '')
    if (cert) certifications[entry.iso_3166_1] = cert
  }
  const videos = d.videos?.results?.filter((v) => v.site === 'YouTube') ?? []
  const trailer =
    videos.find((v) => v.type === 'Trailer' && v.official) ??
    videos.find((v) => v.type === 'Trailer') ??
    videos[0] ??
    null

  return {
    ...movie,
    matchStatus: 'matched',
    fetchFailed: false,
    tmdbId: d.id,
    title: d.title,
    originalTitle: d.original_title ?? null,
    year: d.release_date ? Number(d.release_date.slice(0, 4)) : null,
    overview: d.overview ?? null,
    runtime: d.runtime ?? null,
    voteAverage: d.vote_average ?? null,
    genres: (d.genres ?? []).map((g) => g.name),
    cast: (d.credits?.cast ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .slice(0, 5)
      .map((c) => ({ name: c.name, order: c.order })),
    certifications,
    certificationAu: certifications['AU'] ?? null,
    trailerYoutubeKey: trailer?.key ?? null
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/main/tmdb`
Expected: PASS (7 tests).

- [ ] **Step 7: Commit**

```bash
npx eslint . --max-warnings 0 && npx tsc --noEmit
git add -A && git commit -m "feat: TMDB client, confidence matcher and details-to-record mapping"
```

---

### Task 6: Scanner — discover & ingest

**Files:**

- Create: `src/main/library/scanner.ts`
- Test: `src/main/library/__tests__/scanner.test.ts`

**Interfaces:**

- Consumes: `parseFilename` (Task 3), `readSidecarNfo`, `sidecarPathsFor` (Task 4), `MovieRecord` (Task 2)
- Produces:
  - `VIDEO_EXTENSIONS: Set<string>` (`.mkv .mp4 .avi .mov .m4v .wmv .webm`)
  - `movieId(filePath: string): string` — sha1 hex of the path
  - `discoverVideoFiles(root: string): Promise<string[]>` — recursive, sorted
  - `ingestFile(filePath: string, folderPath: string): Promise<MovieRecord>` — NFO present → `matched` record with sidecar data + on-disk poster/fanart paths; absent → `pending` record from parsed filename

- [ ] **Step 1: Write the failing test against a temp fixture tree**

`src/main/library/__tests__/scanner.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverVideoFiles, ingestFile, movieId } from '../scanner'
import { movieToNfoXml, sidecarPathsFor } from '../nfo'
import type { MovieRecord } from '../../../shared/types'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mw-scan-'))
  return () => rmSync(root, { recursive: true, force: true })
})

describe('discoverVideoFiles', () => {
  it('finds only video files, recursively, ignoring sidecars and junk', async () => {
    mkdirSync(join(root, 'The Matrix (1999)'))
    writeFileSync(join(root, 'The Matrix (1999)', 'The Matrix (1999).mkv'), 'x')
    writeFileSync(join(root, 'The Matrix (1999)', 'The Matrix (1999).nfo'), '<movie/>')
    writeFileSync(join(root, 'The Matrix (1999)', 'The Matrix (1999)-poster.jpg'), 'x')
    writeFileSync(join(root, 'Alien.mp4'), 'x')
    writeFileSync(join(root, 'notes.txt'), 'x')
    const files = await discoverVideoFiles(root)
    expect(files).toEqual([
      join(root, 'Alien.mp4'),
      join(root, 'The Matrix (1999)', 'The Matrix (1999).mkv')
    ])
  })
})

describe('ingestFile', () => {
  it('creates a pending record from the filename when no NFO exists', async () => {
    const file = join(root, 'Heat.1995.1080p.mkv')
    writeFileSync(file, 'xx')
    const m = await ingestFile(file, root)
    expect(m).toMatchObject({
      id: movieId(file),
      filePath: file,
      folderPath: root,
      fileSize: 2,
      parsedTitle: 'Heat',
      parsedYear: 1995,
      matchStatus: 'pending',
      tmdbId: null,
      playCount: 0,
      fileMissing: false
    })
  })

  it('ingests an existing NFO as matched, wiring artwork paths that exist on disk', async () => {
    const file = join(root, 'The Matrix (1999).mkv')
    writeFileSync(file, 'x')
    const matched: Partial<MovieRecord> = {
      parsedTitle: 'The Matrix',
      parsedYear: 1999,
      matchStatus: 'matched',
      tmdbId: 603,
      title: 'The Matrix',
      year: 1999,
      genres: ['Action'],
      cast: [],
      certifications: { AU: 'MA15+' },
      certificationAu: 'MA15+',
      playCount: 3,
      lastPlayedAt: '2026-07-01T10:00:00.000Z'
    }
    writeFileSync(
      sidecarPathsFor(file).nfo,
      movieToNfoXml({ ...(await ingestFile(file, root)), ...matched } as MovieRecord)
    )
    writeFileSync(sidecarPathsFor(file).poster, 'img')
    const m = await ingestFile(file, root)
    expect(m.matchStatus).toBe('matched')
    expect(m.tmdbId).toBe(603)
    expect(m.playCount).toBe(3)
    expect(m.posterPath).toBe(sidecarPathsFor(file).poster)
    expect(m.fanartPath).toBeNull() // fanart file absent
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/library/__tests__/scanner.test.ts`
Expected: FAIL — cannot resolve `../scanner`.

- [ ] **Step 3: Implement `src/main/library/scanner.ts`**

```ts
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { MovieRecord } from '../../shared/types'
import { parseFilename } from './filename-parser'
import { readSidecarNfo, sidecarPathsFor } from './nfo'

export const VIDEO_EXTENSIONS = new Set(['.mkv', '.mp4', '.avi', '.mov', '.m4v', '.wmv', '.webm'])

export const movieId = (filePath: string): string =>
  createHash('sha1').update(filePath).digest('hex')

export async function discoverVideoFiles(root: string): Promise<string[]> {
  const found: string[] = []
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (VIDEO_EXTENSIONS.has(extname(entry.name).toLowerCase())) found.push(full)
    }
  }
  await walk(root)
  return found.sort()
}

export async function ingestFile(filePath: string, folderPath: string): Promise<MovieRecord> {
  const { size } = await stat(filePath)
  const parsed = parseFilename(filePath.split('/').at(-1)!)
  const base: MovieRecord = {
    id: movieId(filePath),
    filePath,
    fileSize: size,
    folderPath,
    parsedTitle: parsed.title,
    parsedYear: parsed.year,
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
  const nfo = readSidecarNfo(filePath)
  if (!nfo) return base
  const paths = sidecarPathsFor(filePath)
  return {
    ...base,
    ...nfo,
    matchStatus: 'matched',
    posterPath: existsSync(paths.poster) ? paths.poster : null,
    fanartPath: existsSync(paths.fanart) ? paths.fanart : null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/library/__tests__/scanner.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
npx eslint . --max-warnings 0 && npx tsc --noEmit
git add -A && git commit -m "feat: recursive video discovery and NFO-aware file ingest"
```

---

### Task 7: Fetch queue with concurrency, retries & sidecar writes

**Files:**

- Create: `src/main/tmdb/fetcher.ts`
- Test: `src/main/tmdb/__tests__/fetcher.test.ts`

**Interfaces:**

- Consumes: `TmdbClient`, `TmdbError`, `imageUrl` (Task 5), `pickConfidentMatch`, `applyDetails` (Task 5), `writeSidecarNfo`, `sidecarPathsFor` (Task 4), `MovieRecord` (Task 2)
- Produces:
  - `createFetchQueue(opts: { client: TmdbClient; onUpdate: (m: MovieRecord) => void; concurrency?: number; retries?: number; backoffMs?: number; downloadImage?: (url: string, dest: string) => Promise<void> })` returning `{ enqueue(movie: MovieRecord): void; idle(): Promise<void> }`
  - `fetchAndApply(movie: MovieRecord, client: TmdbClient, downloadImage): Promise<MovieRecord>` — single-movie pipeline, also used by fix-match (Task 8)
  - `downloadImageToFile(url: string, dest: string, fetchFn?: typeof fetch): Promise<void>`

- [ ] **Step 1: Write the failing test**

`src/main/tmdb/__tests__/fetcher.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFetchQueue } from '../fetcher'
import type { TmdbClient } from '../client'
import type { MovieRecord } from '../../../shared/types'

const pendingMovie = (dir: string, name: string): MovieRecord => ({
  id: name,
  filePath: join(dir, `${name}.mkv`),
  fileSize: 0,
  folderPath: dir,
  parsedTitle: name,
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
})

const details = {
  id: 603,
  title: 'The Matrix',
  release_date: '1999-03-30',
  poster_path: '/p.jpg',
  backdrop_path: '/b.jpg'
}
const searchHit = [{ id: 603, title: 'The Matrix', release_date: '1999-03-30' }]

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'mw-fetch-'))
  return { dir, [Symbol.dispose]: () => rmSync(dir, { recursive: true, force: true }) }
}

describe('fetch queue', () => {
  it('matches confidently, writes sidecars, emits matched record', async () => {
    using t = tempDir()
    const client = {
      searchMovies: vi.fn(async () => searchHit),
      getMovieDetails: vi.fn(async () => details)
    } as unknown as TmdbClient
    const downloadImage = vi.fn(async () => {})
    const updates: MovieRecord[] = []
    const q = createFetchQueue({ client, onUpdate: (m) => updates.push(m), downloadImage })
    q.enqueue(pendingMovie(t.dir, 'The Matrix'))
    await q.idle()
    const last = updates.at(-1)!
    expect(last.matchStatus).toBe('matched')
    expect(last.tmdbId).toBe(603)
    expect(last.posterPath).toBe(join(t.dir, 'The Matrix-poster.jpg'))
    expect(downloadImage).toHaveBeenCalledTimes(2) // poster + fanart
  })

  it('emits unmatched when no confident match', async () => {
    using t = tempDir()
    const client = {
      searchMovies: vi.fn(async () => []),
      getMovieDetails: vi.fn()
    } as unknown as TmdbClient
    const updates: MovieRecord[] = []
    const q = createFetchQueue({
      client,
      onUpdate: (m) => updates.push(m),
      downloadImage: async () => {}
    })
    q.enqueue(pendingMovie(t.dir, 'Unknown Film'))
    await q.idle()
    expect(updates.at(-1)!.matchStatus).toBe('unmatched')
  })

  it('retries on failure then flags fetchFailed', async () => {
    using t = tempDir()
    const searchMovies = vi.fn(async () => {
      throw new Error('network down')
    })
    const client = { searchMovies, getMovieDetails: vi.fn() } as unknown as TmdbClient
    const updates: MovieRecord[] = []
    const q = createFetchQueue({
      client,
      onUpdate: (m) => updates.push(m),
      downloadImage: async () => {},
      retries: 3,
      backoffMs: 1
    })
    q.enqueue(pendingMovie(t.dir, 'Flaky'))
    await q.idle()
    expect(searchMovies).toHaveBeenCalledTimes(3)
    expect(updates.at(-1)!.fetchFailed).toBe(true)
    expect(updates.at(-1)!.matchStatus).toBe('pending')
  })

  it('never runs more than `concurrency` fetches at once', async () => {
    using t = tempDir()
    let active = 0
    let peak = 0
    const client = {
      searchMovies: vi.fn(async () => {
        active++
        peak = Math.max(peak, active)
        await new Promise((r) => setTimeout(r, 5))
        active--
        return []
      }),
      getMovieDetails: vi.fn()
    } as unknown as TmdbClient
    const q = createFetchQueue({
      client,
      onUpdate: () => {},
      downloadImage: async () => {},
      concurrency: 2
    })
    for (let i = 0; i < 6; i++) q.enqueue(pendingMovie(t.dir, `M${i}`))
    await q.idle()
    expect(peak).toBeLessThanOrEqual(2)
  })
})
```

(If the project's TS target doesn't support `using`, replace `using t = tempDir()` with explicit `const t = tempDir()` + cleanup in `afterEach` — keep the assertions identical.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/tmdb/__tests__/fetcher.test.ts`
Expected: FAIL — cannot resolve `../fetcher`.

- [ ] **Step 3: Implement `src/main/tmdb/fetcher.ts`**

```ts
import { writeFileSync } from 'node:fs'
import type { MovieRecord } from '../../shared/types'
import { sidecarPathsFor, writeSidecarNfo } from '../library/nfo'
import { imageUrl, type TmdbClient } from './client'
import { applyDetails, pickConfidentMatch } from './matcher'

type DownloadImage = (url: string, dest: string) => Promise<void>

export async function downloadImageToFile(
  url: string,
  dest: string,
  fetchFn: typeof fetch = fetch
): Promise<void> {
  const res = await fetchFn(url)
  if (!res.ok) throw new Error(`image download failed: ${res.status}`)
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

export async function fetchAndApply(
  movie: MovieRecord,
  client: TmdbClient,
  downloadImage: DownloadImage,
  tmdbId?: number
): Promise<MovieRecord> {
  let id = tmdbId ?? null
  if (id == null) {
    const results = await client.searchMovies(movie.parsedTitle, movie.parsedYear)
    const hit = pickConfidentMatch({ title: movie.parsedTitle, year: movie.parsedYear }, results)
    if (!hit) return { ...movie, matchStatus: 'unmatched', fetchFailed: false }
    id = hit.id
  }
  const details = await client.getMovieDetails(id)
  let matched = applyDetails(movie, details)
  const paths = sidecarPathsFor(movie.filePath)
  if (details.poster_path) {
    await downloadImage(imageUrl(details.poster_path, 'w500'), paths.poster)
    matched = { ...matched, posterPath: paths.poster }
  }
  if (details.backdrop_path) {
    await downloadImage(imageUrl(details.backdrop_path, 'original'), paths.fanart)
    matched = { ...matched, fanartPath: paths.fanart }
  }
  try {
    writeSidecarNfo(matched)
  } catch {
    matched = { ...matched, sidecarWriteFailed: true }
  }
  return matched
}

export function createFetchQueue(opts: {
  client: TmdbClient
  onUpdate: (m: MovieRecord) => void
  concurrency?: number
  retries?: number
  backoffMs?: number
  downloadImage?: DownloadImage
}) {
  const concurrency = opts.concurrency ?? 4
  const retries = opts.retries ?? 3
  const backoffMs = opts.backoffMs ?? 1000
  const downloadImage = opts.downloadImage ?? downloadImageToFile
  const waiting: MovieRecord[] = []
  let active = 0
  let idleResolvers: Array<() => void> = []

  async function run(movie: MovieRecord): Promise<void> {
    active++
    try {
      for (let attempt = 1; ; attempt++) {
        try {
          opts.onUpdate(await fetchAndApply(movie, opts.client, downloadImage))
          break
        } catch {
          if (attempt >= retries) {
            opts.onUpdate({ ...movie, fetchFailed: true })
            break
          }
          await new Promise((r) => setTimeout(r, backoffMs * 2 ** (attempt - 1)))
        }
      }
    } finally {
      active--
      pump()
    }
  }

  function pump(): void {
    while (active < concurrency && waiting.length) void run(waiting.shift()!)
    if (active === 0 && waiting.length === 0) {
      idleResolvers.forEach((r) => r())
      idleResolvers = []
    }
  }

  return {
    enqueue(movie: MovieRecord): void {
      waiting.push(movie)
      pump()
    },
    idle: () =>
      new Promise<void>((resolve) => {
        if (active === 0 && waiting.length === 0) resolve()
        else idleResolvers.push(resolve)
      })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/tmdb/__tests__/fetcher.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
npx eslint . --max-warnings 0 && npx tsc --noEmit
git add -A && git commit -m "feat: concurrency-limited TMDB fetch queue with retries and sidecar writes"
```

---

### Task 8: Player — launch & watch-state stamping

**Files:**

- Create: `src/main/player.ts`
- Test: `src/main/__tests__/player.test.ts`

**Interfaces:**

- Consumes: `writeSidecarNfo` (Task 4), `MovieRecord` (Task 2)
- Produces: `playMovie(movie: MovieRecord, deps?: { openPath?: (p: string) => Promise<string>; now?: () => Date }): Promise<MovieRecord>` — default `openPath` is Electron's `shell.openPath`. Returns the updated record; sets `fileMissing: true` (and does NOT launch) if the file is gone.

- [ ] **Step 1: Write the failing test**

`src/main/__tests__/player.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { playMovie } from '../player'
import { sidecarPathsFor } from '../library/nfo'
import type { MovieRecord } from '../../shared/types'

const record = (filePath: string): MovieRecord => ({
  id: 'x',
  filePath,
  fileSize: 1,
  folderPath: '/m',
  parsedTitle: 'Alien',
  parsedYear: 1979,
  matchStatus: 'matched',
  tmdbId: 348,
  title: 'Alien',
  originalTitle: 'Alien',
  year: 1979,
  overview: null,
  runtime: 117,
  voteAverage: 8.1,
  genres: ['Horror'],
  cast: [],
  certifications: { AU: 'M' },
  certificationAu: 'M',
  trailerYoutubeKey: null,
  playCount: 1,
  lastPlayedAt: null,
  fileMissing: false,
  sidecarWriteFailed: false,
  fetchFailed: false,
  posterPath: null,
  fanartPath: null
})

describe('playMovie', () => {
  it('launches, increments playcount, stamps lastPlayed, persists to NFO', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mw-play-'))
    const file = join(dir, 'Alien.mkv')
    writeFileSync(file, 'x')
    const openPath = vi.fn(async () => '')
    const now = () => new Date('2026-07-08T09:00:00.000Z')
    const updated = await playMovie(record(file), { openPath, now })
    expect(openPath).toHaveBeenCalledWith(file)
    expect(updated.playCount).toBe(2)
    expect(updated.lastPlayedAt).toBe('2026-07-08T09:00:00.000Z')
    expect(readFileSync(sidecarPathsFor(file).nfo, 'utf8')).toContain('<playcount>2</playcount>')
    rmSync(dir, { recursive: true, force: true })
  })

  it('flags fileMissing and does not launch when the file is gone', async () => {
    const openPath = vi.fn(async () => '')
    const updated = await playMovie(record('/nowhere/Alien.mkv'), { openPath })
    expect(openPath).not.toHaveBeenCalled()
    expect(updated.fileMissing).toBe(true)
    expect(updated.playCount).toBe(1) // unchanged
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/__tests__/player.test.ts`
Expected: FAIL — cannot resolve `../player`.

- [ ] **Step 3: Implement `src/main/player.ts`**

Note: import `shell` lazily inside the default so the module stays testable outside Electron.

```ts
import { existsSync } from 'node:fs'
import type { MovieRecord } from '../shared/types'
import { writeSidecarNfo } from './library/nfo'

interface PlayDeps {
  openPath?: (p: string) => Promise<string>
  now?: () => Date
}

async function defaultOpenPath(p: string): Promise<string> {
  const { shell } = await import('electron')
  return shell.openPath(p)
}

export async function playMovie(movie: MovieRecord, deps: PlayDeps = {}): Promise<MovieRecord> {
  if (!existsSync(movie.filePath)) return { ...movie, fileMissing: true }
  await (deps.openPath ?? defaultOpenPath)(movie.filePath)
  let updated: MovieRecord = {
    ...movie,
    playCount: movie.playCount + 1,
    lastPlayedAt: (deps.now ?? (() => new Date()))().toISOString()
  }
  try {
    writeSidecarNfo(updated)
  } catch {
    updated = { ...updated, sidecarWriteFailed: true }
  }
  return updated
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/__tests__/player.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
npx eslint . --max-warnings 0 && npx tsc --noEmit
git add -A && git commit -m "feat: external-player launch with NFO watch-state stamping"
```

---

### Task 9: Library manager — orchestration

**Files:**

- Create: `src/main/library/manager.ts`
- Test: `src/main/library/__tests__/manager.test.ts`

**Interfaces:**

- Consumes: `SettingsStore` (Task 2), `discoverVideoFiles`/`ingestFile`/`movieId` (Task 6), `createFetchQueue`/`fetchAndApply` (Task 7), `playMovie` (Task 8), `TmdbClient` (Task 5), `ScanProgress` (Task 2)
- Produces: `createLibraryManager(opts)` where

```ts
interface ManagerOpts {
  settings: SettingsStore
  makeClient: (apiKey: string) => TmdbClient // injectable for tests
  emit: (channel: 'movie:updated' | 'scan:progress', payload: MovieRecord | ScanProgress) => void
  downloadImage?: (url: string, dest: string) => Promise<void>
  playDeps?: { openPath?: (p: string) => Promise<string>; now?: () => Date }
}
```

returning:

- `loadLibrary(): Promise<MovieRecord[]>` — scan every registered folder, ingest all files, enqueue TMDB fetches for `pending` files (only when an API key is set), return the full list immediately
- `rescanFolder(folder: string): Promise<void>` — add new files, flag vanished ones `fileMissing`, emit updates
- `fixMatch(id: string, tmdbId: number): Promise<void>` — re-fetch against the given id, emit
- `retryFetch(id: string): Promise<void>` — re-enqueue a `fetchFailed` movie
- `play(id: string): Promise<void>` — delegate to `playMovie`, emit
- `getMovies(): MovieRecord[]`
- internal invariant: every state change goes through a private `commit(movie)` that updates the in-memory Map **and** calls `emit('movie:updated', movie)`

- [ ] **Step 1: Write the failing test**

`src/main/library/__tests__/manager.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLibraryManager } from '../manager'
import { createSettingsStore } from '../../settings'
import { movieId } from '../scanner'
import type { MovieRecord, ScanProgress } from '../../../shared/types'
import type { TmdbClient } from '../../tmdb/client'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mw-mgr-'))
  return () => rmSync(dir, { recursive: true, force: true })
})

const fakeClient = {
  searchMovies: vi.fn(async () => [{ id: 603, title: 'The Matrix', release_date: '1999-03-30' }]),
  getMovieDetails: vi.fn(async () => ({ id: 603, title: 'The Matrix', release_date: '1999-03-30' }))
} as unknown as TmdbClient

function makeManager() {
  const settingsFile = join(dir, 'settings.json')
  const settings = createSettingsStore(settingsFile)
  settings.setApiKey('KEY')
  settings.addFolder(join(dir, 'movies'))
  const updates: MovieRecord[] = []
  const progress: ScanProgress[] = []
  const manager = createLibraryManager({
    settings,
    makeClient: () => fakeClient,
    emit: (channel, payload) => {
      if (channel === 'movie:updated') updates.push(payload as MovieRecord)
      else progress.push(payload as ScanProgress)
    },
    downloadImage: async () => {}
  })
  return { manager, settings, updates, progress }
}

describe('library manager', () => {
  it('loads, returns pending records immediately, then emits matched updates', async () => {
    const moviesDir = join(dir, 'movies')
    const { mkdirSync } = await import('node:fs')
    mkdirSync(moviesDir, { recursive: true })
    const file = join(moviesDir, 'The.Matrix.1999.mkv')
    writeFileSync(file, 'x')

    const { manager, updates } = makeManager()
    const initial = await manager.loadLibrary()
    expect(initial).toHaveLength(1)
    expect(initial[0].matchStatus).toBe('pending')
    await manager.idle()
    expect(updates.at(-1)!.matchStatus).toBe('matched')
    expect(manager.getMovies()[0].tmdbId).toBe(603)
  })

  it('rescan flags vanished files as missing', async () => {
    const { mkdirSync } = await import('node:fs')
    const moviesDir = join(dir, 'movies')
    mkdirSync(moviesDir, { recursive: true })
    const file = join(moviesDir, 'Alien.mkv')
    writeFileSync(file, 'x')
    const { manager, updates } = makeManager()
    await manager.loadLibrary()
    await manager.idle()
    unlinkSync(file)
    await manager.rescanFolder(moviesDir)
    const flagged = updates.find((m) => m.id === movieId(file) && m.fileMissing)
    expect(flagged).toBeDefined()
  })

  it('fixMatch fetches the supplied tmdb id and emits matched', async () => {
    const { mkdirSync } = await import('node:fs')
    const moviesDir = join(dir, 'movies')
    mkdirSync(moviesDir, { recursive: true })
    const file = join(moviesDir, 'Obscure Film.mkv')
    writeFileSync(file, 'x')
    const { manager, updates } = makeManager()
    await manager.loadLibrary()
    await manager.idle()
    await manager.fixMatch(movieId(file), 603)
    expect(updates.at(-1)!).toMatchObject({ tmdbId: 603, matchStatus: 'matched' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/library/__tests__/manager.test.ts`
Expected: FAIL — cannot resolve `../manager`.

- [ ] **Step 3: Implement `src/main/library/manager.ts`**

```ts
import { existsSync } from 'node:fs'
import type { MovieRecord, ScanProgress } from '../../shared/types'
import type { SettingsStore } from '../settings'
import type { TmdbClient } from '../tmdb/client'
import { createFetchQueue, fetchAndApply, downloadImageToFile } from '../tmdb/fetcher'
import { playMovie } from '../player'
import { discoverVideoFiles, ingestFile } from './scanner'

interface ManagerOpts {
  settings: SettingsStore
  makeClient: (apiKey: string) => TmdbClient
  emit: (channel: 'movie:updated' | 'scan:progress', payload: MovieRecord | ScanProgress) => void
  downloadImage?: (url: string, dest: string) => Promise<void>
  playDeps?: { openPath?: (p: string) => Promise<string>; now?: () => Date }
}

export type LibraryManager = ReturnType<typeof createLibraryManager>

export function createLibraryManager(opts: ManagerOpts) {
  const movies = new Map<string, MovieRecord>()
  const downloadImage = opts.downloadImage ?? downloadImageToFile

  function client(): TmdbClient | null {
    const key = opts.settings.read().tmdbApiKey
    return key ? opts.makeClient(key) : null
  }

  function commit(movie: MovieRecord): void {
    movies.set(movie.id, movie)
    opts.emit('movie:updated', movie)
  }

  // Queue is rebuilt lazily so a newly-entered API key takes effect.
  let queue: ReturnType<typeof createFetchQueue> | null = null
  function ensureQueue(): ReturnType<typeof createFetchQueue> | null {
    const c = client()
    if (!c) return null
    if (!queue) queue = createFetchQueue({ client: c, onUpdate: commit, downloadImage })
    return queue
  }

  async function scanOne(folder: string): Promise<MovieRecord[]> {
    if (!existsSync(folder)) return []
    const files = await discoverVideoFiles(folder)
    const seen = new Set<string>()
    const ingested: MovieRecord[] = []
    let done = 0
    for (const file of files) {
      const existing = [...movies.values()].find((m) => m.filePath === file)
      const record = existing ?? (await ingestFile(file, folder))
      seen.add(record.id)
      if (!existing) commit(record)
      ingested.push(record)
      opts.emit('scan:progress', {
        folder,
        discovered: files.length,
        ingested: ++done,
        done: false
      })
    }
    for (const m of movies.values()) {
      if (m.folderPath === folder && !seen.has(m.id) && !m.fileMissing) {
        commit({ ...m, fileMissing: true })
      }
    }
    opts.emit('scan:progress', { folder, discovered: files.length, ingested: done, done: true })
    const q = ensureQueue()
    if (q) for (const m of ingested) if (m.matchStatus === 'pending') q.enqueue(m)
    return ingested
  }

  return {
    async loadLibrary(): Promise<MovieRecord[]> {
      for (const folder of opts.settings.read().folders) await scanOne(folder)
      return [...movies.values()]
    },
    rescanFolder: async (folder: string): Promise<void> => {
      await scanOne(folder)
    },
    async fixMatch(id: string, tmdbId: number): Promise<void> {
      const movie = movies.get(id)
      const c = client()
      if (!movie || !c) return
      commit(await fetchAndApply(movie, c, downloadImage, tmdbId))
    },
    async retryFetch(id: string): Promise<void> {
      const movie = movies.get(id)
      const q = ensureQueue()
      if (movie && q) q.enqueue({ ...movie, fetchFailed: false })
    },
    async play(id: string): Promise<void> {
      const movie = movies.get(id)
      if (movie) commit(await playMovie(movie, opts.playDeps))
    },
    getMovies: (): MovieRecord[] => [...movies.values()],
    idle: (): Promise<void> => queue?.idle() ?? Promise.resolve()
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/library/__tests__/manager.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
npx eslint . --max-warnings 0 && npx tsc --noEmit
git add -A && git commit -m "feat: library manager orchestrating scan, fetch, fix-match and play"
```

---

### Task 10: IPC, preload bridge & main-process wiring

**Files:**

- Create: `src/main/ipc.ts`
- Modify: `src/main/index.ts` (template file — replace demo wiring), `src/preload/index.ts`, `src/preload/index.d.ts`
- Test: manual smoke test (Electron integration; unit coverage already lives in the modules IPC delegates to)

**Interfaces:**

- Consumes: `LibraryManager` (Task 9), `SettingsStore` (Task 2), `createTmdbClient` (Task 5)
- Produces: `window.api` (the renderer's ONLY door to the system — exact shape below; renderer tasks depend on every name):

```ts
export interface WindowApi {
  getSettings(): Promise<Settings>
  setApiKey(key: string): Promise<Settings>
  addFolder(): Promise<Settings | null> // opens native dialog; null if cancelled
  removeFolder(path: string): Promise<Settings>
  loadLibrary(): Promise<MovieRecord[]>
  rescanFolder(folder: string): Promise<void>
  play(id: string): Promise<void>
  retryFetch(id: string): Promise<void>
  fixMatch(id: string, tmdbId: number): Promise<void>
  searchTmdb(query: string, year: number | null): Promise<TmdbSearchResult[]>
  revealFile(id: string): Promise<void>
  onMovieUpdated(cb: (m: MovieRecord) => void): void
  onScanProgress(cb: (p: ScanProgress) => void): void
}
```

- [ ] **Step 1: Implement `src/main/ipc.ts`**

```ts
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { SettingsStore } from './settings'
import type { LibraryManager } from './library/manager'
import { createTmdbClient } from './tmdb/client'

export function registerIpc(settings: SettingsStore, manager: LibraryManager): void {
  ipcMain.handle('settings:get', () => settings.read())
  ipcMain.handle('settings:set-api-key', (_e, key: string) => settings.setApiKey(key))

  ipcMain.handle('folders:add', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || !result.filePaths[0]) return null
    const next = settings.addFolder(result.filePaths[0])
    void manager.rescanFolder(result.filePaths[0])
    return next
  })
  ipcMain.handle('folders:remove', (_e, path: string) => settings.removeFolder(path))

  ipcMain.handle('library:load', () => manager.loadLibrary())
  ipcMain.handle('library:rescan', (_e, folder: string) => manager.rescanFolder(folder))
  ipcMain.handle('movie:play', (_e, id: string) => manager.play(id))
  ipcMain.handle('movie:retry-fetch', (_e, id: string) => manager.retryFetch(id))
  ipcMain.handle('movie:fix-match', (_e, id: string, tmdbId: number) =>
    manager.fixMatch(id, tmdbId)
  )

  ipcMain.handle('tmdb:search', (_e, query: string, year: number | null) => {
    const key = settings.read().tmdbApiKey
    if (!key) return []
    return createTmdbClient(key).searchMovies(query, year)
  })

  ipcMain.handle('file:reveal', (_e, id: string) => {
    const movie = manager.getMovies().find((m) => m.id === id)
    if (movie) shell.showItemInFolder(movie.filePath)
  })
}

export function emitToAll(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, payload)
}
```

- [ ] **Step 2: Rewrite `src/main/index.ts`**

Keep the template's window-creation boilerplate (icon, `electron-toolkit` helpers) and add wiring. The essential additions:

```ts
import { app } from 'electron'
import { join } from 'node:path'
import { createSettingsStore } from './settings'
import { createLibraryManager } from './library/manager'
import { createTmdbClient } from './tmdb/client'
import { registerIpc, emitToAll } from './ipc'

// inside app.whenReady().then(...) before createWindow():
const settings = createSettingsStore(join(app.getPath('userData'), 'settings.json'))
const manager = createLibraryManager({
  settings,
  makeClient: (key) => createTmdbClient(key),
  emit: (channel, payload) => emitToAll(channel, payload)
})
registerIpc(settings, manager)
```

Also in the `webPreferences` of the BrowserWindow (template default already has these — verify): `contextIsolation: true`, `sandbox: false`, preload pointing at the built preload script. Add `webSecurity` untouched (default true). To let the renderer display local artwork files, register a custom protocol:

```ts
import { protocol, net } from 'electron'
import { pathToFileURL } from 'node:url'

// before app.whenReady():
protocol.registerSchemesAsPrivileged([
  { scheme: 'mw-art', privileges: { standard: false, stream: true } }
])

// inside app.whenReady():
protocol.handle('mw-art', (req) => {
  const filePath = decodeURIComponent(req.url.slice('mw-art://'.length))
  return net.fetch(pathToFileURL(filePath).toString())
})
```

Renderer will build image sources as `mw-art://${encodeURIComponent(posterPath)}`.

- [ ] **Step 3: Implement `src/preload/index.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setApiKey: (key: string) => ipcRenderer.invoke('settings:set-api-key', key),
  addFolder: () => ipcRenderer.invoke('folders:add'),
  removeFolder: (path: string) => ipcRenderer.invoke('folders:remove', path),
  loadLibrary: () => ipcRenderer.invoke('library:load'),
  rescanFolder: (folder: string) => ipcRenderer.invoke('library:rescan', folder),
  play: (id: string) => ipcRenderer.invoke('movie:play', id),
  retryFetch: (id: string) => ipcRenderer.invoke('movie:retry-fetch', id),
  fixMatch: (id: string, tmdbId: number) => ipcRenderer.invoke('movie:fix-match', id, tmdbId),
  searchTmdb: (query: string, year: number | null) =>
    ipcRenderer.invoke('tmdb:search', query, year),
  revealFile: (id: string) => ipcRenderer.invoke('file:reveal', id),
  onMovieUpdated: (cb: (m: unknown) => void) => ipcRenderer.on('movie:updated', (_e, m) => cb(m)),
  onScanProgress: (cb: (p: unknown) => void) => ipcRenderer.on('scan:progress', (_e, p) => cb(p))
}

contextBridge.exposeInMainWorld('api', api)
```

And `src/preload/index.d.ts` so the renderer gets types:

```ts
import type { MovieRecord, ScanProgress, Settings } from '../shared/types'
import type { TmdbSearchResult } from '../main/tmdb/client'

declare global {
  interface Window {
    api: {
      getSettings(): Promise<Settings>
      setApiKey(key: string): Promise<Settings>
      addFolder(): Promise<Settings | null>
      removeFolder(path: string): Promise<Settings>
      loadLibrary(): Promise<MovieRecord[]>
      rescanFolder(folder: string): Promise<void>
      play(id: string): Promise<void>
      retryFetch(id: string): Promise<void>
      fixMatch(id: string, tmdbId: number): Promise<void>
      searchTmdb(query: string, year: number | null): Promise<TmdbSearchResult[]>
      revealFile(id: string): Promise<void>
      onMovieUpdated(cb: (m: MovieRecord) => void): void
      onScanProgress(cb: (p: ScanProgress) => void): void
    }
  }
}
export {}
```

- [ ] **Step 4: Smoke test**

Run: `npm run dev`
Expected: window opens with the template page; devtools console shows no preload errors; `window.api.getSettings()` in the devtools console resolves to `{ folders: [], tmdbApiKey: null }`.

- [ ] **Step 5: Commit**

```bash
npx eslint . --max-warnings 0 && npx tsc --noEmit && npx vitest run
git add -A && git commit -m "feat: IPC surface, preload bridge and main-process wiring"
```

---

### Task 11: Renderer filtering library & Pinia store

**Files:**

- Create: `src/renderer/src/lib/filtering.ts`, `src/renderer/src/stores/library.ts`
- Test: `src/renderer/src/lib/__tests__/filtering.test.ts`, `src/renderer/src/stores/__tests__/library.test.ts`

**Interfaces:**

- Consumes: `MovieRecord` (Task 2), `window.api` (Task 10)
- Produces:

```ts
// filtering.ts
export interface LibraryFilters {
  search: string
  genre: string | null
  year: number | null
  certification: string | null // AU cert
  minRating: number | null // 0–10 TMDB scale
  actor: string | null
  watched: 'all' | 'watched' | 'unwatched'
}
export type SortKey = 'title' | 'year' | 'rating' | 'lastWatched'
export const EMPTY_FILTERS: LibraryFilters
export function filterMovies(movies: MovieRecord[], f: LibraryFilters): MovieRecord[]
export function sortMovies(movies: MovieRecord[], key: SortKey): MovieRecord[]

// stores/library.ts — Pinia store 'library'
// state: movies: Record<string, MovieRecord>, filters: LibraryFilters, sort: SortKey, loaded: boolean
// getters: list (filtered+sorted), allGenres, allActors, allYears, allCertifications, pendingCount
// actions: load() (calls window.api.loadLibrary + subscribes onMovieUpdated once), applyUpdate(m), setFilter(patch), resetFilters(), setSort(key)
```

- [ ] **Step 1: Write the failing filtering tests**

`src/renderer/src/lib/__tests__/filtering.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { filterMovies, sortMovies, EMPTY_FILTERS } from '../filtering'
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
```

- [ ] **Step 2: Run tests to verify they fail, then implement `filtering.ts`**

Run: `npx vitest run src/renderer/src/lib` → FAIL (module not found). Then:

```ts
import type { MovieRecord } from '../../../shared/types'

export interface LibraryFilters {
  search: string
  genre: string | null
  year: number | null
  certification: string | null
  minRating: number | null
  actor: string | null
  watched: 'all' | 'watched' | 'unwatched'
}

export type SortKey = 'title' | 'year' | 'rating' | 'lastWatched'

export const EMPTY_FILTERS: LibraryFilters = {
  search: '',
  genre: null,
  year: null,
  certification: null,
  minRating: null,
  actor: null,
  watched: 'all'
}

const displayTitle = (m: MovieRecord) => m.title ?? m.parsedTitle

export function filterMovies(movies: MovieRecord[], f: LibraryFilters): MovieRecord[] {
  const q = f.search.trim().toLowerCase()
  return movies.filter((m) => {
    if (q && !displayTitle(m).toLowerCase().includes(q)) return false
    if (f.genre && !m.genres.includes(f.genre)) return false
    if (f.year != null && (m.year ?? m.parsedYear) !== f.year) return false
    if (f.certification && m.certificationAu !== f.certification) return false
    if (f.minRating != null && (m.voteAverage ?? -1) < f.minRating) return false
    if (f.actor && !m.cast.some((c) => c.name === f.actor)) return false
    if (f.watched === 'watched' && m.playCount === 0) return false
    if (f.watched === 'unwatched' && m.playCount > 0) return false
    return true
  })
}

export function sortMovies(movies: MovieRecord[], key: SortKey): MovieRecord[] {
  const arr = [...movies]
  switch (key) {
    case 'title':
      return arr.sort((a, b) => displayTitle(a).localeCompare(displayTitle(b)))
    case 'year':
      return arr.sort((a, b) => (b.year ?? b.parsedYear ?? 0) - (a.year ?? a.parsedYear ?? 0))
    case 'rating':
      return arr.sort((a, b) => (b.voteAverage ?? 0) - (a.voteAverage ?? 0))
    case 'lastWatched':
      return arr.sort((a, b) => (b.lastPlayedAt ?? '').localeCompare(a.lastPlayedAt ?? ''))
  }
}
```

Run again → PASS (7 tests).

- [ ] **Step 3: Write the failing store test**

`src/renderer/src/stores/__tests__/library.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLibraryStore } from '../library'
import type { MovieRecord } from '../../../../shared/types'

const m = (id: string, over: Partial<MovieRecord> = {}): MovieRecord => ({
  id,
  filePath: `/${id}`,
  fileSize: 0,
  folderPath: '/',
  parsedTitle: id,
  parsedYear: null,
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
  fanartPath: null,
  ...over
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('window', {
    api: {
      loadLibrary: vi.fn(async () => [
        m('a'),
        m('b', { matchStatus: 'matched', genres: ['Action'] })
      ]),
      onMovieUpdated: vi.fn(),
      onScanProgress: vi.fn()
    }
  })
})

describe('library store', () => {
  it('load() populates movies and subscribes to updates', async () => {
    const store = useLibraryStore()
    await store.load()
    expect(store.list).toHaveLength(2)
    expect(store.pendingCount).toBe(1)
    expect(window.api.onMovieUpdated).toHaveBeenCalledOnce()
  })

  it('applyUpdate upserts and getters derive facets', async () => {
    const store = useLibraryStore()
    await store.load()
    store.applyUpdate(
      m('a', { matchStatus: 'matched', genres: ['Horror'], cast: [{ name: 'X', order: 0 }] })
    )
    expect(store.pendingCount).toBe(0)
    expect(store.allGenres).toEqual(['Action', 'Horror'])
    expect(store.allActors).toEqual(['X'])
  })
})
```

- [ ] **Step 4: Run to verify failure, implement `stores/library.ts`, run to pass**

```ts
import { defineStore } from 'pinia'
import type { MovieRecord } from '../../../shared/types'
import {
  EMPTY_FILTERS,
  filterMovies,
  sortMovies,
  type LibraryFilters,
  type SortKey
} from '../lib/filtering'

export const useLibraryStore = defineStore('library', {
  state: () => ({
    movies: {} as Record<string, MovieRecord>,
    filters: { ...EMPTY_FILTERS } as LibraryFilters,
    sort: 'title' as SortKey,
    loaded: false
  }),
  getters: {
    all: (s) => Object.values(s.movies),
    list(): MovieRecord[] {
      return sortMovies(filterMovies(this.all, this.filters), this.sort)
    },
    pendingCount(): number {
      return this.all.filter((m) => m.matchStatus === 'pending').length
    },
    allGenres(): string[] {
      return [...new Set(this.all.flatMap((m) => m.genres))].sort()
    },
    allActors(): string[] {
      return [...new Set(this.all.flatMap((m) => m.cast.map((c) => c.name)))].sort()
    },
    allYears(): number[] {
      return [
        ...new Set(
          this.all.map((m) => m.year ?? m.parsedYear).filter((y): y is number => y != null)
        )
      ].sort((a, b) => b - a)
    },
    allCertifications(): string[] {
      return [
        ...new Set(this.all.map((m) => m.certificationAu).filter((c): c is string => c != null))
      ].sort()
    }
  },
  actions: {
    async load() {
      if (this.loaded) return
      window.api.onMovieUpdated((m) => this.applyUpdate(m))
      const movies = await window.api.loadLibrary()
      for (const m of movies) this.movies[m.id] = m
      this.loaded = true
    },
    applyUpdate(m: MovieRecord) {
      this.movies[m.id] = m
    },
    setFilter(patch: Partial<LibraryFilters>) {
      this.filters = { ...this.filters, ...patch }
    },
    resetFilters() {
      this.filters = { ...EMPTY_FILTERS }
    },
    setSort(key: SortKey) {
      this.sort = key
    }
  }
})
```

Run: `npx vitest run src/renderer/src/stores` → PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
npx eslint . --max-warnings 0 && npx tsc --noEmit
git add -A && git commit -m "feat: in-memory filtering/sorting and pinia library store"
```

---

### Task 12: Library UI — StarRating, MovieCard, FilterBar, LibraryView

**Files:**

- Create: `src/renderer/src/components/StarRating.vue`, `src/renderer/src/components/MovieCard.vue`, `src/renderer/src/components/FilterBar.vue`, `src/renderer/src/views/LibraryView.vue`, `src/renderer/src/router.ts`
- Modify: `src/renderer/src/App.vue`, `src/renderer/src/main.ts` (install Pinia + router; delete template demo components)
- Test: `src/renderer/src/components/__tests__/MovieCard.test.ts`, `src/renderer/src/components/__tests__/FilterBar.test.ts`

**Interfaces:**

- Consumes: `useLibraryStore`, `LibraryFilters`, `SortKey` (Task 11), `MovieRecord` (Task 2), `mw-art://` protocol (Task 10)
- Produces:
  - `StarRating.vue` props: `{ voteAverage: number | null }` — renders `voteAverage / 2` as 5 stars (half-star rounding), `title` attr shows raw score
  - `MovieCard.vue` props: `{ movie: MovieRecord }`, emits `open(id: string)`; badge test-ids: `badge-pending`, `badge-unmatched`, `badge-missing`, `badge-unsaved`, `badge-fetch-failed`
  - `FilterBar.vue` — reads/writes the store directly (no props)
  - `artSrc(path: string | null): string | null` helper exported from `src/renderer/src/lib/art.ts`
  - Routes: `/` → LibraryView, `/movie/:id` → MovieDetailView (Task 13), `/settings` → SettingsView (Task 14)

- [ ] **Step 1: Create `src/renderer/src/lib/art.ts`**

```ts
export const artSrc = (path: string | null): string | null =>
  path ? `mw-art://${encodeURIComponent(path)}` : null
```

- [ ] **Step 2: Write the failing MovieCard test**

`src/renderer/src/components/__tests__/MovieCard.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MovieCard from '../MovieCard.vue'
import type { MovieRecord } from '../../../../shared/types'

const base: MovieRecord = {
  id: 'id1',
  filePath: '/f.mkv',
  fileSize: 0,
  folderPath: '/',
  parsedTitle: 'Parsed Name',
  parsedYear: 1999,
  matchStatus: 'matched',
  tmdbId: 603,
  title: 'The Matrix',
  originalTitle: null,
  year: 1999,
  overview: null,
  runtime: 136,
  voteAverage: 8.2,
  genres: ['Action'],
  cast: [
    { name: 'Keanu Reeves', order: 0 },
    { name: 'Laurence Fishburne', order: 1 }
  ],
  certifications: { AU: 'MA15+' },
  certificationAu: 'MA15+',
  trailerYoutubeKey: null,
  playCount: 0,
  lastPlayedAt: null,
  fileMissing: false,
  sidecarWriteFailed: false,
  fetchFailed: false,
  posterPath: '/art/p.jpg',
  fanartPath: null
}

describe('MovieCard', () => {
  it('shows title, year, certification, actors and "never" watched state', () => {
    const w = mount(MovieCard, { props: { movie: base } })
    expect(w.text()).toContain('The Matrix')
    expect(w.text()).toContain('1999')
    expect(w.text()).toContain('MA15+')
    expect(w.text()).toContain('Keanu Reeves')
    expect(w.text().toLowerCase()).toContain('never')
    expect(w.find('img').attributes('src')).toContain('mw-art://')
  })

  it('falls back to parsed title and shows pending badge', () => {
    const w = mount(MovieCard, {
      props: { movie: { ...base, matchStatus: 'pending', title: null, posterPath: null } }
    })
    expect(w.text()).toContain('Parsed Name')
    expect(w.find('[data-testid="badge-pending"]').exists()).toBe(true)
  })

  it('shows unmatched / missing / unsaved badges', () => {
    expect(
      mount(MovieCard, { props: { movie: { ...base, matchStatus: 'unmatched' } } })
        .find('[data-testid="badge-unmatched"]')
        .exists()
    ).toBe(true)
    expect(
      mount(MovieCard, { props: { movie: { ...base, fileMissing: true } } })
        .find('[data-testid="badge-missing"]')
        .exists()
    ).toBe(true)
    expect(
      mount(MovieCard, { props: { movie: { ...base, sidecarWriteFailed: true } } })
        .find('[data-testid="badge-unsaved"]')
        .exists()
    ).toBe(true)
  })

  it('emits open with the movie id on click', async () => {
    const w = mount(MovieCard, { props: { movie: base } })
    await w.trigger('click')
    expect(w.emitted('open')).toEqual([['id1']])
  })
})
```

- [ ] **Step 3: Run to verify failure, implement the components**

Run: `npx vitest run src/renderer/src/components` → FAIL.

`src/renderer/src/components/StarRating.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ voteAverage: number | null }>()
const stars = computed(() => (props.voteAverage == null ? 0 : Math.round(props.voteAverage) / 2))
</script>

<template>
  <span v-if="voteAverage != null" class="text-amber-400" :title="`${voteAverage.toFixed(1)} / 10`">
    <span v-for="i in 5" :key="i">{{ i <= stars ? '★' : i - 0.5 === stars ? '⯨' : '☆' }}</span>
  </span>
</template>
```

`src/renderer/src/components/MovieCard.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { MovieRecord } from '../../../shared/types'
import { artSrc } from '../lib/art'
import StarRating from './StarRating.vue'

const props = defineProps<{ movie: MovieRecord }>()
defineEmits<{ open: [id: string] }>()

const title = computed(() => props.movie.title ?? props.movie.parsedTitle)
const year = computed(() => props.movie.year ?? props.movie.parsedYear)
const actors = computed(() =>
  props.movie.cast
    .slice(0, 2)
    .map((c) => c.name)
    .join(', ')
)
const lastWatched = computed(() => {
  if (!props.movie.lastPlayedAt) return 'never'
  const days = Math.floor((Date.now() - Date.parse(props.movie.lastPlayedAt)) / 86_400_000)
  return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
})
</script>

<template>
  <div
    class="group cursor-pointer overflow-hidden rounded-lg bg-neutral-800 shadow transition hover:scale-[1.02] hover:shadow-lg"
    @click="$emit('open', movie.id)"
  >
    <div class="relative aspect-[2/3] bg-neutral-700">
      <img
        v-if="artSrc(movie.posterPath)"
        :src="artSrc(movie.posterPath)!"
        :alt="title"
        class="h-full w-full object-cover"
      />
      <div
        v-else
        class="flex h-full items-center justify-center p-2 text-center text-sm text-neutral-400"
      >
        {{ title }}
      </div>
      <span
        v-if="movie.matchStatus === 'pending'"
        data-testid="badge-pending"
        class="absolute left-1 top-1 animate-pulse rounded bg-sky-600 px-1.5 py-0.5 text-xs text-white"
        >fetching…</span
      >
      <span
        v-if="movie.matchStatus === 'unmatched'"
        data-testid="badge-unmatched"
        class="absolute left-1 top-1 rounded bg-amber-600 px-1.5 py-0.5 text-xs text-white"
        >needs match</span
      >
      <span
        v-if="movie.fetchFailed"
        data-testid="badge-fetch-failed"
        class="absolute left-1 top-8 rounded bg-red-700 px-1.5 py-0.5 text-xs text-white"
        >fetch failed</span
      >
      <span
        v-if="movie.fileMissing"
        data-testid="badge-missing"
        class="absolute right-1 top-1 rounded bg-red-600 px-1.5 py-0.5 text-xs text-white"
        >file missing</span
      >
      <span
        v-if="movie.sidecarWriteFailed"
        data-testid="badge-unsaved"
        class="absolute right-1 top-8 rounded bg-orange-600 px-1.5 py-0.5 text-xs text-white"
        >not saved</span
      >
      <span
        v-if="movie.certificationAu"
        class="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-white"
        >{{ movie.certificationAu }}</span
      >
    </div>
    <div class="space-y-0.5 p-2 text-sm">
      <div class="truncate font-medium text-white" :title="title">{{ title }}</div>
      <div class="flex items-center justify-between text-neutral-400">
        <span>{{ year ?? '—' }}</span>
        <StarRating :vote-average="movie.voteAverage" />
      </div>
      <div class="truncate text-xs text-neutral-400">{{ actors }}</div>
      <div class="text-xs text-neutral-500">watched: {{ lastWatched }}</div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Write the failing FilterBar test**

`src/renderer/src/components/__tests__/FilterBar.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import FilterBar from '../FilterBar.vue'
import { useLibraryStore } from '../../stores/library'
import type { MovieRecord } from '../../../../shared/types'

beforeEach(() => setActivePinia(createPinia()))

const seed = (store: ReturnType<typeof useLibraryStore>) => {
  const m = (id: string, over: Partial<MovieRecord>): MovieRecord => ({
    id,
    filePath: `/${id}`,
    fileSize: 0,
    folderPath: '/',
    parsedTitle: id,
    parsedYear: null,
    matchStatus: 'matched',
    tmdbId: 1,
    title: id,
    originalTitle: null,
    year: 2000,
    overview: null,
    runtime: null,
    voteAverage: 7,
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
  store.applyUpdate(m('a', { genres: ['Action'], certificationAu: 'M' }))
  store.applyUpdate(m('b', { genres: ['Horror'], certificationAu: 'R18+' }))
}

describe('FilterBar', () => {
  it('renders facet options derived from the store', () => {
    const store = useLibraryStore()
    seed(store)
    const w = mount(FilterBar)
    expect(w.find('[data-testid="filter-genre"]').text()).toContain('Action')
    expect(w.find('[data-testid="filter-certification"]').text()).toContain('R18+')
  })

  it('writes search and genre into the store', async () => {
    const store = useLibraryStore()
    seed(store)
    const w = mount(FilterBar)
    await w.find('[data-testid="filter-search"]').setValue('alien')
    await w.find('[data-testid="filter-genre"]').setValue('Horror')
    expect(store.filters.search).toBe('alien')
    expect(store.filters.genre).toBe('Horror')
  })
})
```

- [ ] **Step 5: Implement `FilterBar.vue`, run tests to pass**

```vue
<script setup lang="ts">
import { useLibraryStore } from '../stores/library'
import type { SortKey } from '../lib/filtering'
const store = useLibraryStore()
const sortOptions: Array<[SortKey, string]> = [
  ['title', 'Title'],
  ['year', 'Year'],
  ['rating', 'Rating'],
  ['lastWatched', 'Last watched']
]
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 rounded-lg bg-neutral-800 p-3 text-sm">
    <input
      data-testid="filter-search"
      :value="store.filters.search"
      placeholder="Search…"
      class="w-48 rounded bg-neutral-700 px-2 py-1 text-white placeholder-neutral-400"
      @input="store.setFilter({ search: ($event.target as HTMLInputElement).value })"
    />
    <select
      data-testid="filter-genre"
      :value="store.filters.genre ?? ''"
      class="rounded bg-neutral-700 px-2 py-1 text-white"
      @change="store.setFilter({ genre: ($event.target as HTMLSelectElement).value || null })"
    >
      <option value="">All genres</option>
      <option v-for="g in store.allGenres" :key="g" :value="g">{{ g }}</option>
    </select>
    <select
      data-testid="filter-year"
      :value="store.filters.year ?? ''"
      class="rounded bg-neutral-700 px-2 py-1 text-white"
      @change="
        store.setFilter({
          year: ($event.target as HTMLSelectElement).value
            ? Number(($event.target as HTMLSelectElement).value)
            : null
        })
      "
    >
      <option value="">All years</option>
      <option v-for="y in store.allYears" :key="y" :value="y">{{ y }}</option>
    </select>
    <select
      data-testid="filter-certification"
      :value="store.filters.certification ?? ''"
      class="rounded bg-neutral-700 px-2 py-1 text-white"
      @change="
        store.setFilter({ certification: ($event.target as HTMLSelectElement).value || null })
      "
    >
      <option value="">All ratings</option>
      <option v-for="c in store.allCertifications" :key="c" :value="c">{{ c }}</option>
    </select>
    <select
      data-testid="filter-minrating"
      :value="store.filters.minRating ?? ''"
      class="rounded bg-neutral-700 px-2 py-1 text-white"
      @change="
        store.setFilter({
          minRating: ($event.target as HTMLSelectElement).value
            ? Number(($event.target as HTMLSelectElement).value)
            : null
        })
      "
    >
      <option value="">Any score</option>
      <option v-for="r in [9, 8, 7, 6, 5]" :key="r" :value="r">★ {{ r / 2 }}+</option>
    </select>
    <select
      data-testid="filter-actor"
      :value="store.filters.actor ?? ''"
      class="max-w-40 rounded bg-neutral-700 px-2 py-1 text-white"
      @change="store.setFilter({ actor: ($event.target as HTMLSelectElement).value || null })"
    >
      <option value="">All actors</option>
      <option v-for="a in store.allActors" :key="a" :value="a">{{ a }}</option>
    </select>
    <select
      data-testid="filter-watched"
      :value="store.filters.watched"
      class="rounded bg-neutral-700 px-2 py-1 text-white"
      @change="
        store.setFilter({
          watched: ($event.target as HTMLSelectElement).value as 'all' | 'watched' | 'unwatched'
        })
      "
    >
      <option value="all">All</option>
      <option value="watched">Watched</option>
      <option value="unwatched">Unwatched</option>
    </select>
    <span class="ml-auto flex items-center gap-1 text-neutral-400">
      Sort:
      <select
        data-testid="sort"
        :value="store.sort"
        class="rounded bg-neutral-700 px-2 py-1 text-white"
        @change="store.setSort(($event.target as HTMLSelectElement).value as SortKey)"
      >
        <option v-for="[k, label] in sortOptions" :key="k" :value="k">{{ label }}</option>
      </select>
    </span>
    <button
      class="rounded bg-neutral-700 px-2 py-1 text-neutral-300 hover:bg-neutral-600"
      @click="store.resetFilters()"
    >
      Clear
    </button>
  </div>
</template>
```

Run: `npx vitest run src/renderer/src/components` → PASS (6 tests).

- [ ] **Step 6: Create router, LibraryView, and rewrite App shell**

`src/renderer/src/router.ts`:

```ts
import { createRouter, createWebHashHistory } from 'vue-router'
import LibraryView from './views/LibraryView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: LibraryView },
    { path: '/movie/:id', component: () => import('./views/MovieDetailView.vue') },
    { path: '/settings', component: () => import('./views/SettingsView.vue') }
  ]
})
```

`src/renderer/src/views/LibraryView.vue`:

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLibraryStore } from '../stores/library'
import FilterBar from '../components/FilterBar.vue'
import MovieCard from '../components/MovieCard.vue'

const store = useLibraryStore()
const router = useRouter()
const apiKeyMissing = ref(false)
const hasFolders = ref(true)

onMounted(async () => {
  const settings = await window.api.getSettings()
  apiKeyMissing.value = !settings.tmdbApiKey
  hasFolders.value = settings.folders.length > 0
  await store.load()
})

const empty = computed(() => store.loaded && store.all.length === 0)
</script>

<template>
  <div class="space-y-4">
    <div v-if="apiKeyMissing" class="rounded-lg bg-amber-900/60 p-3 text-sm text-amber-200">
      No TMDB API key set — movies will be indexed without metadata.
      <RouterLink to="/settings" class="underline">Add your key in Settings</RouterLink>.
    </div>
    <div v-if="store.pendingCount > 0" class="rounded-lg bg-sky-900/60 p-3 text-sm text-sky-200">
      Fetching metadata for {{ store.pendingCount }} movie(s)…
    </div>
    <FilterBar />
    <div v-if="empty" class="rounded-lg bg-neutral-800 p-10 text-center text-neutral-300">
      <p class="mb-3 text-lg">Your library is empty.</p>
      <RouterLink to="/settings" class="rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-500">
        {{ hasFolders ? 'Manage folders' : 'Add your first movie folder' }}
      </RouterLink>
    </div>
    <div
      v-else
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    >
      <MovieCard
        v-for="m in store.list"
        :key="m.id"
        :movie="m"
        @open="router.push(`/movie/${$event}`)"
      />
    </div>
  </div>
</template>
```

`src/renderer/src/App.vue` (replace template demo):

```vue
<script setup lang="ts"></script>

<template>
  <div class="min-h-screen bg-neutral-900 text-white">
    <header
      class="sticky top-0 z-10 flex items-center gap-4 border-b border-neutral-800 bg-neutral-900/95 px-4 py-3"
    >
      <RouterLink to="/" class="text-lg font-semibold">🎬 Movie World</RouterLink>
      <RouterLink to="/settings" class="ml-auto text-sm text-neutral-300 hover:text-white"
        >Settings</RouterLink
      >
    </header>
    <main class="p-4"><RouterView /></main>
  </div>
</template>
```

`src/renderer/src/main.ts`:

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import './assets/main.css'

createApp(App).use(createPinia()).use(router).mount('#app')
```

(Create empty placeholder files `views/MovieDetailView.vue` and `views/SettingsView.vue` with a `<template><div /></template>` stub so the router compiles — Tasks 13/14 fill them.)

- [ ] **Step 7: Verify & commit**

```bash
npx vitest run && npx eslint . --max-warnings 0 && npx tsc --noEmit
npm run dev   # expect: header, filter bar, empty-state panel
git add -A && git commit -m "feat: library grid with movie cards, filter bar and app shell"
```

---

### Task 13: Movie detail view & fix-match dialog

**Files:**

- Create: `src/renderer/src/views/MovieDetailView.vue` (replace stub), `src/renderer/src/components/FixMatchDialog.vue`
- Test: `src/renderer/src/components/__tests__/FixMatchDialog.test.ts`

**Interfaces:**

- Consumes: `useLibraryStore` (Task 11), `window.api.searchTmdb/fixMatch/play/retryFetch/revealFile` (Task 10), `artSrc` (Task 12), `StarRating` (Task 12)
- Produces: `FixMatchDialog.vue` props `{ movie: MovieRecord }`, emits `close`; test-ids: `fix-search-input`, `fix-search-year`, `fix-candidate` (one per result), `fix-id-input`, `fix-id-submit`

- [ ] **Step 1: Write the failing FixMatchDialog test**

`src/renderer/src/components/__tests__/FixMatchDialog.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import FixMatchDialog from '../FixMatchDialog.vue'
import type { MovieRecord } from '../../../../shared/types'

const movie: MovieRecord = {
  id: 'id1',
  filePath: '/f.mkv',
  fileSize: 0,
  folderPath: '/',
  parsedTitle: 'Matrix',
  parsedYear: 1999,
  matchStatus: 'unmatched',
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

beforeEach(() => {
  vi.stubGlobal('window', {
    api: {
      searchTmdb: vi.fn(async () => [
        { id: 603, title: 'The Matrix', release_date: '1999-03-30', poster_path: '/p.jpg' }
      ]),
      fixMatch: vi.fn(async () => {})
    }
  })
})

describe('FixMatchDialog', () => {
  it('searches on mount with parsed title/year and applies a selected candidate', async () => {
    const w = mount(FixMatchDialog, { props: { movie } })
    await flushPromises()
    expect(window.api.searchTmdb).toHaveBeenCalledWith('Matrix', 1999)
    const candidate = w.find('[data-testid="fix-candidate"]')
    expect(candidate.text()).toContain('The Matrix')
    await candidate.trigger('click')
    expect(window.api.fixMatch).toHaveBeenCalledWith('id1', 603)
    expect(w.emitted('close')).toBeTruthy()
  })

  it('accepts a raw TMDB id', async () => {
    const w = mount(FixMatchDialog, { props: { movie } })
    await flushPromises()
    await w.find('[data-testid="fix-id-input"]').setValue('550')
    await w.find('[data-testid="fix-id-submit"]').trigger('click')
    expect(window.api.fixMatch).toHaveBeenCalledWith('id1', 550)
  })
})
```

- [ ] **Step 2: Run to verify failure, implement `FixMatchDialog.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { MovieRecord } from '../../../shared/types'

interface Candidate {
  id: number
  title: string
  release_date?: string
  poster_path?: string | null
  overview?: string
}

const props = defineProps<{ movie: MovieRecord }>()
const emit = defineEmits<{ close: [] }>()

const query = ref(props.movie.parsedTitle)
const year = ref<number | null>(props.movie.parsedYear)
const rawId = ref('')
const results = ref<Candidate[]>([])
const searching = ref(false)

async function search(): Promise<void> {
  searching.value = true
  try {
    results.value = await window.api.searchTmdb(query.value, year.value)
  } finally {
    searching.value = false
  }
}

async function apply(tmdbId: number): Promise<void> {
  await window.api.fixMatch(props.movie.id, tmdbId)
  emit('close')
}

onMounted(search)
</script>

<template>
  <div
    class="fixed inset-0 z-20 flex items-center justify-center bg-black/70"
    @click.self="emit('close')"
  >
    <div
      class="max-h-[80vh] w-[560px] overflow-y-auto rounded-lg bg-neutral-800 p-4 text-sm text-white"
    >
      <h2 class="mb-3 text-lg font-semibold">Fix match</h2>
      <div class="mb-3 flex gap-2">
        <input
          data-testid="fix-search-input"
          v-model="query"
          class="flex-1 rounded bg-neutral-700 px-2 py-1"
          @keyup.enter="search"
        />
        <input
          data-testid="fix-search-year"
          v-model.number="year"
          type="number"
          placeholder="Year"
          class="w-24 rounded bg-neutral-700 px-2 py-1"
          @keyup.enter="search"
        />
        <button class="rounded bg-sky-600 px-3 py-1 hover:bg-sky-500" @click="search">
          Search
        </button>
      </div>
      <p v-if="searching" class="text-neutral-400">Searching…</p>
      <p v-else-if="!results.length" class="text-neutral-400">
        No results — adjust the search or paste a TMDB id below.
      </p>
      <ul class="space-y-2">
        <li
          v-for="r in results"
          :key="r.id"
          data-testid="fix-candidate"
          class="flex cursor-pointer gap-3 rounded bg-neutral-700/60 p-2 hover:bg-neutral-600"
          @click="apply(r.id)"
        >
          <img
            v-if="r.poster_path"
            :src="`https://image.tmdb.org/t/p/w92${r.poster_path}`"
            class="h-20 w-14 rounded object-cover"
          />
          <div>
            <div class="font-medium">
              {{ r.title }}
              <span class="text-neutral-400">({{ r.release_date?.slice(0, 4) ?? '—' }})</span>
            </div>
            <div class="line-clamp-2 text-xs text-neutral-400">{{ r.overview }}</div>
          </div>
        </li>
      </ul>
      <div class="mt-4 flex items-center gap-2 border-t border-neutral-700 pt-3">
        <span class="text-neutral-400">TMDB id:</span>
        <input
          data-testid="fix-id-input"
          v-model="rawId"
          class="w-28 rounded bg-neutral-700 px-2 py-1"
          placeholder="e.g. 603"
        />
        <button
          data-testid="fix-id-submit"
          class="rounded bg-sky-600 px-3 py-1 hover:bg-sky-500"
          :disabled="!/^\d+$/.test(rawId)"
          @click="apply(Number(rawId))"
        >
          Use id
        </button>
        <button
          class="ml-auto rounded bg-neutral-700 px-3 py-1 hover:bg-neutral-600"
          @click="emit('close')"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>
```

Run: `npx vitest run src/renderer/src/components/__tests__/FixMatchDialog.test.ts` → PASS (2 tests).

- [ ] **Step 3: Implement `MovieDetailView.vue`** (replaces the Task 12 stub; verified manually in Step 4)

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLibraryStore } from '../stores/library'
import { artSrc } from '../lib/art'
import StarRating from '../components/StarRating.vue'
import FixMatchDialog from '../components/FixMatchDialog.vue'

const route = useRoute()
const router = useRouter()
const store = useLibraryStore()
const fixing = ref(false)

const movie = computed(() => store.movies[String(route.params.id)])
const title = computed(() => movie.value?.title ?? movie.value?.parsedTitle ?? '')
const fileName = computed(() => movie.value?.filePath.split('/').at(-1) ?? '')
const sizeGb = computed(() =>
  movie.value ? (movie.value.fileSize / 1024 ** 3).toFixed(2) + ' GB' : ''
)
const lastWatched = computed(() =>
  movie.value?.lastPlayedAt ? new Date(movie.value.lastPlayedAt).toLocaleString() : 'never'
)
</script>

<template>
  <div v-if="!movie" class="text-neutral-400">
    Movie not found. <button class="underline" @click="router.push('/')">Back to library</button>
  </div>
  <div v-else>
    <div class="relative -m-4 mb-4 h-64 overflow-hidden">
      <img
        v-if="artSrc(movie.fanartPath)"
        :src="artSrc(movie.fanartPath)!"
        class="h-full w-full object-cover opacity-40"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-neutral-900" />
      <button
        class="absolute left-4 top-4 rounded bg-black/60 px-3 py-1 text-sm"
        @click="router.back()"
      >
        ← Back
      </button>
    </div>
    <div class="mx-auto flex max-w-4xl gap-6">
      <img
        v-if="artSrc(movie.posterPath)"
        :src="artSrc(movie.posterPath)!"
        class="-mt-32 h-72 w-48 shrink-0 rounded-lg object-cover shadow-xl"
      />
      <div class="min-w-0 space-y-3">
        <h1 class="text-2xl font-bold">
          {{ title }}
          <span class="font-normal text-neutral-400"
            >({{ movie.year ?? movie.parsedYear ?? '—' }})</span
          >
        </h1>
        <div class="flex flex-wrap items-center gap-3 text-sm text-neutral-300">
          <span
            v-if="movie.certificationAu"
            class="rounded border border-neutral-500 px-1.5 py-0.5 text-xs"
            >{{ movie.certificationAu }}</span
          >
          <StarRating :vote-average="movie.voteAverage" />
          <span v-if="movie.runtime">{{ movie.runtime }} min</span>
          <span>{{ movie.genres.join(', ') }}</span>
        </div>
        <p class="text-sm text-neutral-300">{{ movie.overview }}</p>
        <p v-if="movie.cast.length" class="text-sm text-neutral-400">
          Cast: {{ movie.cast.map((c) => c.name).join(', ') }}
        </p>
        <div class="flex flex-wrap gap-2 pt-1">
          <button
            class="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
            :disabled="movie.fileMissing"
            @click="window.api.play(movie.id)"
          >
            ▶ Play
          </button>
          <button
            v-if="movie.fetchFailed"
            class="rounded bg-sky-700 px-3 py-2 text-sm hover:bg-sky-600"
            @click="window.api.retryFetch(movie.id)"
          >
            Retry fetch
          </button>
          <button
            class="rounded bg-neutral-700 px-3 py-2 text-sm hover:bg-neutral-600"
            @click="fixing = true"
          >
            Fix match
          </button>
          <button
            class="rounded bg-neutral-700 px-3 py-2 text-sm hover:bg-neutral-600"
            @click="window.api.revealFile(movie.id)"
          >
            Reveal in Finder
          </button>
        </div>
        <p class="text-xs text-neutral-500">
          Watched {{ movie.playCount }}×, last: {{ lastWatched }} · {{ fileName }} · {{ sizeGb }}
        </p>
        <div
          v-if="movie.trailerYoutubeKey"
          class="aspect-video w-full max-w-2xl overflow-hidden rounded-lg"
        >
          <iframe
            :src="`https://www.youtube-nocookie.com/embed/${movie.trailerYoutubeKey}`"
            class="h-full w-full"
            frameborder="0"
            allowfullscreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
        <p v-else class="text-sm text-neutral-500">No trailer found for this movie.</p>
      </div>
    </div>
    <FixMatchDialog v-if="fixing" :movie="movie" @close="fixing = false" />
  </div>
</template>
```

Note: `window.api` isn't reachable directly from a template expression in `<script setup>` — expose it: add `const api = window.api` in the script block and call `api.play(...)` etc. in the template. (The implementer should do this; the test suite plus `tsc` will catch it.)

- [ ] **Step 4: Verify & commit**

```bash
npx vitest run && npx eslint . --max-warnings 0 && npx tsc --noEmit
npm run dev   # navigate to a movie (or verify route renders 'Movie not found' gracefully)
git add -A && git commit -m "feat: movie detail view with trailer embed and fix-match dialog"
```

---

### Task 14: Settings view & first-run experience

**Files:**

- Create: `src/renderer/src/views/SettingsView.vue` (replace stub)
- Test: `src/renderer/src/views/__tests__/SettingsView.test.ts`

**Interfaces:**

- Consumes: `window.api.getSettings/setApiKey/addFolder/removeFolder/rescanFolder/onScanProgress` (Task 10)
- Produces: test-ids `apikey-input`, `apikey-save`, `folder-add`, `folder-row` (per folder), `folder-remove`, `folder-rescan`

- [ ] **Step 1: Write the failing test**

`src/renderer/src/views/__tests__/SettingsView.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SettingsView from '../SettingsView.vue'

beforeEach(() => {
  vi.stubGlobal('window', {
    api: {
      getSettings: vi.fn(async () => ({ folders: ['/Movies'], tmdbApiKey: null })),
      setApiKey: vi.fn(async (k: string) => ({ folders: ['/Movies'], tmdbApiKey: k })),
      addFolder: vi.fn(async () => ({ folders: ['/Movies', '/More'], tmdbApiKey: null })),
      removeFolder: vi.fn(async () => ({ folders: [], tmdbApiKey: null })),
      rescanFolder: vi.fn(async () => {}),
      onScanProgress: vi.fn()
    }
  })
})

describe('SettingsView', () => {
  it('lists folders and saves the api key', async () => {
    const w = mount(SettingsView)
    await flushPromises()
    expect(w.find('[data-testid="folder-row"]').text()).toContain('/Movies')
    await w.find('[data-testid="apikey-input"]').setValue('NEWKEY')
    await w.find('[data-testid="apikey-save"]').trigger('click')
    expect(window.api.setApiKey).toHaveBeenCalledWith('NEWKEY')
  })

  it('adds a folder via the native dialog and triggers rescan', async () => {
    const w = mount(SettingsView)
    await flushPromises()
    await w.find('[data-testid="folder-add"]').trigger('click')
    await flushPromises()
    expect(window.api.addFolder).toHaveBeenCalled()
    expect(w.findAll('[data-testid="folder-row"]')).toHaveLength(2)
    await w.findAll('[data-testid="folder-rescan"]')[0].trigger('click')
    expect(window.api.rescanFolder).toHaveBeenCalledWith('/Movies')
  })
})
```

- [ ] **Step 2: Run to verify failure, implement `SettingsView.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { ScanProgress, Settings } from '../../../shared/types'

const api = window.api
const settings = ref<Settings>({ folders: [], tmdbApiKey: null })
const keyInput = ref('')
const saved = ref(false)
const progress = ref<Record<string, ScanProgress>>({})

onMounted(async () => {
  settings.value = await api.getSettings()
  keyInput.value = settings.value.tmdbApiKey ?? ''
  api.onScanProgress((p) => (progress.value[p.folder] = p))
})

async function saveKey(): Promise<void> {
  settings.value = await api.setApiKey(keyInput.value.trim())
  saved.value = true
  setTimeout(() => (saved.value = false), 2000)
}

async function addFolder(): Promise<void> {
  const next = await api.addFolder()
  if (next) settings.value = next
}

async function removeFolder(path: string): Promise<void> {
  settings.value = await api.removeFolder(path)
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-8">
    <section>
      <h2 class="mb-2 text-lg font-semibold">TMDB API key</h2>
      <p class="mb-2 text-sm text-neutral-400">
        Get a free key at themoviedb.org → Settings → API. Without it, movies are indexed but no
        metadata is fetched.
      </p>
      <div class="flex gap-2">
        <input
          data-testid="apikey-input"
          v-model="keyInput"
          type="password"
          class="flex-1 rounded bg-neutral-700 px-2 py-1 text-sm"
          placeholder="TMDB API key"
        />
        <button
          data-testid="apikey-save"
          class="rounded bg-sky-600 px-4 py-1 text-sm hover:bg-sky-500"
          @click="saveKey"
        >
          {{ saved ? 'Saved ✓' : 'Save' }}
        </button>
      </div>
    </section>
    <section>
      <h2 class="mb-2 text-lg font-semibold">Movie folders</h2>
      <ul class="mb-3 space-y-2">
        <li
          v-for="f in settings.folders"
          :key="f"
          data-testid="folder-row"
          class="flex items-center gap-2 rounded bg-neutral-800 px-3 py-2 text-sm"
        >
          <span class="min-w-0 flex-1 truncate">{{ f }}</span>
          <span v-if="progress[f] && !progress[f].done" class="text-xs text-sky-300">
            scanning {{ progress[f].ingested }}/{{ progress[f].discovered }}…
          </span>
          <button
            data-testid="folder-rescan"
            class="rounded bg-neutral-700 px-2 py-1 text-xs hover:bg-neutral-600"
            @click="api.rescanFolder(f)"
          >
            Rescan
          </button>
          <button
            data-testid="folder-remove"
            class="rounded bg-red-800 px-2 py-1 text-xs hover:bg-red-700"
            @click="removeFolder(f)"
          >
            Remove
          </button>
        </li>
      </ul>
      <button
        data-testid="folder-add"
        class="rounded bg-sky-600 px-4 py-2 text-sm hover:bg-sky-500"
        @click="addFolder"
      >
        + Add folder…
      </button>
      <p class="mt-2 text-xs text-neutral-500">
        Removing a folder only forgets it in the app — nothing on disk is touched.
      </p>
    </section>
  </div>
</template>
```

Run: `npx vitest run src/renderer/src/views` → PASS (2 tests).

- [ ] **Step 3: Verify & commit**

```bash
npx vitest run && npx eslint . --max-warnings 0 && npx tsc --noEmit
git add -A && git commit -m "feat: settings view with api key, folder management and scan progress"
```

---

### Task 15: End-to-end verification & packaging

**Files:**

- Modify: `package.json` / `electron-builder.yml` (template provides one), `README.md` (create)

- [ ] **Step 1: Full-suite gate**

```bash
npx vitest run && npx eslint . --max-warnings 0 && npx tsc --noEmit
```

Expected: all green. Fix anything that isn't before proceeding.

- [ ] **Step 2: Manual end-to-end walkthrough (the real app, real data)**

Create a throwaway fixture library first:

```bash
mkdir -p ~/mw-test/"The Matrix (1999)" && : > ~/mw-test/"The Matrix (1999)/The.Matrix.1999.1080p.mkv"
: > ~/mw-test/Alien.1979.mp4 && : > ~/mw-test/Some.Obscure.Home.Video.mkv
```

Then `npm run dev` and verify each item:

1. First-run: banner prompts for API key → enter a real TMDB key in Settings.
2. Add `~/mw-test` via the native dialog → grid shows 3 pending cards → Matrix and Alien fill in with posters, AU rating badge, stars, actors.
3. `Some.Obscure.Home.Video` shows "needs match" → Fix match → search or paste id `603` → card updates.
4. Check on disk: `.nfo`, `-poster.jpg`, `-fanart.jpg` exist beside each matched file.
5. Detail page: trailer plays in the embedded iframe; Play opens the (empty) file in the default player and "last watched" updates; NFO now contains `<playcount>1</playcount>`.
6. Filters: genre/year/rating/actor/watched each narrow the grid; Clear resets.
7. Quit, relaunch: library loads instantly from NFOs (no pending cards, no TMDB calls — verify by temporarily entering airplane mode or an invalid key).
8. Delete `Alien.1979.mp4`, Rescan → "file missing" badge appears.

- [ ] **Step 3: Package the macOS app**

Check the template's builder config (`electron-builder.yml`): set `productName: Movie World`, `appId: com.tomkaczocha.movieworld`, mac target `dmg`. Then:

```bash
npm run build:mac
```

Expected: `dist/Movie World-*.dmg`. Install it, launch (right-click → Open the first time, app is unsigned), confirm the library loads from the same settings/NFOs.

- [ ] **Step 4: Write `README.md`**

Short: what it is, screenshot placeholder, `npm install` / `npm run dev` / `npm run build:mac`, where settings live (`~/Library/Application Support/movie-world/settings.json`), TMDB key setup, NFO compatibility note.

- [ ] **Step 5: Final commit**

```bash
git add -A && git commit -m "chore: packaging config, README and end-to-end verification"
```

---

## Plan Self-Review Notes

- **Spec coverage:** every spec section maps to a task — sidecars/NFO (4), scan (6), TMDB+matching+trailer (5, 7), fix-match (13), playback+watch-state (8), live IPC updates (9, 10), filter/sort UI (11, 12), detail+trailer embed (13), settings+first-run (14), error handling (badges in 12, retry in 7/13, key-missing banners in 12/14), packaging (15).
- **Known judgment calls for the implementer:** exact fast-xml-parser options may need small adjustments to satisfy the round-trip test (the test is the contract, not the listed options); the electron-vite template's file names occasionally drift between versions — keep the template's structure and slot the code in.
- **Verification:** Task 15's manual walkthrough is mandatory before calling this done (per Definition of Done: visually verify UI changes).

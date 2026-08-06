// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  formatFileSize,
  formatFolderLabel,
  formatLastWatchedRelative,
  formatWatchSummary
} from '../format'

describe('formatFileSize', () => {
  it('picks sensible units', () => {
    expect(formatFileSize(500)).toBe('500 B')
    expect(formatFileSize(12 * 1024)).toBe('12 KB')
    expect(formatFileSize(280 * 1024 ** 2)).toBe('280 MB')
    expect(formatFileSize(1.82 * 1024 ** 3)).toBe('1.82 GB')
  })
})

describe('formatLastWatchedRelative', () => {
  const day = 86_400_000
  const now = Date.parse('2026-08-06T12:00:00Z')

  it('handles never and recent days', () => {
    expect(formatLastWatchedRelative(null, now)).toBe('never')
    expect(formatLastWatchedRelative(new Date(now).toISOString(), now)).toBe('today')
    expect(formatLastWatchedRelative(new Date(now - day).toISOString(), now)).toBe('yesterday')
    expect(formatLastWatchedRelative(new Date(now - 10 * day).toISOString(), now)).toBe(
      '10 days ago'
    )
  })
})

describe('formatWatchSummary', () => {
  it('avoids “0× · never” phrasing', () => {
    expect(formatWatchSummary(0, null)).toBe('Not watched yet')
    expect(formatWatchSummary(1, '2026-08-06T00:00:00Z', Date.parse('2026-08-06T12:00:00Z'))).toBe(
      'Watched once · last today'
    )
  })
})

describe('formatFolderLabel', () => {
  it('prefixes generic leaf names with parent', () => {
    expect(formatFolderLabel('/Users/me/Drive/Photos/Movies')).toBe('Photos/Movies')
    expect(formatFolderLabel('/Volumes/Media/Films')).toBe('Media/Films')
    expect(formatFolderLabel('/data/Bond Collection')).toBe('Bond Collection')
  })
})

import { describe, it, expect } from 'vitest'
import { decodeArtUrl, buildCsp, MW_ART_SCHEME } from '../art-protocol'

describe('decodeArtUrl', () => {
  it('decodes an encoded absolute path', () => {
    const p = '/Users/me/Movies/My Film (2020)/poster.jpg'
    expect(decodeArtUrl(`${MW_ART_SCHEME}://${encodeURIComponent(p)}`)).toBe(p)
  })

  it('round-trips paths with reserved and unicode characters', () => {
    const p = '/movies/a & b/#1/póster.jpg'
    expect(decodeArtUrl(`${MW_ART_SCHEME}://${encodeURIComponent(p)}`)).toBe(p)
  })

  it('tolerates the short scheme form without a double slash', () => {
    const p = '/movies/x.jpg'
    expect(decodeArtUrl(`${MW_ART_SCHEME}:${encodeURIComponent(p)}`)).toBe(p)
  })
})

describe('buildCsp', () => {
  it('permits mw-art: image sources and the youtube trailer frame', () => {
    const csp = buildCsp(false)
    expect(csp).toMatch(/img-src[^;]*mw-art:/)
    expect(csp).toMatch(/frame-src[^;]*https:\/\/www\.youtube\.com/)
    expect(csp).toMatch(/child-src[^;]*https:\/\/www\.youtube\.com/)
  })

  it('loosens script-src for HMR only in dev', () => {
    expect(buildCsp(true)).toContain("'unsafe-eval'")
    expect(buildCsp(false)).not.toContain("'unsafe-eval'")
  })
})

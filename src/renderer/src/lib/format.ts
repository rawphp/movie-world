/** Human-readable file size for library/detail chrome. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
  const gb = mb / 1024
  return `${gb < 10 ? gb.toFixed(2) : gb.toFixed(1)} GB`
}

/** Relative “last watched” label for cards. */
export function formatLastWatchedRelative(iso: string | null, now = Date.now()): string {
  if (!iso) return 'never'
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return 'never'
  const days = Math.floor((now - ts) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  if (days < 365) {
    const months = Math.floor(days / 30)
    return months === 1 ? '1 month ago' : `${months} months ago`
  }
  const years = Math.floor(days / 365)
  return years === 1 ? '1 year ago' : `${years} years ago`
}

/** Detail-page watch summary without “0× · never” noise. */
export function formatWatchSummary(
  playCount: number,
  lastPlayedAt: string | null,
  now = Date.now()
): string {
  if (playCount <= 0 || !lastPlayedAt) {
    return 'Not watched yet'
  }
  const when = formatLastWatchedRelative(lastPlayedAt, now)
  const times = playCount === 1 ? 'once' : `${playCount}×`
  return `Watched ${times} · last ${when}`
}

/** Short folder label: parent/name when the leaf is generic. */
export function formatFolderLabel(path: string): string {
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) return path
  if (parts.length === 1) return parts[0]
  const leaf = parts[parts.length - 1]
  const parent = parts[parts.length - 2]
  // Common generic leaves benefit from the parent segment.
  if (/^(movies?|films?|video|videos|media|library)$/i.test(leaf)) {
    return `${parent}/${leaf}`
  }
  return leaf
}

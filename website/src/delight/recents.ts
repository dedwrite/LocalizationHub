/** Optional UI bookmarks contain IDs only, scoped by authenticated user. They
 * never authorize a project or replace the current server's project listing. */
const recentKey = (userId: string) => `localizationhub.recent-cloud.${encodeURIComponent(userId)}.v1`
export function rememberCloudProject(userId: string, projectId: string) {
  if (!userId || !projectId) return
  try { localStorage.setItem(recentKey(userId), projectId) } catch { /* Browsing must work without optional storage. */ }
}
export function lastCloudProject(userId: string): string | null {
  if (!userId) return null
  try { return localStorage.getItem(recentKey(userId)) } catch { return null }
}

export function latestDated<T>(rows: readonly T[], dateOf: (row: T) => string): T | undefined {
  let latest: T | undefined, latestTime = -Infinity
  for (const row of rows) {
    const time = Date.parse(dateOf(row))
    if (Number.isFinite(time) && time > latestTime) { latest = row; latestTime = time }
  }
  return latest
}

export function coverage(total: unknown, translated: unknown) {
  const safeCount = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0
  const count = safeCount(total)
  const done = Math.min(count, safeCount(translated))
  return { total: count, translated: done, percent: count ? Math.floor(done / count * 100) : 0, complete: count > 0 && done === count }
}

export function localCoverage(value: unknown) {
  const project = value as { entries?: Array<{ id?: string; translation?: string } | null>; selectedEntryId?: string } | null
  const entries = Array.isArray(project?.entries) ? project.entries : []
  const counts = coverage(entries.length, entries.filter(entry => typeof entry?.translation === 'string' && entry.translation.trim().length > 0).length)
  const position = project?.selectedEntryId ? entries.findIndex(entry => entry?.id === project.selectedEntryId) + 1 : 0
  return { ...counts, position }
}

import { addProjectTag, calculateProjectStatistics, createTokenProfileConfig, decodeLocalizationProject, emptyProjectMetadata, findTranslationMemory, glossaryIssues, glossaryIssues as getGlossaryIssues, toggleEntryTag, validateProtectedTokens, type ProjectMetadata } from '@localizationhub/core'

export type AuthUser = {
  id: string
  username: string
  email: string
  emailVerified: boolean
  createdAt: string
}

export type AuthResult = { user: AuthUser; token: string; expiresAt: string }
export type ProjectSummary = {
  id: string
  name: string
  role: 'owner' | 'editor' | 'viewer'
  revision: number
  updatedAt: string
  sourceFileName?: string
  entryCount?: number
  translatedCount?: number
  memberCount?: number
}
export type ProjectSnapshot = {
  id: string
  name: string
  role: 'owner' | 'editor' | 'viewer'
  revision: number
  updatedAt: string
  project: any
  migratedFromVersion: 1 | 2 | null
}

const TOKEN_KEY = 'localizationhub.auth.token'
const USER_KEY = 'localizationhub.auth.user'

function token(): string | null { try { return window.localStorage.getItem(TOKEN_KEY) } catch { return null } }
function headers() { const value = token(); return value ? { Accept: 'application/json', Authorization: `Bearer ${value}` } : { Accept: 'application/json' } }
async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(path, { ...init, headers: { ...headers(), ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } as HeadersInit })
  const text = await response.text()
  let body: any = null
  try { body = text ? JSON.parse(text) : null } catch { body = { message: text } }
  if (!response.ok) { const error = new Error(body?.message || body?.error || `Request failed (${response.status})`); ;(error as any).status = response.status; ;(error as any).code = body?.error; throw error }
  return body
}

function isAuthUser(value: unknown): value is AuthUser {
  return Boolean(value) && typeof value === 'object' && value !== null
    && typeof (value as AuthUser).id === 'string'
    && typeof (value as AuthUser).username === 'string'
}

export function getStoredUser(): AuthUser | null {
  let value: string | null = null
  try { value = window.localStorage.getItem(USER_KEY) } catch { return null }
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (!isAuthUser(parsed)) { clearAuth(); return null }
    return parsed
  } catch { clearAuth(); return null }
}

export function saveAuth(result: AuthResult) {
  try { window.localStorage.setItem(TOKEN_KEY, result.token) } catch { /* Storage unavailable; session stays in memory. */ }
  try { window.localStorage.setItem(USER_KEY, JSON.stringify(result.user)) } catch { /* Ignore. */ }
}

export function clearAuth() {
  try { window.localStorage.removeItem(TOKEN_KEY) } catch { /* Ignore. */ }
  try { window.localStorage.removeItem(USER_KEY) } catch { /* Ignore. */ }
}
export function getAuthToken() { return token() }
export async function login(username: string, password: string) { const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }); saveAuth(result); return result as AuthResult }
export async function register(username: string, email: string, password: string) { const result = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) }); saveAuth(result); return result as AuthResult }
export async function restoreSession() { if (!token()) return null; try { const result = await api('/api/auth/me'); try { window.localStorage.setItem(USER_KEY, JSON.stringify(result.user)) } catch { /* Storage write failed; keep the in-memory session. */ } return result.user as AuthUser } catch { clearAuth(); return null } }
export async function logout() { if (token()) { try { await api('/api/auth/logout', { method: 'POST' }) } finally { clearAuth() } } }
export async function listProjects() { return (await api('/api/projects')).projects as ProjectSummary[] }
export async function createProject(name: string, project?: any) { return (await api('/api/projects', { method: 'POST', body: JSON.stringify({ name, project: project ?? { format: 'LocalizationHubProject', version: 3, sourceFileName: `${name}.json`, entries: [{ id: 'entry-1', translation: '' }], tokenProfile: 'auto', tokenProfileConfig: createTokenProfileConfig('auto'), workflow: { entries: {} } } }) })).project as ProjectSnapshot }
export async function getProject(id: string) {
  const snapshot = (await api(`/api/projects/${id}`)).project as Omit<ProjectSnapshot, 'migratedFromVersion'>
  return decodeCloudProject(snapshot)
}

/*
 * Centralized Web Cloud project decoding.
 *
 * Mirrors the desktop `cloudProjectStorage.load()`: the nested `project`
 * payload may be a legacy V1/V2 shape, so it is decoded and migrated in memory
 * to current V3 via `decodeLocalizationProject`. Only the nested payload is
 * normalized — id, name, role, revision, and updatedAt are preserved.
 */
export function decodeCloudProject(snapshot: Omit<ProjectSnapshot, 'migratedFromVersion'>): ProjectSnapshot {
  const decoded = decodeLocalizationProject(JSON.stringify(snapshot.project))
  if (!decoded.ok) {
    const error = new Error(`This Cloud Project cannot be opened: ${decoded.reason}.`) as Error & { code?: string }
    error.code = 'cloud-project-decode-failed'
    throw error
  }
  return {
    ...snapshot,
    project: decoded.project,
    migratedFromVersion: decoded.migratedFromVersion,
  }
}

export async function saveProject(id: string, baseRevision: number, project: any) {
  const snapshot = (await api(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify({ baseRevision, project }) })).project as Omit<ProjectSnapshot, 'migratedFromVersion'>
  return decodeCloudProject(snapshot)
}
export async function deleteProject(id: string): Promise<void> {
  const result = await api(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (result?.deleted !== true || result?.projectId !== id) throw new Error('Could not confirm project deletion. Refresh before trying again.')
}
/* Self-service account deletion. The server removes the account, its sessions,
 * and the Cloud Projects it owns; the local auth copy goes with it, so the next
 * request cannot act as the deleted account. */
export async function deleteAccount(email: string, deleteOwnedProjects: boolean) {
  const result = await api('/api/account', { method: 'DELETE', body: JSON.stringify({ confirmEmail: email, deleteOwnedProjects }) })
  if (result?.deleted !== true) throw new Error('Could not confirm account deletion. Refresh before trying again.')
  clearAuth()
  return { deleted: true as const, projects: Number(result?.projects ?? 0) }
}
export async function sendVerification() { return api('/api/auth/verification/send', { method: 'POST' }) }
export function projectStats(project: any) { return calculateProjectStatistics(project.entries, project.workflow?.entries ?? {}) }
export function tokenWarnings(source: string, translation: string) { return validateProtectedTokens(source, translation).errors }
export function metadata(project: any): ProjectMetadata { return { ...emptyProjectMetadata(), ...(project.metadata ?? {}) } }
export { addProjectTag, findTranslationMemory, getGlossaryIssues, glossaryIssues, toggleEntryTag }
export async function listMembers(id: string) { return (await api(`/api/projects/${id}/members`)).members }
export async function addMember(id: string, username: string, role: 'editor' | 'viewer') { return (await api(`/api/projects/${id}/members`, { method: 'POST', body: JSON.stringify({ username, role }) })).member }
export async function changeMemberRole(id: string, userId: string, role: 'editor' | 'viewer') { return (await api(`/api/projects/${id}/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) })).member }
export async function removeMember(id: string, userId: string) { return api(`/api/projects/${id}/members/${userId}`, { method: 'DELETE' }) }
export async function listAssignments(id: string) { return (await api(`/api/projects/${id}/assignments`)).assignments }
export async function setAssignment(id: string, entryId: string, assigneeUserId: string | null) { return api(`/api/projects/${id}/assignments/${encodeURIComponent(entryId)}`, { method: 'PUT', body: JSON.stringify({ assigneeUserId }) }) }
export async function listComments(id: string, entryId: string) { return (await api(`/api/projects/${id}/entries/${encodeURIComponent(entryId)}/comments`)).comments }
export async function listCommentCounts(id: string) { return (await api(`/api/projects/${id}/comments-summary`)).entries as Array<{ entryId: string; count: number; unresolved: number }> }
export async function addComment(id: string, entryId: string, body: string) { return (await api(`/api/projects/${id}/entries/${encodeURIComponent(entryId)}/comments`, { method: 'POST', body: JSON.stringify({ body }) })).comment }
export async function resolveComment(id: string, commentId: string, resolved: boolean) { return api(`/api/projects/${id}/comments/${commentId}`, { method: 'PATCH', body: JSON.stringify({ resolved }) }) }
export async function listActivity(id: string, entryId?: string) { return (await api(`/api/projects/${id}/activity${entryId ? `?entryId=${encodeURIComponent(entryId)}` : ''}`)).activity }
export async function restoreActivity(id: string, activityId: string, baseRevision: number) { return (await api(`/api/projects/${id}/activity/${activityId}/restore`, { method: 'POST', body: JSON.stringify({ baseRevision }) })).restore }

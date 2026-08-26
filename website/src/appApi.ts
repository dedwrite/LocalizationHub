import { addProjectTag, calculateProjectStatistics, emptyProjectMetadata, findTranslationMemory, glossaryIssues, glossaryIssues as getGlossaryIssues, toggleEntryTag, validateProtectedTokens, type ProjectMetadata } from '@localizationhub/core'

export type AuthUser = {
  id: string
  username: string
  email: string
  emailVerified: boolean
  createdAt: string
}

export type AuthResult = { user: AuthUser; token: string; expiresAt: string }
export type ProjectSnapshot = {
  id: string
  name: string
  role: 'owner' | 'editor' | 'viewer'
  revision: number
  updatedAt: string
  project: any
}

const TOKEN_KEY = 'localizationhub.auth.token'
const USER_KEY = 'localizationhub.auth.user'

function token() { return window.localStorage.getItem(TOKEN_KEY) }
function headers() { const value = token(); return value ? { Accept: 'application/json', Authorization: `Bearer ${value}` } : { Accept: 'application/json' } }
async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(path, { ...init, headers: { ...headers(), ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } as HeadersInit })
  const text = await response.text()
  let body: any = null
  try { body = text ? JSON.parse(text) : null } catch { body = { message: text } }
  if (!response.ok) { const error = new Error(body?.message || body?.error || `Request failed (${response.status})`); ;(error as any).status = response.status; ;(error as any).code = body?.error; throw error }
  return body
}

export function getStoredUser(): AuthUser | null { const value = window.localStorage.getItem(USER_KEY); return value ? JSON.parse(value) : null }
export function saveAuth(result: AuthResult) { window.localStorage.setItem(TOKEN_KEY, result.token); window.localStorage.setItem(USER_KEY, JSON.stringify(result.user)) }
export function clearAuth() { window.localStorage.removeItem(TOKEN_KEY); window.localStorage.removeItem(USER_KEY) }
export function getAuthToken() { return token() }
export async function login(username: string, password: string) { const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }); saveAuth(result); return result as AuthResult }
export async function register(username: string, email: string, password: string) { const result = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) }); saveAuth(result); return result as AuthResult }
export async function restoreSession() { if (!token()) return null; try { const result = await api('/api/auth/me'); window.localStorage.setItem(USER_KEY, JSON.stringify(result.user)); return result.user as AuthUser } catch { clearAuth(); return null } }
export async function logout() { if (token()) { try { await api('/api/auth/logout', { method: 'POST' }) } finally { clearAuth() } } }
export async function listProjects() { return (await api('/api/projects')).projects as Array<Omit<ProjectSnapshot, 'project'>> }
export async function createProject(name: string) { return (await api('/api/projects', { method: 'POST', body: JSON.stringify({ name, project: { format: 'LocalizationHubProject', version: 3, sourceFileName: `${name}.json`, entries: [{ id: 'entry-1', translation: '' }], workflow: { entries: {} } } }) })).project as ProjectSnapshot }
export async function getProject(id: string) { return (await api(`/api/projects/${id}`)).project as ProjectSnapshot }
export async function saveProject(id: string, baseRevision: number, project: any) { return (await api(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify({ baseRevision, project }) })).project as ProjectSnapshot }
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
export async function addComment(id: string, entryId: string, body: string) { return (await api(`/api/projects/${id}/entries/${encodeURIComponent(entryId)}/comments`, { method: 'POST', body: JSON.stringify({ body }) })).comment }
export async function resolveComment(id: string, commentId: string, resolved: boolean) { return api(`/api/projects/${id}/comments/${commentId}`, { method: 'PATCH', body: JSON.stringify({ resolved }) }) }
export async function listActivity(id: string, entryId?: string) { return (await api(`/api/projects/${id}/activity${entryId ? `?entryId=${encodeURIComponent(entryId)}` : ''}`)).activity }
export async function restoreActivity(id: string, activityId: string, baseRevision: number) { return (await api(`/api/projects/${id}/activity/${activityId}/restore`, { method: 'POST', body: JSON.stringify({ baseRevision }) })).restore }

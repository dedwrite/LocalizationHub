export type AdminMetrics = { total_users: number; verified_users: number; unverified_users?: number; suspended_users?: number; total_projects: number; total_memberships?: number; active_sessions?: number; logical_storage?: number; logical_project_bytes?: string }
const ADMIN_TOKEN_KEY = 'localizationhub.admin.session'
function adminToken() { return window.sessionStorage.getItem(ADMIN_TOKEN_KEY) }
function headers(): HeadersInit { const token = adminToken(); return token ? { Accept: 'application/json', 'X-Admin-Session': token } : { Accept: 'application/json' } }
async function api(path: string, init: RequestInit = {}) { const response = await fetch(path, { ...init, headers: { ...headers(), ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } }); const text = await response.text(); let body: any = null; try { body = text ? JSON.parse(text) : null } catch { body = { message: text } }; if (!response.ok) { const error = new Error(body?.message || body?.error || `Request failed (${response.status})`); (error as any).code = body?.error; throw error }; return body }
export function hasAdminSession() { return Boolean(adminToken()) }
export function clearAdminSession() { window.sessionStorage.removeItem(ADMIN_TOKEN_KEY) }
export async function requestEmailCode() { return api('/api/admin/auth/email/request', { method: 'POST' }) }
export async function verifyEmailCode(code: string) { return api('/api/admin/auth/email/verify', { method: 'POST', body: JSON.stringify({ code }) }) }
export async function beginTotpEnrollment() { return api('/api/admin/auth/totp/enroll', { method: 'POST' }) }
export async function confirmTotp(code: string) { const result = await api('/api/admin/auth/totp/confirm', { method: 'POST', body: JSON.stringify({ code }) }); window.sessionStorage.setItem(ADMIN_TOKEN_KEY, result.adminToken); return result }
export async function getAdminDashboard() { return api('/api/admin') as Promise<{ metrics: AdminMetrics; user: { id: string; username: string } }> }
export async function logoutAdmin() { try { await api('/api/admin/auth/logout', { method: 'POST' }) } finally { clearAdminSession() } }

// USERS
export async function getAdminUsers(search: string = '', limit: number = 20, offset: number = 0) { return api(`/api/admin/users?search=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`) as Promise<{ users: any[]; total: number }> }
export async function getAdminUser(userId: string) { return api(`/api/admin/users/${encodeURIComponent(userId)}`) }
export async function suspendUserAdmin(userId: string) { return api(`/api/admin/users?action=suspend&userId=${encodeURIComponent(userId)}`, { method: 'POST' }) }
export async function unsuspendUserAdmin(userId: string) { return api(`/api/admin/users?action=unsuspend&userId=${encodeURIComponent(userId)}`, { method: 'POST' }) }
export async function verifyUserEmailAdmin(userId: string) { return api(`/api/admin/users?action=verify-email&userId=${encodeURIComponent(userId)}`, { method: 'POST' }) }
export async function revokeAllSessionsAdmin(userId: string) { return api(`/api/admin/users?action=revoke-sessions&userId=${encodeURIComponent(userId)}`, { method: 'POST' }) }
export async function deleteUserAdmin(userId: string, deleteOwnedProjects: boolean = false) { return api(`/api/admin/users?action=delete&userId=${encodeURIComponent(userId)}`, { method: 'POST', body: JSON.stringify({ deleteOwnedProjects }) }) }

// PROJECTS
export async function getAdminProjects(search: string = '', limit: number = 20, offset: number = 0) { return api(`/api/admin/projects?search=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`) as Promise<{ projects: any[]; total: number }> }
export async function getAdminProject(projectId: string) { return api(`/api/admin/projects/${encodeURIComponent(projectId)}`) }
export async function deleteProjectAdmin(projectId: string) { return api(`/api/admin/projects?action=delete&projectId=${encodeURIComponent(projectId)}`, { method: 'POST' }) }
export async function removeProjectMemberAdmin(projectId: string, userId: string) { return api(`/api/admin/projects?action=remove-member&projectId=${encodeURIComponent(projectId)}`, { method: 'POST', body: JSON.stringify({ userId }) }) }
export async function changeProjectRoleAdmin(projectId: string, userId: string, role: string) { return api(`/api/admin/projects?action=change-member-role&projectId=${encodeURIComponent(projectId)}`, { method: 'POST', body: JSON.stringify({ userId, role }) }) }
export async function transferOwnershipAdmin(projectId: string, newOwnerId: string) { return api(`/api/admin/projects?action=transfer-ownership&projectId=${encodeURIComponent(projectId)}`, { method: 'POST', body: JSON.stringify({ newOwnerId }) }) }

// AUDIT
export async function getAuditLog(limit: number = 50, offset: number = 0, action?: string) { const url = `/api/admin/audit?limit=${limit}&offset=${offset}${action ? `&action=${encodeURIComponent(action)}` : ''}`; return api(url) as Promise<{ logs: any[]; total: number }> }

// STORAGE
export async function getStorageMetrics(userId?: string) { const url = userId ? `/api/admin/storage?userId=${encodeURIComponent(userId)}` : '/api/admin/storage'; return api(url) }

// SESSIONS
export async function getUserSessions(userId: string) { return api(`/api/admin/sessions?userId=${encodeURIComponent(userId)}`) }
export async function revokeSessionAdmin(tokenHash: string) { return api(`/api/admin/sessions?action=revoke&tokenHash=${encodeURIComponent(tokenHash)}`, { method: 'POST' }) }

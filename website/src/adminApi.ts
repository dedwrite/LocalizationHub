import { getAuthToken } from './appApi'

export type AdminMetrics = {
  total_users: number
  verified_users: number
  unverified_users: number
  suspended_users: number
  total_projects: number
  total_memberships: number
  active_sessions: number
  logical_storage: number
}

export type AdminUser = {
  id: string
  username: string
  email: string
  site_role: string
  email_verified_at: string | null
  suspended_at: string | null
  created_at: string
  session_count: number
  owned_projects?: number
  shared_projects?: number
  logical_storage?: number
}

export type AdminProjectMember = { id: string; username: string; role: string }

export type AdminProject = {
  id: string
  name: string
  owner_id?: string
  owner_username: string
  created_at: string
  updated_at: string
  member_count: number
  entry_count: number
  logical_size: number
  members?: AdminProjectMember[]
}

export type AdminSession = { token_hash: string; expires_at: string; created_at: string }

export type AdminAuditLog = {
  id: string
  admin_user_id: string
  admin_username: string | null
  action: string
  target_type: string | null
  target_id: string | null
  success: boolean
  metadata: Record<string, unknown> | null
  created_at: string
}

export type AdminDashboard = {
  user: { id: string; username: string }
  metrics: AdminMetrics
  recentActivity: AdminAuditLog[]
}

const ADMIN_TOKEN_KEY = 'localizationhub.admin.session'

function adminToken() {
  return typeof window !== 'undefined' ? window.sessionStorage.getItem(ADMIN_TOKEN_KEY) : null
}

// Every /api/admin/* request must carry BOTH layers when available:
//  - Authorization: Bearer <normal LocalizationHub session token> (required)
//  - X-Admin-Session: <separate elevated admin session token> (after elevation)
function headers(): HeadersInit {
  const result: Record<string, string> = { Accept: 'application/json' }
  const auth = getAuthToken()
  if (auth) result.Authorization = `Bearer ${auth}`
  const admin = adminToken()
  if (admin) result['X-Admin-Session'] = admin
  return result
}

// Whether the browser holds a normal LocalizationHub session token.
export function hasNormalSession() {
  return Boolean(getAuthToken())
}

async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...headers(),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  const text = await response.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { message: text }
  }
  if (!response.ok) {
    const payload = body as { message?: string; error?: string } | null
    const error = new Error(payload?.message || payload?.error || `Request failed (${response.status})`) as Error & {
      code?: string
      status?: number
    }
    error.code = payload?.error
    error.status = response.status
    throw error
  }
  return body as T
}

// ---- Auth / security ----
export function hasAdminSession() {
  return Boolean(adminToken())
}
export function clearAdminSession() {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(ADMIN_TOKEN_KEY)
}
export async function requestEmailCode() {
  return api('/api/admin/auth/email/request', { method: 'POST' })
}
export async function verifyEmailCode(code: string) {
  return api('/api/admin/auth/email/verify', { method: 'POST', body: JSON.stringify({ code }) })
}
export async function beginTotpEnrollment() {
  return api<{ secret: string; uri: string }>('/api/admin/auth/totp/enroll', { method: 'POST' })
}
export async function confirmTotp(code: string) {
  const result = await api<{ ok: boolean; adminToken: string }>('/api/admin/auth/totp/confirm', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
  window.sessionStorage.setItem(ADMIN_TOKEN_KEY, result.adminToken)
  return result
}
export async function reconfirmTotp(code: string) {
  return api('/api/admin/auth/totp/reconfirm', { method: 'POST', body: JSON.stringify({ code }) })
}
export async function logoutAdmin() {
  try {
    await api('/api/admin/auth/logout', { method: 'POST' })
  } finally {
    clearAdminSession()
  }
}

// ---- Dashboard ----
export async function getAdminDashboard() {
  return api<AdminDashboard>('/api/admin')
}

// ---- Users ----
export async function getAdminUsers(search = '', limit = 20, offset = 0) {
  return api<{ users: AdminUser[]; total: number }>(
    `/api/admin/users?search=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`,
  )
}
export async function getAdminUser(userId: string) {
  return api<AdminUser>(`/api/admin/users/${encodeURIComponent(userId)}`)
}
export async function suspendUserAdmin(userId: string) {
  return api(`/api/admin/users?action=suspend&userId=${encodeURIComponent(userId)}`, { method: 'POST' })
}
export async function unsuspendUserAdmin(userId: string) {
  return api(`/api/admin/users?action=unsuspend&userId=${encodeURIComponent(userId)}`, { method: 'POST' })
}
export async function verifyUserEmailAdmin(userId: string) {
  return api(`/api/admin/users?action=verify-email&userId=${encodeURIComponent(userId)}`, { method: 'POST' })
}
export async function unverifyUserEmailAdmin(userId: string) {
  return api(`/api/admin/users?action=unverify-email&userId=${encodeURIComponent(userId)}`, { method: 'POST' })
}
export async function revokeAllSessionsAdmin(userId: string) {
  return api(`/api/admin/users?action=revoke-sessions&userId=${encodeURIComponent(userId)}`, { method: 'POST' })
}
export async function removeUserProjectMembershipAdmin(projectId: string, userId: string) {
  return api(`/api/admin/projects?action=remove-member&projectId=${encodeURIComponent(projectId)}`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
}
export async function deleteUserAdmin(userId: string, deleteOwnedProjects = false) {
  return api(`/api/admin/users?action=delete&userId=${encodeURIComponent(userId)}`, {
    method: 'POST',
    body: JSON.stringify({ deleteOwnedProjects }),
  })
}

// ---- Projects ----
export async function getAdminProjects(search = '', limit = 20, offset = 0) {
  return api<{ projects: AdminProject[]; total: number }>(
    `/api/admin/projects?search=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`,
  )
}
export async function getAdminProject(projectId: string) {
  return api<AdminProject>(`/api/admin/projects/${encodeURIComponent(projectId)}`)
}
export async function deleteProjectAdmin(projectId: string) {
  return api(`/api/admin/projects?action=delete&projectId=${encodeURIComponent(projectId)}`, { method: 'POST' })
}
export async function removeProjectMemberAdmin(projectId: string, userId: string) {
  return api(`/api/admin/projects?action=remove-member&projectId=${encodeURIComponent(projectId)}`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
}
export async function changeProjectRoleAdmin(projectId: string, userId: string, role: string) {
  return api(`/api/admin/projects?action=change-member-role&projectId=${encodeURIComponent(projectId)}`, {
    method: 'POST',
    body: JSON.stringify({ userId, role }),
  })
}
export async function transferOwnershipAdmin(projectId: string, newOwnerId: string) {
  return api(`/api/admin/projects?action=transfer-ownership&projectId=${encodeURIComponent(projectId)}`, {
    method: 'POST',
    body: JSON.stringify({ newOwnerId }),
  })
}

// ---- Sessions ----
export async function getUserSessions(userId: string) {
  return api<{ sessions: AdminSession[] }>(`/api/admin/sessions?userId=${encodeURIComponent(userId)}`)
}
export async function revokeSessionAdmin(tokenHash: string) {
  return api(`/api/admin/sessions?action=revoke&tokenHash=${encodeURIComponent(tokenHash)}`, { method: 'POST' })
}

// ---- Audit ----
export async function getAuditLog(limit = 50, offset = 0, action?: string) {
  const url = `/api/admin/audit?limit=${limit}&offset=${offset}${action ? `&action=${encodeURIComponent(action)}` : ''}`
  return api<{ logs: AdminAuditLog[]; total: number }>(url)
}

// ---- Storage ----
export async function getStorageMetrics(userId?: string) {
  const url = userId ? `/api/admin/storage?userId=${encodeURIComponent(userId)}` : '/api/admin/storage'
  return api<{ owned_storage?: number; owned_projects?: { projectId: string; projectName: string; bytes: number }[]; platform?: AdminMetrics }>(url)
}

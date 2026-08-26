export type AdminMetrics = { total_users: number; verified_users: number; total_projects: number; logical_project_bytes: string }
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

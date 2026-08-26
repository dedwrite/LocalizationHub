export type WebRole = 'owner' | 'editor' | 'viewer'
export type RevisionState = { revision: number; conflict: boolean }

export function canEdit(role: WebRole) { return role === 'owner' || role === 'editor' }
export function setEntryTranslation(project: any, entryIndex: number, translation: string) { const next = structuredClone(project); next.entries[entryIndex].translation = translation; return next }
export function setEntryStatus(project: any, entryId: string, status: string) { const next = structuredClone(project); next.workflow ??= { entries: {} }; next.workflow.entries ??= {}; next.workflow.entries[entryId] = { status }; return next }
export function markRevisionConflict(state: RevisionState) { return { ...state, conflict: true } }
export function filterEntries(entries: any[], query: string, workflow: Record<string, any> = {}) { const text = query.trim().toLowerCase(); return entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => { const status = workflow[entry.id]?.status ?? (entry.translation ? 'translated' : 'draft'); const parts = text.split(/\s+/u).filter(Boolean); return parts.every(part => { const [key, value] = part.split(':', 2); if (key === 'status') return status === value; if (key === 'untranslated') return !entry.translation; if (key === 'translated') return Boolean(entry.translation); return `${entry.id} ${entry.key ?? ''} ${entry.source ?? ''} ${entry.translation ?? ''}`.toLowerCase().includes(part) }) }) }

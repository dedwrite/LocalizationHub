export type WebRole = 'owner' | 'editor' | 'viewer'
export type RevisionState = { revision: number; conflict: boolean }

export function canEdit(role: WebRole) { return role === 'owner' || role === 'editor' }
export function setEntryTranslation(project: any, entryIndex: number, translation: string) { const next = structuredClone(project); next.entries[entryIndex].translation = translation; return next }
export function setEntryStatus(project: any, entryId: string, status: string) { const next = structuredClone(project); next.workflow ??= { entries: {} }; next.workflow.entries ??= {}; next.workflow.entries[entryId] = { status }; return next }
export function markRevisionConflict(state: RevisionState) { return { ...state, conflict: true } }

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getProject, saveProject, listAssignments, listCommentCounts, listMembers } from '../appApi'
import { canEdit } from '../appLogic'
import { buildEntryCollection, entryIssues, type BulkSelection } from './entryCollection'
import { validateProjectV3 } from './projectValidation'
import EntriesPanel from './EntriesPanel'
import EditorPanel from './EditorPanel'
import Inspector from './Inspector'
import ProjectOverview from './ProjectOverview'
import SearchReplace from './SearchReplace'
import ConfirmDialog from './ConfirmDialog'
import BrowserCollaboration from '../BrowserCollaboration'
import { navigate } from '../navigation'
import type { ProjectSnapshot } from '../appApi'

type SaveState = 'saved' | 'unsaved' | 'saving' | 'failed'
type LayoutState = { entriesWidth: number; inspectorWidth: number; entriesCollapsed: boolean; inspectorCollapsed: boolean }
type DraftUpdater = any | ((current: any) => any)

const STATUSES = ['draft', 'translated', 'needs-review', 'approved'] as const

function loadLayout(): LayoutState {
  try {
    const raw = localStorage.getItem('localizationhub.web.layout')
    if (raw) return JSON.parse(raw) as LayoutState
  } catch {
    // Ignore.
  }
  return { entriesWidth: 300, inspectorWidth: 340, entriesCollapsed: false, inspectorCollapsed: false }
}

function saveLayout(layout: LayoutState) {
  try {
    localStorage.setItem('localizationhub.web.layout', JSON.stringify(layout))
  } catch {
    // Ignore.
  }
}

export default function Workspace({ user, onHome }: { user: { id: string; username: string }; onHome: () => void }) {
  const projectId = window.location.pathname.split('/').pop()!
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null)
  const [draft, setDraft] = useState<any>(null)
  const [selected, setSelected] = useState(0)
  const [filter, setFilter] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [selection, setSelection] = useState<BulkSelection>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [members, setMembers] = useState<any[]>([])
  const [assignments, setAssignments] = useState<Record<string, string | null>>({})
  const [commentEntryIds, setCommentEntryIds] = useState<Set<string>>(new Set())
  const [layout, setLayout] = useState(loadLayout)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [collabOpen, setCollabOpen] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const pendingSaveRef = useRef(false)
  const editVersionRef = useRef(0)
  const draftRef = useRef<any>(null)
  const snapshotRef = useRef<ProjectSnapshot | null>(null)
  const autosaveTimer = useRef<any>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const tokenProfileId = draft?.tokenProfile ?? 'generic'

  useEffect(() => {
    getProject(projectId)
      .then((result) => {
        const project = structuredClone(result.project)
        snapshotRef.current = result
        draftRef.current = project
        setSnapshot(result)
        setDraft(project)
        if (result.migratedFromVersion) {
          setNotice(`Legacy Project V${result.migratedFromVersion} loaded. It will be upgraded to Project V3 when next saved.`)
        }
      })
      .catch((failure) => setError(failure instanceof Error ? failure.message : 'Could not load project.'))
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => {
    if (!snapshot) return
    listMembers(projectId).then(setMembers).catch(() => undefined)
    listAssignments(projectId).then((result) => {
      const map: Record<string, string | null> = {}
      for (const item of result) map[item.entryId] = item.assigneeUserId
      setAssignments(map)
    }).catch(() => undefined)
    listCommentCounts(projectId).then((result) => {
      setCommentEntryIds(new Set(result.filter((item) => item.count > 0).map((item) => item.entryId)))
    }).catch(() => undefined)
  }, [projectId, snapshot?.revision])

  const entries = draft?.entries ?? []
  const writable = snapshot ? canEdit(snapshot.role) : false

  const taggedEntryIds = useMemo(() => {
    const set = new Set<string>()
    const entryTags = draft?.metadata?.entryTags ?? {}
    for (const entryId of Object.keys(entryTags)) {
      if ((entryTags[entryId] ?? []).length > 0) set.add(entryId)
    }
    return set
  }, [draft])

  const collection = useMemo(
    () => buildEntryCollection({
      entries, workflow: draft?.workflow?.entries ?? {}, filter: filter as any, query, tokenProfileId, commentEntryIds, taggedEntryIds, currentUserId: user.id, assignments,
    }),
    [entries, draft?.workflow, filter, query, tokenProfileId, commentEntryIds, taggedEntryIds, user.id, assignments],
  )

  const entry = entries[selected]
  const status = draft?.workflow?.entries?.[entry?.id]?.status ?? (entry?.translation ? 'translated' : 'draft')
  const issues = entry ? entryIssues(entry, tokenProfileId) : []
  const direction = draft?.document?.language?.translationDirection ?? 'auto'
  const sourceLocale = draft?.document?.language?.sourceLocale
  const targetLocale = draft?.document?.language?.translationLocale

  /*
   * Centralized mutation entry point.
   *
   * Accepts either a concrete project object OR a functional updater, resolves
   * it immediately against the latest draft (never a stale closure), and marks
   * the project dirty. The autosave path always captures the RESOLVED object —
   * never an updater function — so the backend never receives a malformed
   * payload.
   */
  function updateDraft(updater: DraftUpdater) {
    if (!writable) return
    const current = draftRef.current
    if (!current) return
    const next = typeof updater === 'function' ? updater(current) : updater
    if (!next || next === current) return
    if (typeof next === 'function') {
      setNotice('Internal error: project update produced an invalid value.')
      return
    }
    const validation = validateProjectV3(next)
    if (!validation.ok) {
      setNotice(validation.reason)
      return
    }
    draftRef.current = next
    setDraft(next)
    dirtyRef.current = true
    editVersionRef.current += 1
    setSaveState('unsaved')
    scheduleAutosave()
  }

  function scheduleAutosave() {
    if (!writable || !snapshotRef.current) return
    window.clearTimeout(autosaveTimer.current)
    autosaveTimer.current = window.setTimeout(flushSave, 1500)
  }

  /*
   * Single-flight Cloud save using the latest draft and latest revision.
   * Never loses edits made while a save is in flight; after a save succeeds,
   * newer edits save against the incremented revision.
   */
  async function flushSave() {
    if (!writable || !snapshotRef.current || !dirtyRef.current) return
    if (savingRef.current) {
      pendingSaveRef.current = true
      return
    }

    savingRef.current = true
    setSaveState('saving')

    const toSave = structuredClone(draftRef.current)
    const baseRevision = snapshotRef.current.revision
    const versionAtSave = editVersionRef.current

    const validation = validateProjectV3(toSave)
    if (!validation.ok) {
      savingRef.current = false
      setSaveState('failed')
      setNotice(validation.reason)
      return
    }

    try {
      const saved = await saveProject(projectId, baseRevision, toSave)
      snapshotRef.current = saved
      setSnapshot(saved)
      if (editVersionRef.current === versionAtSave) {
        // No newer local edits arrived during the save — adopt server state.
        draftRef.current = structuredClone(saved.project)
        setDraft(draftRef.current)
        dirtyRef.current = false
        setSaveState('saved')
      } else {
        // Newer edits arrived; keep them dirty against the new revision.
        setSaveState('unsaved')
      }
    } catch (failure) {
      setSaveState('failed')
      setNotice((failure as any)?.code === 'revision-conflict' ? 'This project changed elsewhere. Reload before saving.' : failure instanceof Error ? failure.message : 'Save failed.')
    } finally {
      savingRef.current = false
      if (dirtyRef.current && pendingSaveRef.current) {
        pendingSaveRef.current = false
        scheduleAutosave()
      }
    }
  }

  /*
   * Adopt server-authoritative state after an operation that already persisted
   * on the server (e.g. activity restore). Does NOT mark dirty or autosave.
   */
  function applyServerState(nextSnapshot: ProjectSnapshot, project: any) {
    snapshotRef.current = nextSnapshot
    draftRef.current = structuredClone(project)
    setSnapshot(nextSnapshot)
    setDraft(draftRef.current)
    dirtyRef.current = false
    editVersionRef.current += 1
    setSaveState('saved')
  }

  function saveNow() {
    if (!writable || !snapshotRef.current || !dirtyRef.current) return
    window.clearTimeout(autosaveTimer.current)
    void flushSave()
  }

  function updateTranslation(value: string) {
    updateDraft((current: any) => {
      const next = structuredClone(current)
      next.entries[selected].translation = value
      return next
    })
  }

  function updateStatus(nextStatus: string) {
    updateDraft((current: any) => {
      const next = structuredClone(current)
      next.workflow ??= { entries: {} }
      next.workflow.entries ??= {}
      next.workflow.entries[entry.id] = { status: nextStatus }
      return next
    })
  }

  function goto(index: number) {
    const clamped = Math.max(0, Math.min(entries.length - 1, index))
    setSelected(clamped)
    setQuery('')
  }

  const nextUntranslated = useCallback((dir: 1 | -1) => {
    for (let offset = 1; offset < entries.length; offset++) {
      const index = selected + dir * offset
      if (index < 0 || index >= entries.length) break
      if (!entries[index]?.translation) { setSelected(index); return }
    }
  }, [selected, entries])

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const typing = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'SELECT'
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveNow()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        if (writable) { saveNow(); nextUntranslated(1) }
        return
      }
      if (event.altKey && event.key === 'ArrowDown') { event.preventDefault(); goto(selected + 1); return }
      if (event.altKey && event.key === 'ArrowUp') { event.preventDefault(); goto(selected - 1); return }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && !typing) {
        event.preventDefault()
        searchRef.current?.focus()
        return
      }
      if (event.key === 'Escape') {
        setOverviewOpen(false); setReplaceOpen(false); setBulkOpen(false); setCollabOpen(false); setConfirmLeave(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveNow, writable, selected, entries, nextUntranslated])

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (dirtyRef.current) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [])

  function goHome() {
    if (dirtyRef.current) { setConfirmLeave(true); return }
    onHome()
  }

  function toggleSelection(index: number) {
    setSelection((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function applyBulk(status: string | null) {
    updateDraft((current: any) => {
      const next = structuredClone(current)
      for (const index of selection) {
        const target = current.entries[index]
        if (status) {
          next.workflow ??= { entries: {} }
          next.workflow.entries ??= {}
          next.workflow.entries[target.id] = { status }
        }
      }
      return next
    })
    setSelection(new Set())
    setBulkOpen(false)
  }

  function applyReplace(updates: Array<{ index: number; translation: string }>) {
    updateDraft((current: any) => {
      const next = structuredClone(current)
      for (const update of updates) next.entries[update.index].translation = update.translation
      return next
    })
  }

  if (loading) return <main className="workspace-page"><div className="empty-state">Loading project…</div></main>
  if (error || !snapshot || !draft) return <main className="workspace-page"><div className="notice danger">{error || 'Project unavailable.'}</div><button className="primary-button" onClick={() => navigate('/app/projects')}>Back to projects</button></main>

  const assigneeOf = (entryId: string) => {
    const userId = assignments[entryId]
    return userId ? members.find((m) => m.id === userId)?.username ?? null : null
  }

  const focusMode = layout.entriesCollapsed && layout.inspectorCollapsed

  return (
    <main className="workspace-page workspace-shell">
      <Toolbar
        projectName={snapshot.name}
        role={snapshot.role}
        saveState={saveState}
        tokenProfileId={tokenProfileId}
        tokenProfiles={['generic', 'godot']}
        onTokenProfile={(value) => updateDraft((current: any) => ({ ...current, tokenProfile: value }))}
        onHome={goHome}
        onSave={saveNow}
        onOverview={() => setOverviewOpen(true)}
        onSearchReplace={() => setReplaceOpen(true)}
        onCollaboration={() => setCollabOpen(true)}
        onToggleEntries={() => setLayout((l) => { const next = { ...l, entriesCollapsed: !l.entriesCollapsed }; saveLayout(next); return next })}
        onToggleInspector={() => setLayout((l) => { const next = { ...l, inspectorCollapsed: !l.inspectorCollapsed }; saveLayout(next); return next })}
        focusMode={focusMode}
        onToggleFocus={() => setLayout((l) => { const next = focusMode ? { ...l, entriesCollapsed: false, inspectorCollapsed: false } : { ...l, entriesCollapsed: true, inspectorCollapsed: true }; saveLayout(next); return next })}
      />

      <div className="workspace-body">
        {!layout.entriesCollapsed && (
          <>
            <div className="pane entries-pane" style={{ width: layout.entriesWidth }}>
              <EntriesPanel
                views={collection.views}
                counts={collection.counts}
                filter={filter as any}
                onFilter={setFilter}
                query={query}
                onQuery={setQuery}
                selected={selected}
                onSelect={setSelected}
                selection={selection}
                onToggleSelection={toggleSelection}
                onClearSelection={() => setSelection(new Set())}
                commentEntryIds={commentEntryIds}
                assigneeOf={assigneeOf}
                onOpenBulk={() => setBulkOpen(true)}
                onJumpTo={() => { searchRef.current?.focus() }}
              />
            </div>
            <ResizeHandle onDrag={(dx) => setLayout((l) => { const next = { ...l, entriesWidth: Math.max(200, Math.min(520, l.entriesWidth + dx)) }; saveLayout(next); return next })} />
          </>
        )}

        <div className="pane editor-pane">
          <EditorPanel
            entry={entry}
            status={status}
            writable={writable}
            tokenProfileId={tokenProfileId}
            issues={issues}
            direction={direction}
            position={selected}
            total={entries.length}
            onTranslationChange={updateTranslation}
            onStatusChange={updateStatus}
            onNextUntranslated={() => nextUntranslated(1)}
            onPrevUntranslated={() => nextUntranslated(-1)}
            onJumpTo={goto}
            sourceLocale={sourceLocale}
            targetLocale={targetLocale}
          />
        </div>

        {!layout.inspectorCollapsed && (
          <>
            <ResizeHandle onDrag={(dx) => setLayout((l) => { const next = { ...l, inspectorWidth: Math.max(280, Math.min(560, l.inspectorWidth - dx)) }; saveLayout(next); return next })} />
            <div className="pane inspector-pane" style={{ width: layout.inspectorWidth }}>
              <Inspector
                projectId={projectId}
                entry={entry}
                snapshot={snapshot}
                draft={draft}
                writable={writable}
                currentUserId={user.id}
                members={members}
                setDraft={updateDraft}
                onRestored={applyServerState}
                onNotice={setNotice}
              />
            </div>
          </>
        )}
      </div>

      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}

      {overviewOpen && (
        <div className="overlay">
          <ProjectOverview snapshot={snapshot} draft={draft} memberCount={members.length} tokenProfileId={tokenProfileId} role={snapshot.role} onClose={() => setOverviewOpen(false)} />
        </div>
      )}

      {collabOpen && (
        <div className="overlay">
          <div className="dialog dialog-wide">
            <h2 className="dialog-title">Live collaboration</h2>
            <BrowserCollaboration projectId={projectId} writable={writable} />
            <div className="dialog-actions"><button className="dialog-button" onClick={() => setCollabOpen(false)}>Close</button></div>
          </div>
        </div>
      )}

      {replaceOpen && (
        <SearchReplace entries={entries} writable={writable} onApply={applyReplace} onClose={() => setReplaceOpen(false)} />
      )}

      {bulkOpen && (
        <div className="dialog-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setBulkOpen(false) }}>
          <div className="dialog" role="dialog" aria-modal="true" aria-label="Bulk actions">
            <h2 className="dialog-title">Bulk actions</h2>
            <p className="dialog-body">{selection.size} selected</p>
            <div className="bulk-options">
              {STATUSES.map((item) => <button key={item} className="dialog-button" onClick={() => applyBulk(item)}>Set {item.replace('-', ' ')}</button>)}
            </div>
            <div className="dialog-actions"><button className="dialog-button" onClick={() => setBulkOpen(false)}>Close</button></div>
          </div>
        </div>
      )}

      {confirmLeave && (
        <ConfirmDialog
          title="Unsaved changes"
          body="You have unsaved changes. Leave without saving?"
          confirmLabel="Leave"
          danger
          onConfirm={() => { setConfirmLeave(false); onHome() }}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </main>
  )
}

function ResizeHandle({ onDrag }: { onDrag: (dx: number) => void }) {
  const startRef = useRef<number | null>(null)
  return (
    <div
      className="resize-handle"
      role="separator"
      aria-orientation="vertical"
      onPointerDown={(event) => { startRef.current = event.clientX; (event.target as HTMLElement).setPointerCapture(event.pointerId) }}
      onPointerMove={(event) => { if (startRef.current != null) { onDrag(event.clientX - startRef.current); startRef.current = event.clientX } }}
      onPointerUp={() => { startRef.current = null }}
    />
  )
}

function Toolbar(props: {
  projectName: string
  role: string
  saveState: SaveState
  tokenProfileId: string
  tokenProfiles: string[]
  onTokenProfile: (value: string) => void
  onHome: () => void
  onSave: () => void
  onOverview: () => void
  onSearchReplace: () => void
  onCollaboration: () => void
  onToggleEntries: () => void
  onToggleInspector: () => void
  focusMode: boolean
  onToggleFocus: () => void
}) {
  const saveLabel = props.saveState === 'saving' ? 'Saving…' : props.saveState === 'failed' ? 'Save failed' : props.saveState === 'unsaved' ? 'Unsaved' : 'Saved'
  return (
    <header className="workspace-toolbar">
      <button className="toolbar-brand" onClick={props.onHome} title="Back to projects">LH</button>
      <div className="toolbar-title">
        <strong>{props.projectName}</strong>
        <span className={`save-state save-${props.saveState}`}>{saveLabel}</span>
      </div>
      <div className="toolbar-group">
        <label className="toolbar-select">
          <span>Token profile</span>
          <select value={props.tokenProfileId} onChange={(event) => props.onTokenProfile(event.target.value)}>
            {props.tokenProfiles.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <button className="toolbar-button" onClick={props.onCollaboration}>Collaboration</button>
        <button className="toolbar-button" onClick={props.onSearchReplace}>Search &amp; Replace</button>
        <button className="toolbar-button" onClick={props.onOverview}>Overview</button>
      </div>
      <div className="toolbar-group">
        <button className="toolbar-button" onClick={props.onToggleEntries}>Entries</button>
        <button className="toolbar-button" onClick={props.onToggleInspector}>Inspector</button>
        <button className="toolbar-button" onClick={props.onToggleFocus} title="Toggle focus mode">{props.focusMode ? 'Exit Focus' : 'Focus'}</button>
        <button className="toolbar-button toolbar-save" onClick={props.onSave}>Save</button>
      </div>
    </header>
  )
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { deleteProject, listAssignments, listCommentCounts, listMembers } from '../appApi'
import ProjectDeleteDialog from '../../../frontend/src/ProjectDeleteDialog'
import { createTokenProfileConfig, displayTokenProfile, TOKEN_PROFILE_LABELS, updateTokenProfileConfig, type TokenProfileConfig, type TokenProfileId } from '@localizationhub/core'
import { canEdit } from '../appLogic'
import { buildEntryCollection, entryIssues, type BulkSelection, type EntryFilterId } from './entryCollection'
import { validateProjectV3 } from './projectValidation'
import EntriesPanel from './EntriesPanel'
import EditorPanel from './EditorPanel'
import Inspector from './Inspector'
import ProjectOverview from './ProjectOverview'
import SearchReplace from './SearchReplace'
import ConfirmDialog from './ConfirmDialog'
import BrowserCollaboration from '../BrowserCollaboration'
import MobileWorkspace from './MobileWorkspace'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { navigate, setNavigationGuard } from '../navigation'
import { cloudWorkspaceStorage, type WorkspaceStorage } from './storage'
import { exportLocalProject } from '../localProjects'
import TokenProfileStatus from './TokenProfileStatus'
import type { ProjectSnapshot } from '../appApi'
import { rememberCloudProject, coverage } from '../delight/recents'
import PageSkeleton from '../delight/PageSkeleton'
import CompletionMoment from '../delight/CompletionMoment'
import BehaviorSecretBanner from '../delight/BehaviorSecretBanner'
import { registerQuietCommands, registerQuietDynamicProvider } from '../delight/quietCommands'
import { entryJumpCommands } from '../delight/entryJump'
import { buildExportChecklist } from '../delight/exportChecklist'
import ExportChecklistDialog from '../delight/ExportChecklistDialog'
import SessionPulse from '../delight/SessionPulse'
import { loadProgressPulse, recordProgressPulse, type ProgressPulseState } from '../delight/pulseState'
import { metadata } from '../appApi'
import { openCommandCenter, WORKSPACE_COMMAND_EVENT } from '../delight/commandEvents'
import { useI18n } from '@localizationhub/i18n'
import './workspace.css'
import './workspace.mobile.css'

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

export default function Workspace({ user, onHome, storage: suppliedStorage }: { user: { id: string; username: string }; onHome: () => void; storage?: WorkspaceStorage }) {
  const { t } = useI18n()
  const routeProjectId = window.location.pathname.split('/').pop()!
  const storage = useMemo(() => suppliedStorage ?? cloudWorkspaceStorage(routeProjectId), [suppliedStorage, routeProjectId])
  const projectId = storage.id
  const local = storage.kind === 'local'
  const isMobile = useMediaQuery('(max-width: 767px)')
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
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [collabOpen, setCollabOpen] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [exportChecklistOpen, setExportChecklistOpen] = useState(false)
  const [settleIn, setSettleIn] = useState(false)
  const [recentlySaved, setRecentlySaved] = useState(false)
  const [pulse, setPulse] = useState<ProgressPulseState>(() => loadProgressPulse())
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const pendingSaveRef = useRef(false)
  const editVersionRef = useRef(0)
  const draftRef = useRef<any>(null)
  const snapshotRef = useRef<ProjectSnapshot | null>(null)
  const autosaveTimer = useRef<any>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const leaveAction = useRef<(() => void) | null>(null)
  const selectedRef = useRef(selected)
  useLayoutEffect(() => { selectedRef.current = selected }, [selected])

  const tokenProfileConfig: TokenProfileConfig = draft?.tokenProfileConfig ?? createTokenProfileConfig(draft?.tokenProfile ?? 'generic', draft?.engineDetection)
  const tokenProfileId = tokenProfileConfig.resolvedProfile
  const tokenProfileSelection: TokenProfileId = tokenProfileConfig.mode === 'auto' ? 'auto' : tokenProfileConfig.selectedProfile ?? tokenProfileId

  useEffect(() => {
    let active = true
    storage.load()
      .then((result) => {
        if (!active) return
        const project = structuredClone(result.project)
        snapshotRef.current = result
        draftRef.current = project
        setSnapshot(result)
        setDraft(project)
        if (!local) rememberCloudProject(user.id, result.id)
        if (local && !storage.persisted) { dirtyRef.current = true; setSaveState('unsaved') }
        setSelected(Math.max(0, project.entries.findIndex((item: any) => item.id === project.selectedEntryId)))
        if (result.migratedFromVersion) {
          setNotice(`Legacy Project V${result.migratedFromVersion} loaded. It will be upgraded to Project V3 when next saved.`)
        }
      })
      .catch((failure) => setError(failure instanceof Error ? failure.message : 'Could not load project.'))
      .finally(() => {
        if (!active) return
        setLoading(false)
        setSettleIn(true)
        window.setTimeout(() => { if (active) setSettleIn(false) }, 280)
      })
    return () => { active = false; window.clearTimeout(autosaveTimer.current) }
  }, [storage])

  useEffect(() => {
    if (!snapshot || local) return
    listMembers(projectId).then(setMembers).catch(() => undefined)
    listAssignments(projectId).then((result) => {
      const map: Record<string, string | null> = {}
      for (const item of result) map[item.entryId] = item.assigneeUserId
      setAssignments(map)
    }).catch(() => undefined)
    listCommentCounts(projectId).then((result) => {
      setCommentEntryIds(new Set(result.filter((item) => item.count > 0).map((item) => item.entryId)))
    }).catch(() => undefined)
  }, [projectId, snapshot?.revision, local])

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
  const sourceDirection = draft?.document?.language?.sourceDirection ?? 'auto'
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

  function changeTokenProfile(value: TokenProfileId) {
    updateDraft((current: any) => {
      const config = updateTokenProfileConfig(current.tokenProfileConfig, value, current.engineDetection)
      return { ...current, tokenProfile: value, tokenProfileConfig: config, engineDetection: config.detection }
    })
  }

  function scheduleAutosave() {
    if (local || !writable || !snapshotRef.current) return
    window.clearTimeout(autosaveTimer.current)
    autosaveTimer.current = window.setTimeout(flushSave, 1500)
  }

  /*
   * Single-flight Cloud save using the latest draft and latest revision.
   * Never loses edits made while a save is in flight; after a save succeeds,
   * newer edits save against the incremented revision.
   */
  async function flushSave() {
    if (!writable || !snapshotRef.current || (!dirtyRef.current && !local)) return
    if (savingRef.current) {
      pendingSaveRef.current = true
      return
    }

    savingRef.current = true
    setSaveState('saving')

    const toSave = structuredClone(draftRef.current)
    if (local) toSave.selectedEntryId = toSave.entries[selectedRef.current]?.id ?? null
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
      const saved = await storage.save(toSave, baseRevision)
      snapshotRef.current = saved
      setSnapshot(saved)
      if (editVersionRef.current === versionAtSave) {
        // No newer local edits arrived during the save — adopt server state.
        draftRef.current = structuredClone(saved.project)
        setDraft(draftRef.current)
        dirtyRef.current = false
        setSaveState('saved')
        setRecentlySaved(true)
        window.setTimeout(() => setRecentlySaved(false), 2400)
        if (local) setNotice('Saved to this browser.')
      } else {
        // Newer edits arrived; keep them dirty against the new revision.
        setSaveState('unsaved')
      }
    } catch (failure) {
      setSaveState('failed')
      setNotice(local ? 'Could not save to this browser. Keep this view open and export a backup before retrying.' : (failure as any)?.code === 'revision-conflict' ? 'This project changed elsewhere. Reload before saving.' : failure instanceof Error ? failure.message : 'Save failed.')
    } finally {
      savingRef.current = false
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false
        if (local) void flushSave() // A second explicit Save, not local autosave.
        else if (dirtyRef.current) scheduleAutosave()
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
    if (!writable || !snapshotRef.current || (!dirtyRef.current && !local)) return
    window.clearTimeout(autosaveTimer.current)
    void flushSave()
  }

  function updateTranslation(value: string) {
    updateDraft((current: any) => {
      const previous = current.entries[selected]?.translation ?? ''
      if (previous === value) return current
      const becameTranslated = !String(previous).trim() && Boolean(String(value).trim())
      if (becameTranslated) setPulse(recordProgressPulse({ becameTranslated: true }))
      const nextEntries = current.entries.slice()
      nextEntries[selected] = { ...nextEntries[selected], translation: value }
      return { ...current, entries: nextEntries }
    })
  }

  function updateStatus(nextStatus: string) {
    const previous = entry ? (draft?.workflow?.entries?.[entry.id]?.status ?? (entry.translation ? 'translated' : 'untranslated')) : ''
    if (nextStatus === 'approved' && previous !== 'approved') setPulse(recordProgressPulse({ becameApproved: true }))
    updateDraft((current: any) => {
      return { ...current, workflow: { ...current.workflow, entries: { ...current.workflow?.entries, [entry.id]: { status: nextStatus } } } }
    })
  }

  function goto(index: number) {
    const clamped = Math.max(0, Math.min(entries.length - 1, index))
    selectedRef.current = clamped
    setSelected(clamped)
    setQuery('')
  }

  function performExport() {
    try {
      const project = draftRef.current
      const url = URL.createObjectURL(new Blob([exportLocalProject(project)], { type: 'text/plain;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url; link.download = project.sourceFileName; link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setExportChecklistOpen(false)
    } catch { setNotice('Export failed. Your local project was not changed.'); setExportChecklistOpen(false) }
  }

  function requestExport() {
    if (!local) return
    setExportChecklistOpen(true)
  }

  const exportChecklist = useMemo(() => {
    if (!draft) return null
    const data = metadata(draft)
    return buildExportChecklist({
      entries: draft.entries ?? [],
      workflow: draft.workflow?.entries ?? {},
      glossary: data.glossary,
      tokenProfileId,
    })
  }, [draft, tokenProfileId])

  const nextUntranslated = useCallback((dir: 1 | -1) => {
    const currentSelected = selectedRef.current
    for (let offset = 1; offset < entries.length; offset++) {
      const index = currentSelected + dir * offset
      if (index < 0 || index >= entries.length) break
      if (!entries[index]?.translation) { selectedRef.current = index; setSelected(index); return }
    }
  }, [selected, entries])

  useEffect(() => {
    if (loading || !snapshot) return
    return registerQuietCommands([
      {
        id: 'workspace.save',
        label: t('delight.command.save'),
        keywords: 'save persist',
        group: 'workspace',
        hint: 'Ctrl/⌘ S',
        run: () => { void saveNow() },
      },
      {
        id: 'workspace.search',
        label: t('delight.command.entrySearch'),
        keywords: 'find filter entries',
        group: 'workspace',
        hint: 'Ctrl/⌘ F',
        run: () => searchRef.current?.focus(),
      },
      {
        id: 'workspace.replace',
        label: t('quiet.commandReplace'),
        keywords: 'replace find',
        group: 'workspace',
        run: () => setReplaceOpen(true),
      },
      {
        id: 'workspace.overview',
        label: t('delight.command.overview'),
        keywords: 'overview review stats',
        group: 'workspace',
        run: () => setOverviewOpen(true),
      },
      ...(local ? [{
        id: 'workspace.export',
        label: t('quiet.commandExport'),
        keywords: 'export download file checklist',
        group: 'project' as const,
        run: () => requestExport(),
      }] : []),
      {
        id: 'workspace.home',
        label: t(local ? 'quiet.commandLocalHome' : 'quiet.commandCloudHome'),
        keywords: 'home projects leave',
        group: 'navigate',
        run: () => goHome(),
      },
    ])
  }, [loading, snapshot, local, projectId, t])

  useEffect(() => {
    if (loading || !draft) return
    return registerQuietDynamicProvider((query) => entryJumpCommands(draft.entries ?? [], query, goto))
  }, [loading, draft])

  // Keyboard shortcuts
  // Install the committed handler before paint: a key immediately after import
  // or navigation must not see the previous render's read-only/selection state.
  useLayoutEffect(() => {
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
          if (writable) { nextUntranslated(event.shiftKey ? -1 : 1); saveNow() }
        return
      }
        if (event.altKey && event.key === 'ArrowDown') { event.preventDefault(); goto(selectedRef.current + 1); return }
        if (event.altKey && event.key === 'ArrowUp') { event.preventDefault(); goto(selectedRef.current - 1); return }
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

  useLayoutEffect(() => {
    function onCommand(event: Event) {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action
      if (action === 'save') saveNow()
      if (action === 'next' && writable) { nextUntranslated(1); saveNow() }
      if (action === 'search') searchRef.current?.focus()
      if (action === 'overview') setOverviewOpen(true)
      if (action === 'focus' && !isMobile) {
        setLayout((current) => {
          const focused = current.entriesCollapsed && current.inspectorCollapsed
          const next = focused
            ? { ...current, entriesCollapsed: false, inspectorCollapsed: false }
            : { ...current, entriesCollapsed: true, inspectorCollapsed: true }
          saveLayout(next)
          return next
        })
      }
    }
    window.addEventListener(WORKSPACE_COMMAND_EVENT, onCommand)
    return () => window.removeEventListener(WORKSPACE_COMMAND_EVENT, onCommand)
  }, [isMobile, nextUntranslated, saveNow, writable])

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (dirtyRef.current) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [])

  useEffect(() => {
    if (!local) return
    return setNavigationGuard((resume) => {
      if (!dirtyRef.current) return true
      leaveAction.current = resume
      setConfirmLeave(true)
      return false
    })
  }, [local])

  function leaveWithoutSaving() {
    dirtyRef.current = false
    window.clearTimeout(autosaveTimer.current)
    setConfirmLeave(false)
    const action = leaveAction.current ?? onHome
    leaveAction.current = null
    action()
  }

  function goHome() {
    if (dirtyRef.current) { leaveAction.current = onHome; setConfirmLeave(true); return }
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

  if (loading) return <main className="workspace-page" aria-busy="true"><PageSkeleton kind="workspace" /></main>
  if (error || !snapshot || !draft) return <main className="workspace-page"><div className="notice danger">{error || 'Project unavailable.'}</div><button className="primary-button" onClick={() => navigate('/app/projects')}>Back to projects</button></main>

  const projectCoverage = coverage(entries.length, entries.filter((item: any) => Boolean(item?.translation?.trim())).length)

  const assigneeOf = (entryId: string) => {
    const userId = assignments[entryId]
    return userId ? members.find((m) => m.id === userId)?.username ?? null : null
  }

  const focusMode = layout.entriesCollapsed && layout.inspectorCollapsed

  const deletionDialog = !local && snapshot.role === 'owner' && deleteOpen ? <ProjectDeleteDialog name={snapshot.name}
    onDelete={() => deleteProject(projectId)}
    onDeleted={() => { dirtyRef.current = false; window.clearTimeout(autosaveTimer.current); navigate('/app/projects?deleted=1') }}
    onCancel={() => setDeleteOpen(false)} /> : null
  const glossary = metadata(draft).glossary
  const exportDialog = exportChecklistOpen && exportChecklist ? (
    <ExportChecklistDialog checklist={exportChecklist} onExport={performExport} onCancel={() => setExportChecklistOpen(false)} />
  ) : null

  if (isMobile) {
    return (
      <><SessionPulse state={pulse} /><MobileWorkspace
        onDelete={!local && snapshot.role === 'owner' ? () => setDeleteOpen(true) : undefined}
        local={local}
        onExport={requestExport}
        glossary={glossary}
        user={user}
        projectId={projectId}
        projectName={snapshot.name}
        role={snapshot.role}
        saveState={saveState}
        tokenProfileId={tokenProfileId}
        tokenProfileSelection={tokenProfileSelection}
        tokenProfileConfig={tokenProfileConfig}
        tokenProfiles={['auto', 'generic', 'godot', 'unreal', 'unity']}
        onTokenProfile={changeTokenProfile}
        goHome={goHome}
        onHome={leaveWithoutSaving}
        onSave={saveNow}
        views={collection.views}
        counts={collection.counts}
        filter={filter as EntryFilterId}
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
        entry={entry}
        status={status}
        writable={writable}
        issues={issues}
        sourceDirection={sourceDirection}
        direction={direction}
        position={selected}
        total={entries.length}
        onTranslationChange={updateTranslation}
        onStatusChange={updateStatus}
        onNextUntranslated={nextUntranslated}
        onJumpTo={goto}
        sourceLocale={sourceLocale}
        targetLocale={targetLocale}
        snapshot={snapshot}
        draft={draft}
        setDraft={updateDraft}
        onRestored={applyServerState}
        onNotice={setNotice}
        members={members}
        entries={entries}
        applyReplace={applyReplace}
        applyBulk={applyBulk}
        overviewOpen={overviewOpen}
        setOverviewOpen={setOverviewOpen}
        replaceOpen={replaceOpen}
        setReplaceOpen={setReplaceOpen}
        collabOpen={collabOpen}
        setCollabOpen={setCollabOpen}
        bulkOpen={bulkOpen}
        setBulkOpen={setBulkOpen}
        confirmLeave={confirmLeave}
        setConfirmLeave={setConfirmLeave}
        notice={notice}
        setNotice={setNotice}
        complete={projectCoverage.complete}
      />{deletionDialog}{exportDialog}</>
    )
  }

  return (
    <main className={`workspace-page workspace-shell ${focusMode ? 'focus-mode' : ''} ${settleIn ? 'is-settling' : ''}`}>
      <BehaviorSecretBanner complete={projectCoverage.complete} justSaved={recentlySaved} />
      <SessionPulse state={pulse} />
      <Toolbar
        local={local}
        onExport={requestExport}
        projectName={snapshot.name}
        role={snapshot.role}
        saveState={saveState}
        tokenProfileId={tokenProfileId}
        tokenProfileSelection={tokenProfileSelection}
        tokenProfileConfig={tokenProfileConfig}
        tokenProfiles={['auto', 'generic', 'godot', 'unreal', 'unity']}
        onTokenProfile={changeTokenProfile}
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

      <CompletionMoment projectId={projectId} complete={projectCoverage.complete} onReview={() => setOverviewOpen(true)} />

      <div className="workspace-body">
        {!layout.entriesCollapsed && (
          <>
            <div className="pane entries-pane" style={{ width: layout.entriesWidth }}>
              <EntriesPanel
                local={local}
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
            local={local}
            onNext={() => goto(selected + 1)}
            onPrev={() => goto(selected - 1)}
            entry={entry}
            extractionContext={draft?.metadata?.extraction?.entries?.[entry?.id]?.context}
            sampleGuide={local && projectId.startsWith('sample:northern-gate:')}
            status={status}
            writable={writable}
            tokenProfileId={tokenProfileId}
            issues={issues}
            glossary={glossary}
            sourceDirection={sourceDirection}
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
                local={local}
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
          <ProjectOverview local={local} onDelete={() => setDeleteOpen(true)} snapshot={snapshot} draft={draft} memberCount={members.length} tokenProfileId={tokenProfileId} tokenProfileConfig={tokenProfileConfig} role={snapshot.role} onClose={() => setOverviewOpen(false)} />
        </div>
      )}

      {!local && collabOpen && (
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

      {exportDialog}

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

      {deletionDialog}
      {confirmLeave && (
        <ConfirmDialog
          title="Unsaved changes"
          body="You have unsaved changes. Leave without saving?"
          confirmLabel="Leave"
          danger
          onConfirm={leaveWithoutSaving}
          onCancel={() => { leaveAction.current = null; setConfirmLeave(false) }}
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
  local?: boolean
  onExport: () => void
  projectName: string
  role: string
  saveState: SaveState
  tokenProfileId: string
  tokenProfileSelection: TokenProfileId
  tokenProfileConfig: TokenProfileConfig
  tokenProfiles: TokenProfileId[]
  onTokenProfile: (value: TokenProfileId) => void
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
  const { t } = useI18n()
  const saveLabel = props.saveState === 'saving' ? 'Saving…' : props.saveState === 'failed' ? 'Save failed' : props.saveState === 'unsaved' ? 'Unsaved' : 'Saved'
  return (
    <header className="workspace-toolbar">
      <button className="toolbar-brand" onClick={props.onHome} title={props.local ? 'Back to local files' : 'Back to projects'} aria-label={props.local ? 'Back to local files' : 'LocalizationHub — back to projects'}><img src="/localizationhub-logo.jpg" alt="LocalizationHub" /></button>
      <div className="toolbar-title">
        <strong data-i18n-content><bdi>{props.projectName}</bdi></strong>
        <span className={`save-state save-${props.saveState}`}>{saveLabel}</span>
      </div>
      <div className="toolbar-group">
        <label className="toolbar-select">
          <span>Token profile</span>
          <select aria-label="Token profile" value={props.tokenProfileSelection} onChange={(event) => props.onTokenProfile(event.target.value as TokenProfileId)}>
            {props.tokenProfiles.map((item) => <option key={item} value={item}>{item === 'auto' ? displayTokenProfile(props.tokenProfileConfig) : TOKEN_PROFILE_LABELS[item as 'generic' | 'godot' | 'unreal' | 'unity'] ?? item}</option>)}
          </select>
          <small className="token-profile-toolbar-status">
            <TokenProfileStatus config={props.tokenProfileConfig} />
          </small>
        </label>
        {!props.local && <button className="toolbar-button" onClick={props.onCollaboration}>Collaboration</button>}
        <button className="toolbar-button" onClick={props.onSearchReplace}>Search &amp; Replace</button>
        <button className="toolbar-button" onClick={props.onOverview}>Overview</button>
      </div>
      <div className="toolbar-group">
        <button className="toolbar-button toolbar-command" type="button" onClick={() => openCommandCenter()} aria-label={t('delight.command.open')}>⌘</button>
        <button className="toolbar-button" onClick={props.onToggleEntries}>Entries</button>
        <button className="toolbar-button" onClick={props.onToggleInspector}>Inspector</button>
        <button className="toolbar-button" onClick={props.onToggleFocus} title="Toggle focus mode">{props.focusMode ? 'Exit Focus' : 'Focus'}</button>
        {props.local && <button className="toolbar-button" onClick={props.onExport}>Export</button>}
        <button className="toolbar-button toolbar-save" onClick={props.onSave}>{props.local ? 'Save locally' : 'Save'}</button>
      </div>
    </header>
  )
}

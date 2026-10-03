import { useEffect, useState } from 'react'
import EntriesPanel from './EntriesPanel'
import EditorPanel from './EditorPanel'
import Inspector from './Inspector'
import ProjectOverview from './ProjectOverview'
import SearchReplace from './SearchReplace'
import BrowserCollaboration from '../BrowserCollaboration'
import ConfirmDialog from './ConfirmDialog'
import type { BulkSelection, EntryFilterId, EntryIssue, EntryView } from './entryCollection'
import type { ProjectSnapshot } from '../appApi'
import { TOKEN_PROFILE_LABELS, type GlossaryEntry, type TokenProfileConfig, type TokenProfileId } from '@localizationhub/core'
import TokenProfileStatus from './TokenProfileStatus'
import CompletionMoment from '../delight/CompletionMoment'
import { openCommandCenter, WORKSPACE_COMMAND_EVENT } from '../delight/commandEvents'
import { useI18n } from '@localizationhub/i18n'

type SaveState = 'saved' | 'unsaved' | 'saving' | 'failed'
type Surface = 'entries' | 'editor' | 'tools'

export type MobileWorkspaceProps = {
  onDelete?: () => void
  local?: boolean
  onExport: () => void
  glossary?: GlossaryEntry[]
  user: { id: string; username: string }
  projectId: string
  projectName: string
  role: string
  saveState: SaveState
  tokenProfileId: TokenProfileId
  tokenProfileSelection: TokenProfileId
  tokenProfileConfig: TokenProfileConfig
  tokenProfiles: TokenProfileId[]
  onTokenProfile: (value: TokenProfileId) => void
  goHome: () => void
  onHome: () => void
  onSave: () => void
  // entries
  views: EntryView[]
  counts: Record<string, number>
  filter: EntryFilterId
  onFilter: (filter: EntryFilterId) => void
  query: string
  onQuery: (value: string) => void
  selected: number
  onSelect: (index: number) => void
  selection: BulkSelection
  onToggleSelection: (index: number) => void
  onClearSelection: () => void
  commentEntryIds: Set<string>
  assigneeOf: (entryId: string) => string | null
  // editor
  entry: any
  status: string
  writable: boolean
  issues: EntryIssue[]
  sourceDirection: 'ltr' | 'rtl' | 'auto'
  direction: 'ltr' | 'rtl' | 'auto'
  position: number
  total: number
  onTranslationChange: (value: string) => void
  onStatusChange: (status: string) => void
  onNextUntranslated: (dir: 1 | -1) => void
  onJumpTo: (position: number) => void
  sourceLocale?: string
  targetLocale?: string
  // inspector / tools
  snapshot: ProjectSnapshot
  draft: any
  setDraft: (updater: any | ((current: any) => any)) => void
  onRestored: (snapshot: ProjectSnapshot, project: any) => void
  onNotice: (value: string) => void
  members: any[]
  // project tools
  entries: any[]
  applyReplace: (updates: Array<{ index: number; translation: string }>) => void
  applyBulk: (status: string | null) => void
  // overlays + shared UI
  overviewOpen: boolean
  setOverviewOpen: (value: boolean) => void
  replaceOpen: boolean
  setReplaceOpen: (value: boolean) => void
  collabOpen: boolean
  setCollabOpen: (value: boolean) => void
  bulkOpen: boolean
  setBulkOpen: (value: boolean) => void
  confirmLeave: boolean
  setConfirmLeave: (value: boolean) => void
  notice: string
  setNotice: (value: string) => void
  complete: boolean
}

const STATUSES = ['draft', 'translated', 'needs-review', 'approved'] as const

export default function MobileWorkspace(props: MobileWorkspaceProps) {
  const { t } = useI18n()
  const [surface, setSurface] = useState<Surface>('editor')
  const { saveState } = props

  const saveLabel = saveState === 'saving' ? 'Saving…' : saveState === 'failed' ? 'Save failed' : saveState === 'unsaved' ? 'Unsaved' : 'Saved'

  function selectEntry(index: number) {
    props.onSelect(index)
    setSurface('editor')
  }

  useEffect(() => {
    const onCommand = (event: Event) => {
      if ((event as CustomEvent<{ action?: string }>).detail?.action !== 'search') return
      setSurface('entries')
      requestAnimationFrame(() => document.querySelector<HTMLInputElement>('input[name="workspace-entry-search"]')?.focus())
    }
    window.addEventListener(WORKSPACE_COMMAND_EVENT, onCommand)
    return () => window.removeEventListener(WORKSPACE_COMMAND_EVENT, onCommand)
  }, [])

  return (
    <main className="mob-workspace">
      <header className="mob-header">
        <button className="mob-back" onClick={props.goHome} aria-label={props.local ? 'Back to local files' : 'Back to projects'}>‹</button>
        <div className="mob-title">
          <strong className="mob-project-name" data-i18n-content><bdi>{props.projectName}</bdi></strong>
          <span className={`save-state save-${saveState}`}>{saveLabel}</span>
        </div>
        <button type="button" className="mob-command" onClick={() => openCommandCenter()} aria-label={t('delight.command.open')}>⌘</button>
        <button className="mob-save" onClick={props.onSave} disabled={saveState === 'saving'}>{props.local ? 'Save locally' : 'Save'}</button>
      </header>

      <CompletionMoment projectId={props.projectId} complete={props.complete} onReview={() => props.setOverviewOpen(true)} />

      <div className="mob-surface">
        {surface === 'entries' && (
          <EntriesPanel
            local={props.local}
            views={props.views}
            counts={props.counts}
            filter={props.filter}
            onFilter={props.onFilter}
            query={props.query}
            onQuery={props.onQuery}
            selected={props.selected}
            onSelect={selectEntry}
            selection={props.selection}
            onToggleSelection={props.onToggleSelection}
            onClearSelection={props.onClearSelection}
            commentEntryIds={props.commentEntryIds}
            assigneeOf={props.assigneeOf}
            onOpenBulk={() => props.setBulkOpen(true)}
            onJumpTo={() => undefined}
            mobile
          />
        )}

        {surface === 'editor' && (
          <EditorPanel
            sampleGuide={Boolean(props.local && props.projectId.startsWith('sample:northern-gate:'))}
            local={props.local}
            entry={props.entry}
            extractionContext={props.draft?.metadata?.extraction?.entries?.[props.entry?.id]?.context}
            status={props.status}
            writable={props.writable}
            tokenProfileId={props.tokenProfileId}
            issues={props.issues}
            glossary={props.glossary}
            sourceDirection={props.sourceDirection}
            direction={props.direction}
            position={props.position}
            total={props.total}
            onTranslationChange={props.onTranslationChange}
            onStatusChange={props.onStatusChange}
            onNextUntranslated={() => props.onNextUntranslated(1)}
            onPrevUntranslated={() => props.onNextUntranslated(-1)}
            onJumpTo={props.onJumpTo}
            sourceLocale={props.sourceLocale}
            targetLocale={props.targetLocale}
            onNext={() => props.onJumpTo(props.position + 1)}
            onPrev={() => props.onJumpTo(props.position - 1)}
            mobile
          />
        )}

        {surface === 'tools' && (
          <div className="mob-tools">
            <Inspector
              local={props.local}
              projectId={props.projectId}
              entry={props.entry}
              snapshot={props.snapshot}
              draft={props.draft}
              writable={props.writable}
              currentUserId={props.user.id}
              members={props.members}
              setDraft={props.setDraft}
              onRestored={props.onRestored}
              onNotice={props.onNotice}
            />
            <div className="mob-tools-section">
              <h3 className="mob-tools-heading">Project tools</h3>
              <div className="mob-tools-grid">
                <button className="mob-tools-button" onClick={() => props.setOverviewOpen(true)}>Project Overview</button>
                <button className="mob-tools-button" onClick={() => props.setReplaceOpen(true)}>Search &amp; Replace</button>
                {!props.local && <button className="mob-tools-button" onClick={() => props.setCollabOpen(true)}>Collaboration</button>}
                {props.local && <button className="mob-tools-button" onClick={props.onExport}>Export</button>}
              </div>
              <label className="mob-token-field">
                <span>Token profile</span>
                  <select aria-label="Token profile" value={props.tokenProfileSelection} onChange={(event) => props.onTokenProfile(event.target.value as TokenProfileId)}>
                  {props.tokenProfiles.map((item) => <option key={item} value={item}>{item === 'auto' ? `Auto · ${TOKEN_PROFILE_LABELS[props.tokenProfileConfig.resolvedProfile]}` : TOKEN_PROFILE_LABELS[item as 'generic' | 'godot' | 'unreal' | 'unity'] ?? item}</option>)}
                </select>
                <small>{props.tokenProfileConfig.mode === 'auto' ? `Auto · ${TOKEN_PROFILE_LABELS[props.tokenProfileConfig.resolvedProfile]}` : `Selected · ${TOKEN_PROFILE_LABELS[(props.tokenProfileConfig.selectedProfile ?? props.tokenProfileId) as 'generic' | 'godot' | 'unreal' | 'unity'] ?? props.tokenProfileId}`}</small>
                <small className="token-profile-mobile-warning"><TokenProfileStatus config={props.tokenProfileConfig} /></small>
              </label>
            </div>
          </div>
        )}
      </div>

      <nav className="mob-nav" aria-label="Workspace">
        <button
          className={surface === 'entries' ? 'active' : ''}
          onClick={() => setSurface('entries')}
          aria-current={surface === 'entries' ? 'page' : undefined}
        >
          <span className="mob-nav-icon" aria-hidden="true">☰</span>
          Entries
        </button>
        <button
          className={surface === 'editor' ? 'active' : ''}
          onClick={() => setSurface('editor')}
          aria-current={surface === 'editor' ? 'page' : undefined}
        >
          <span className="mob-nav-icon" aria-hidden="true">✎</span>
          Editor
        </button>
        <button
          className={surface === 'tools' ? 'active' : ''}
          onClick={() => setSurface('tools')}
          aria-current={surface === 'tools' ? 'page' : undefined}
        >
          <span className="mob-nav-icon" aria-hidden="true">⚙</span>
          Tools
        </button>
      </nav>

      {props.notice && <div className="toast" role="status">{props.notice}<button onClick={() => props.setNotice('')} aria-label="Dismiss">×</button></div>}

      {props.overviewOpen && (
        <div className="overlay mob-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) props.setOverviewOpen(false) }}>
          <ProjectOverview local={props.local} onDelete={props.onDelete} snapshot={props.snapshot} draft={props.draft} memberCount={props.members.length} tokenProfileId={props.tokenProfileId} tokenProfileConfig={props.tokenProfileConfig} role={props.role} onClose={() => props.setOverviewOpen(false)} />
        </div>
      )}

      {!props.local && props.collabOpen && (
        <div className="overlay mob-overlay">
          <div className="dialog dialog-wide mob-sheet">
            <div className="mob-sheet-head">
              <h2 className="dialog-title">Live collaboration</h2>
              <button className="icon-button" onClick={() => props.setCollabOpen(false)} aria-label="Close collaboration">×</button>
            </div>
            <BrowserCollaboration projectId={props.projectId} writable={props.writable} />
          </div>
        </div>
      )}

      {props.replaceOpen && (
        <SearchReplace entries={props.entries} writable={props.writable} onApply={props.applyReplace} onClose={() => props.setReplaceOpen(false)} />
      )}

      {props.bulkOpen && (
        <div className="dialog-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) props.setBulkOpen(false) }}>
          <div className="dialog mob-sheet" role="dialog" aria-modal="true" aria-label="Bulk actions">
            <h2 className="dialog-title">Bulk actions</h2>
            <p className="dialog-body">{props.selection.size} selected</p>
            <div className="bulk-options">
              {STATUSES.map((item) => <button key={item} className="dialog-button" onClick={() => { props.applyBulk(item); props.setBulkOpen(false) }}>Set {item.replace('-', ' ')}</button>)}
            </div>
            <div className="dialog-actions"><button className="dialog-button" onClick={() => props.setBulkOpen(false)}>Close</button></div>
          </div>
        </div>
      )}

      {props.confirmLeave && (
        <ConfirmDialog
          title="Unsaved changes"
          body="You have unsaved changes. Leave without saving?"
          confirmLabel="Leave"
          danger
          onConfirm={() => { props.setConfirmLeave(false); props.onHome() }}
          onCancel={() => props.setConfirmLeave(false)}
        />
      )}
    </main>
  )
}

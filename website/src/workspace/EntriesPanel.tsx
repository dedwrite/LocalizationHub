import { useMemo, useState, type KeyboardEvent } from 'react'
import { ENTRY_FILTERS, type BulkSelection, type EntryFilterId, type EntryView } from './entryCollection'
import VirtualList from './VirtualList'
import { useI18n } from '@localizationhub/i18n'

type EntriesPanelProps = {
  local?: boolean
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
  onOpenBulk: () => void
  onJumpTo: () => void
  mobile?: boolean
}

function statusDotClass(view: EntryView): string {
  if (view.hasError) return 'dot-error'
  if (view.hasWarning) return 'dot-warning'
  if (view.status === 'translated') return 'dot-translated'
  if (view.status === 'untranslated') return 'dot-untranslated'
  return 'dot-draft'
}

function statusLabel(view: EntryView): string {
  if (view.hasError) return 'Error'
  if (view.hasWarning) return 'Warning'
  return view.status === 'translated' ? 'Translated' : view.status === 'untranslated' ? 'Untranslated' : 'Review'
}

export default function EntriesPanel(props: EntriesPanelProps) {
  const { t } = useI18n()
  const { views, counts, filter, onFilter, query, onQuery, selected, onSelect, selection, onToggleSelection, onClearSelection, commentEntryIds, assigneeOf, onOpenBulk, onJumpTo, mobile = false } = props
  const [moreFilters, setMoreFilters] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)

  const primaryFilters = useMemo(() => ENTRY_FILTERS.filter((item) => item.primary), [])
  const secondaryFilters = useMemo(() => ENTRY_FILTERS.filter((item) => !item.primary), [])

  const total = counts.total ?? 0
  const remaining = counts.untranslated ?? 0
  const translated = total - remaining
  const percent = total ? Math.round((translated / total) * 100) : 0

  function renderRow(item: unknown) {
    const view = item as EntryView
    const isSelected = view.index === selected
    const isChecked = selection.has(view.index)
    const commentCount = commentEntryIds.has(view.entry.id) ? 1 : 0
    const assignee = assigneeOf(view.entry.id)
    const key = view.entry.key || view.entry.id
    const selectOnKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onSelect(view.index)
      }
    }

    if (mobile) {
      return (
        <div
          className={`entry-row mob-entry-row ${isSelected ? 'selected' : ''}`}
          onClick={() => onSelect(view.index)}
          onKeyDown={selectOnKey}
          role="listitem"
          tabIndex={0}
          aria-label={`${key} — ${statusLabel(view)}`}
        >
          {selectionMode && (
            <input
              type="checkbox"
              className="entry-checkbox"
              checked={isChecked}
              onClick={(event) => event.stopPropagation()}
              onChange={() => onToggleSelection(view.index)}
              aria-label={`Select ${key}`}
            />
          )}
          <span className={`entry-status-dot ${statusDotClass(view)}`} aria-hidden="true" />
          <div className="entry-row-main">
            <span className="entry-key" data-i18n-content>{key}</span>
            {view.entry.translation || view.entry.source
              ? <span className="entry-preview" data-i18n-content>{view.entry.translation || view.entry.source}</span>
              : <span className="entry-preview">Untranslated</span>}
          </div>
          <div className="entry-row-meta">
            <span className={`entry-state-tag state-${statusLabel(view).toLowerCase().replace(' ', '-')}`}>{statusLabel(view)}</span>
            {commentCount > 0 && <span className="entry-flag flag-comment" title="Has comments">💬</span>}
            {assignee && <span className="entry-flag flag-assignee" title={`Assigned to ${assignee}`}>◎</span>}
          </div>
        </div>
      )
    }

    return (
      <div
        className={`entry-row ${isSelected ? 'selected' : ''}`}
        onClick={() => onSelect(view.index)}
        onKeyDown={selectOnKey}
        role="listitem"
        tabIndex={0}
        aria-label={`${key} — ${statusLabel(view)}`}
      >
        <input
          type="checkbox"
          className="entry-checkbox"
          checked={isChecked}
          onClick={(event) => event.stopPropagation()}
          onChange={() => onToggleSelection(view.index)}
          aria-label={`Select ${view.entry.key || view.entry.id}`}
        />
        <span className={`entry-status-dot ${statusDotClass(view)}`} title={statusLabel(view)} aria-hidden="true" />
        <div className="entry-row-main">
          <span className="entry-key" data-i18n-content>{view.entry.key || view.entry.id}</span>
          {view.entry.translation
            ? <span className="entry-preview" data-i18n-content>{view.entry.translation}</span>
            : <span className="entry-preview">Untranslated</span>}
        </div>
        <div className="entry-row-meta">
          {view.hasError && <span className="entry-flag flag-error" title="QA error">!</span>}
          {view.hasWarning && !view.hasError && <span className="entry-flag flag-warning" title="QA warning">!</span>}
          {commentCount > 0 && <span className="entry-flag flag-comment" title="Has comments">💬</span>}
          {assignee && <span className="entry-flag flag-assignee" title={`Assigned to ${assignee}`}>◎</span>}
        </div>
      </div>
    )
  }

  const filters = (mobile ? [...primaryFilters, ...(moreFilters ? secondaryFilters : [])] : ENTRY_FILTERS)
    .filter((item) => !props.local || !['comments', 'assigned-to-me'].includes(item.id))

  if (mobile) {
    return (
      <div className="entries-panel mob-entries">
        <div className="mob-entries-summary">
          <div className="mob-summary-line">
            <strong>{total.toLocaleString()} entries</strong>
            <span className="mob-summary-sub">{remaining.toLocaleString()} remaining</span>
          </div>
          <div className="mob-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={translated} aria-label="Project completion progress">
            <div className="mob-progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <div className="mob-summary-detail">
            <span>{translated.toLocaleString()} translated</span>
            <span>·</span>
            <span>{counts['needs-review'] ?? 0} review</span>
            {counts.errors > 0 && <><span>·</span><span className="mob-summary-error">{counts.errors} errors</span></>}
          </div>
        </div>

        <div role="search" className="mob-entries-search">
          <input
            className="search-input"
            type="search"
            name="workspace-entry-search"
            role="searchbox"
            spellCheck={false}
            enterKeyHint="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search key, source, or translation"
            aria-label="Search entries"
          />
        </div>

        <div className="mob-filters" role="tablist" aria-label="Entry filters">
          {filters.map((item) => {
            const count = counts[item.id] ?? 0
            return (
              <button
                key={item.id}
                role="tab"
                aria-selected={filter === item.id}
                className={`mob-filter-chip ${filter === item.id ? 'active' : ''}`}
                onClick={() => onFilter(item.id)}
              >
                {item.label}
                {item.id !== 'all' && <span className="mob-filter-count">{count}</span>}
              </button>
            )
          })}
          <button
            className="mob-filter-chip mob-filter-more"
            aria-expanded={moreFilters}
            onClick={() => setMoreFilters((value) => !value)}
          >
            {moreFilters ? 'Less' : 'More filters'}
          </button>
        </div>

        <div className="mob-entries-tools">
          <button
            className={`mob-tool-action ${selectionMode ? 'active' : ''}`}
            aria-pressed={selectionMode}
            onClick={() => {
              setSelectionMode((value) => !value)
              if (selectionMode) onClearSelection()
            }}
          >
            {selectionMode ? 'Done' : 'Select entries'}
          </button>
        </div>

        {selectionMode && selection.size > 0 && (
          <div className="bulk-bar mob-bulk-bar">
            <span>{selection.size} selected</span>
            <button onClick={onOpenBulk}>Bulk actions</button>
            <button onClick={onClearSelection}>Clear</button>
          </div>
        )}

        <div className="entries-list">
          <VirtualList items={views} rowHeight={68} renderRow={renderRow} />
        </div>
      </div>
    )
  }

  return (
    <div className="entries-panel">
      <div className="entries-head">
        <div className="entries-counts">
          <span className="count-pill" title="Total entries">{counts.total}</span>
          <span className="count-pill count-done" title="Translated">{translated}</span>
          <span className="count-pill count-todo" title="Untranslated">{counts.untranslated}</span>
          <span className="count-pill count-review" title="Needs Review">{counts['needs-review']}</span>
          {counts.errors > 0 && <span className="count-pill count-error">{counts.errors}</span>}
          {counts.warnings > 0 && <span className="count-pill count-warning">{counts.warnings}</span>}
        </div>
        <div className="entries-tools">
          <button className="icon-button" onClick={onJumpTo} title="Jump to entry">#</button>
        </div>
      </div>
      {props.local && <div className="local-completion" data-i18n-skip>{t('local.completion', { translated, total, percent })}</div>}
      <div className="entries-filters" role="tablist" aria-label="Entry filters">
        {filters.map((item) => {
          const count = counts[item.id] ?? 0
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={filter === item.id}
              className={`filter-tab ${filter === item.id ? 'active' : ''}`}
              onClick={() => onFilter(item.id)}
            >
              {item.label}
              {item.id !== 'all' && <span className="filter-count">{count}</span>}
            </button>
          )
        })}
      </div>
      <div role="search" className="entries-search-wrap">
        <input
          className="search-input"
          type="search"
          name="workspace-entry-search"
          role="searchbox"
          spellCheck={false}
          enterKeyHint="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search key, source, or translation"
          aria-label="Search entries"
        />
      </div>
      {selection.size > 0 && (
        <div className="bulk-bar">
          <span>{selection.size} selected</span>
          <button onClick={onOpenBulk}>Bulk actions</button>
          <button onClick={onClearSelection}>Clear</button>
        </div>
      )}
      <div className="entries-list">
        <VirtualList items={views} rowHeight={52} renderRow={renderRow} />
      </div>
    </div>
  )
}

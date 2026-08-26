import { ENTRY_FILTERS, type BulkSelection, type EntryFilterId, type EntryView } from './entryCollection'
import VirtualList from './VirtualList'

type EntriesPanelProps = {
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
}

function statusDotClass(view: EntryView): string {
  if (view.hasError) return 'dot-error'
  if (view.hasWarning) return 'dot-warning'
  if (view.status === 'translated') return 'dot-translated'
  if (view.status === 'untranslated') return 'dot-untranslated'
  return 'dot-draft'
}

export default function EntriesPanel(props: EntriesPanelProps) {
  const { views, counts, filter, onFilter, query, onQuery, selected, onSelect, selection, onToggleSelection, onClearSelection, commentEntryIds, assigneeOf, onOpenBulk, onJumpTo } = props

  function renderRow(item: unknown) {
    const view = item as EntryView
    const isSelected = view.index === selected
    const isChecked = selection.has(view.index)
    const commentCount = commentEntryIds.has(view.entry.id) ? 1 : 0
    const assignee = assigneeOf(view.entry.id)
    return (
      <div
        className={`entry-row ${isSelected ? 'selected' : ''}`}
        onClick={() => onSelect(view.index)}
        role="listitem"
      >
        <input
          type="checkbox"
          className="entry-checkbox"
          checked={isChecked}
          onClick={(event) => event.stopPropagation()}
          onChange={() => onToggleSelection(view.index)}
          aria-label={`Select ${view.entry.key || view.entry.id}`}
        />
        <span className={`entry-status-dot ${statusDotClass(view)}`} aria-hidden="true" />
        <div className="entry-row-main">
          <span className="entry-key">{view.entry.key || view.entry.id}</span>
          <span className="entry-preview">{view.entry.translation || 'Untranslated'}</span>
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

  return (
    <div className="entries-panel">
      <div className="entries-head">
        <div className="entries-counts">
          <span className="count-pill">{counts.total}</span>
          <span className="count-pill count-done">{counts.translated}</span>
          <span className="count-pill count-todo">{counts.untranslated}</span>
          <span className="count-pill count-review">{counts['needs-review']}</span>
          {counts.errors > 0 && <span className="count-pill count-error">{counts.errors}</span>}
          {counts.warnings > 0 && <span className="count-pill count-warning">{counts.warnings}</span>}
        </div>
        <div className="entries-tools">
          <button className="icon-button" onClick={onJumpTo} title="Jump to entry">#</button>
        </div>
      </div>
      <div className="entries-filters" role="tablist" aria-label="Entry filters">
        {ENTRY_FILTERS.map((item) => {
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
          id="workspace-entry-search"
          name="workspace-entry-search-field"
          role="searchbox"
          aria-autocomplete="none"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          data-lpignore="true"
          data-form-type="other"
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

import { useMemo, useState } from 'react'
import type {
  ExtractionResult,
  ExtractedEntry,
} from '@localizationhub/core'
import {
  REVIEW_FILTERS,
  matchesReviewFilter,
  type ReviewFilterId,
} from '@localizationhub/core'
import './ExtractionReview.css'

type Props = {
  result: ExtractionResult
  onCreateProject: (entries: ExtractedEntry[]) => void
  onCancel: () => void
}

export default function ExtractionReview({ result, onCreateProject, onCancel }: Props) {
  const [filter, setFilter] = useState<ReviewFilterId>('all')
  const [search, setSearch] = useState('')

  const visible = useMemo(() => {
    const text = search.trim().toLowerCase()
    return result.entries.filter((entry) => {
      if (!matchesReviewFilter(entry, filter)) return false
      if (!text) return true
      return (
        entry.sourceText.toLowerCase().includes(text) ||
        (entry.key ?? '').toLowerCase().includes(text) ||
        (entry.context?.speaker ?? '').toLowerCase().includes(text)
      )
    })
  }, [result.entries, filter, search])

  const { stats, detection } = result

  return (
    <main className="extraction-review">
      <header className="er-header">
        <div className="er-title">
          <h1>Extraction Review</h1>
          <p className="er-subtitle">
            {detection.familyLabel}
            {detection.versionEstimate ? ` ${detection.versionEstimate}` : ''}
            {' · '}
            <span className={`er-confidence er-conf-${detection.confidence}`}>{detection.confidence} confidence</span>
          </p>
        </div>
        <div className="er-actions">
          <button className="er-button" onClick={onCancel}>Cancel</button>
          <button
            className="er-button er-primary"
            onClick={() => onCreateProject(result.entries)}
            disabled={result.entries.length === 0}
          >
            Create Project ({result.entries.length})
          </button>
        </div>
      </header>

      {detection.evidence.length > 0 && (
        <div className="er-evidence">
          {detection.evidence.map((item, index) => (
            <span key={index} className="er-evidence-chip">{item}</span>
          ))}
        </div>
      )}

      <section className="er-stats">
        <Stat label="Entries" value={stats.entriesFound} />
        <Stat label="Dialogue" value={stats.byClassification['Dialogue'] ?? 0} />
        <Stat label="UI" value={(stats.byClassification['UI'] ?? 0) + (stats.byClassification['Menu'] ?? 0)} />
        <Stat label="With speaker" value={stats.entriesWithSpeaker} />
        <Stat label="With listener" value={stats.entriesWithListener} />
        <Stat label="Explicit gender" value={stats.entriesWithExplicitGender} />
        <Stat label="Protected tokens" value={stats.protectedTokenCount} />
        <Stat label="Warnings" value={stats.warnings} />
      </section>

      <div className="er-controls">
        <div className="er-filters" role="tablist" aria-label="Review filters">
          {REVIEW_FILTERS.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={filter === item.id}
              className={`er-filter-chip ${filter === item.id ? 'active' : ''}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input
          className="er-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search extracted text, key, or speaker"
          aria-label="Search extracted entries"
        />
      </div>

      <div className="er-list" role="list">
        {visible.map((entry) => (
          <EntryRow key={entry.id} entry={entry} />
        ))}
        {visible.length === 0 && (
          <div className="er-empty">No entries match the current filter.</div>
        )}
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="er-stat">
      <strong>{value.toLocaleString()}</strong>
      <span>{label}</span>
    </div>
  )
}

function EntryRow({ entry }: { entry: ExtractedEntry }) {
  return (
    <div className="er-row" role="listitem">
      <span className={`er-cat er-cat-${entry.classification.toLowerCase()}`}>{entry.classification}</span>
      <div className="er-row-body">
        <p className="er-source-text" dir="auto">{entry.sourceText}</p>
        {entry.context && (
          <div className="er-context">
            {entry.context.speaker && <span className="er-ctx">Speaker: {entry.context.speaker}</span>}
            {entry.context.listener && <span className="er-ctx">Listener: {entry.context.listener}</span>}
            {entry.context.speakerGender && entry.context.speakerGender !== 'unknown' && (
              <span className="er-ctx">Gender: {entry.context.speakerGender}</span>
            )}
            {entry.context.scene && <span className="er-ctx">Scene: {entry.context.scene}</span>}
          </div>
        )}
        <p className="er-origin">
          {entry.origin.engine}
          {entry.origin.containerPath && ` · ${entry.origin.containerPath}`}
          {entry.origin.namespace && ` · ${entry.origin.namespace}`}
          {entry.origin.key && ` · ${entry.origin.key}`}
          {entry.origin.fieldPath && ` · ${entry.origin.fieldPath}`}
        </p>
        {entry.protectedSegments.length > 0 && (
          <div className="er-protected">
            {entry.protectedSegments.map((segment, index) => (
              <code key={index} className="er-token">{segment.raw}</code>
            ))}
          </div>
        )}
        {entry.classificationConfidence === 'low' && <span className="er-low-conf">low confidence</span>}
      </div>
    </div>
  )
}

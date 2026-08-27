import { useCallback, useMemo, useState } from 'react'
import type {
  ExtractionResult,
  ExtractedEntry,
} from '@localizationhub/core'
import {
  REVIEW_FILTERS,
  matchesReviewFilter,
  type ReviewFilterId,
  type ContextFieldMapping,
  type ContextFieldRole,
} from '@localizationhub/core'
import VirtualList from './VirtualList'
import './ExtractionReview.css'

type Props = {
  result: ExtractionResult
  onCreateProject: (includedEntryIds: Set<string>, sourceLocale?: string) => void
  onApplyMappings: (mappings: ContextFieldMapping[]) => void
  onCancel: () => void
}

const ROW_HEIGHT = 148

export default function ExtractionReview({ result, onCreateProject, onApplyMappings, onCancel }: Props) {
  const [filter, setFilter] = useState<ReviewFilterId>('all')
  const [search, setSearch] = useState('')
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [excludedFiles, setExcludedFiles] = useState<Set<string>>(new Set())
  const [mappingsOpen, setMappingsOpen] = useState(false)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [sourceLocale, setSourceLocale] = useState<string | undefined>(undefined)

  // Effective entry list: apply filter + search + file exclusion.
  const filteredEntries = useMemo(() => {
    const text = search.trim().toLowerCase()
    return result.entries.filter((entry) => {
      if (excludedFiles.has(entry.origin.containerPath ?? '')) return false
      if (!matchesReviewFilter(entry, filter)) return false
      if (!text) return true
      return (
        entry.sourceText.toLowerCase().includes(text) ||
        (entry.key ?? '').toLowerCase().includes(text) ||
        (entry.context?.speaker ?? '').toLowerCase().includes(text)
      )
    })
  }, [result.entries, filter, search, excludedFiles])

  const includedCount = useMemo(
    () => result.entries.filter((e) => !excludedIds.has(e.id) && !excludedFiles.has(e.origin.containerPath ?? '')).length,
    [result.entries, excludedIds, excludedFiles],
  )
  const excludedCount = result.entries.length - includedCount

  // File grouping.
  const files = useMemo(() => {
    const map = new Map<string, { count: number }>()
    for (const entry of result.entries) {
      const path = entry.origin.containerPath ?? '(unknown)'
      const item = map.get(path) ?? { count: 0 }
      item.count += 1
      map.set(path, item)
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count)
  }, [result.entries])

  const toggleEntry = useCallback((id: string) => {
    setExcludedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleFile = useCallback((path: string) => {
    setExcludedFiles((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const excludeVisible = useCallback(() => {
    setExcludedIds((current) => {
      const next = new Set(current)
      for (const entry of filteredEntries) next.add(entry.id)
      return next
    })
  }, [filteredEntries])

  const includeVisible = useCallback(() => {
    setExcludedIds((current) => {
      const next = new Set(current)
      for (const entry of filteredEntries) next.delete(entry.id)
      return next
    })
  }, [filteredEntries])

  function handleCreate() {
    const included = new Set(
      result.entries
        .filter((e) => !excludedIds.has(e.id) && !excludedFiles.has(e.origin.containerPath ?? ''))
        .map((e) => e.id),
    )
    onCreateProject(included, sourceLocale)
  }

  const { stats, detection, localizationTargets } = result

  // Aggregated culture list across all targets.
  const cultures = useMemo(() => {
    const set = new Set<string>()
    for (const target of localizationTargets ?? []) {
      for (const culture of target.availableCultures) set.add(culture)
      if (target.nativeCulture) set.add(target.nativeCulture)
    }
    return [...set].sort()
  }, [localizationTargets])

  const nativeCulture = localizationTargets?.find((t) => t.nativeCulture)?.nativeCulture

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
          <span className="er-counts">
            Included: <strong>{includedCount}</strong> · Excluded: <strong>{excludedCount}</strong>
          </span>
          <button className="er-button" onClick={onCancel}>Cancel</button>
          <button
            className="er-button er-primary"
            onClick={handleCreate}
            disabled={includedCount === 0}
          >
            Create Project ({includedCount})
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

      {cultures.length > 0 && (
        <section className="er-cultures">
          <span className="er-cultures-label">Languages detected: {cultures.length}</span>
          <div className="er-cultures-list">
            {cultures.map((culture) => (
              <span key={culture} className="er-culture-chip">{culture}</span>
            ))}
          </div>
          <label className="er-source-locale">
            Source language
            <select
              value={sourceLocale ?? nativeCulture ?? cultures[0] ?? ''}
              onChange={(event) => setSourceLocale(event.target.value)}
              aria-label="Source language"
            >
              {cultures.map((culture) => <option key={culture} value={culture}>{culture}</option>)}
            </select>
            {nativeCulture && <span className="er-native-hint">Native: {nativeCulture}</span>}
          </label>
        </section>
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
        <div className="er-controls-row">
          <input
            className="er-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search extracted text, key, or speaker"
            aria-label="Search extracted entries"
          />
          <button className="er-button er-small" onClick={excludeVisible}>Exclude visible</button>
          <button className="er-button er-small" onClick={includeVisible}>Include visible</button>
          <button className="er-button er-small" onClick={() => setMappingsOpen((v) => !v)}>Context mapping</button>
          <button className="er-button er-small" onClick={() => setDiagnosticsOpen((v) => !v)}>Diagnostics ({result.diagnostics.length})</button>
        </div>
      </div>

      {mappingsOpen && <ContextMappingPanel onApply={onApplyMappings} />}

      {diagnosticsOpen && (
        <div className="er-diagnostics">
          {result.diagnostics.length === 0 && <p className="er-empty">No diagnostics.</p>}
          {result.diagnostics.map((diagnostic, index) => (
            <div key={index} className={`er-diagnostic er-diag-${diagnostic.kind}`}>
              <span className="er-diag-kind">{diagnostic.kind}</span>
              <span className="er-diag-message">{diagnostic.message}</span>
              {diagnostic.path && <span className="er-diag-path">{diagnostic.path}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="er-files" aria-label="Files">
        {files.map(([path, item]) => (
          <button
            key={path}
            className={`er-file-chip ${excludedFiles.has(path) ? 'excluded' : ''}`}
            onClick={() => toggleFile(path)}
            aria-pressed={!excludedFiles.has(path)}
          >
            {path} · {item.count}
          </button>
        ))}
      </div>

      <div className="er-list-wrap">
        <VirtualList
          count={filteredEntries.length}
          rowHeight={ROW_HEIGHT}
          renderRow={(index) => {
            const entry = filteredEntries[index]
            return (
              <EntryRow
                entry={entry}
                excluded={excludedIds.has(entry.id)}
                onToggle={() => toggleEntry(entry.id)}
              />
            )
          }}
        />
        {filteredEntries.length === 0 && <div className="er-empty">No entries match the current filter.</div>}
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

function EntryRow({ entry, excluded, onToggle }: { entry: ExtractedEntry; excluded: boolean; onToggle: () => void }) {
  return (
    <div className={`er-row ${excluded ? 'excluded' : ''}`} role="listitem">
      <input
        type="checkbox"
        checked={!excluded}
        onChange={onToggle}
        aria-label={`${excluded ? 'Include' : 'Exclude'} ${entry.key ?? entry.id}`}
      />
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
      </div>
    </div>
  )
}

const CONTEXT_ROLES: ContextFieldRole[] = [
  'translatableText', 'speaker', 'listener', 'speakerGender', 'listenerGender',
  'grammaticalGender', 'scene', 'conversationId', 'dialogueId', 'nodeId',
  'parentNodeId', 'choiceGroup', 'voiceId', 'audioAsset', 'developerNote', 'translatorNote',
]

function ContextMappingPanel({ onApply }: { onApply: (mappings: ContextFieldMapping[]) => void }) {
  const [mappings, setMappings] = useState<ContextFieldMapping[]>([])
  const [field, setField] = useState('')
  const [role, setRole] = useState<ContextFieldRole>('translatableText')

  return (
    <div className="er-mapping">
      <div className="er-mapping-row">
        <input value={field} onChange={(e) => setField(e.target.value)} placeholder="Field name (e.g. who)" aria-label="Field name" />
        <select value={role} onChange={(e) => setRole(e.target.value as ContextFieldRole)} aria-label="Map to role">
          {CONTEXT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button
          className="er-button er-small"
          onClick={() => {
            if (!field.trim()) return
            setMappings((current) => [...current.filter((m) => m.fieldName !== field.trim()), { fieldName: field.trim(), role }])
            setField('')
          }}
        >
          Add mapping
        </button>
      </div>
      {mappings.length > 0 && (
        <>
          <div className="er-mapping-chips">
            {mappings.map((m) => (
              <span key={m.fieldName} className="er-mapping-chip">
                {m.fieldName} → {m.role}
                <button onClick={() => setMappings((current) => current.filter((x) => x.fieldName !== m.fieldName))} aria-label={`Remove ${m.fieldName}`}>×</button>
              </span>
            ))}
          </div>
          <div className="er-mapping-actions">
            <button className="er-button er-small er-primary" onClick={() => onApply(mappings)}>Apply &amp; Rerun</button>
          </div>
        </>
      )}
    </div>
  )
}

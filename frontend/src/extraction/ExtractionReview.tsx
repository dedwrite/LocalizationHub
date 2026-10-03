import { useCallback, useMemo, useRef, useState } from 'react'
import type {
  ExtractionResult,
  ExtractedEntry,
} from '@localizationhub/core'
import {
  REVIEW_FILTERS,
  type ReviewFilterId,
  type ContextFieldMapping,
  type ContextFieldRole,
} from '@localizationhub/core'
import VirtualList from './VirtualList'
import ReviewDialog from './ReviewDialog'
import { handleTabListKeys, tabStopIndex } from '../a11y/tabList'
import {
  filterEntries,
  computeFilterCounts,
  computeIncludedExcluded,
  computeAudienceCounts,
  groupSources,
  previewSourceCulture,
  categorizeDiagnostics,
  summarizeDiagnostics,
} from './reviewModel'
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
  const [excludedFiles, setExcludedFiles] = useState<Set<string>>(new Set())
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [mappingsOpen, setMappingsOpen] = useState(false)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [sourceLocale, setSourceLocale] = useState<string | undefined>(undefined)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { stats, detection, localizationTargets } = result

  // Proven developer/editor/test tooling is excluded by default. The component
  // is keyed by scan run (see ScanGameFlow), so this lazy initializer runs once
  // per result and the user can re-include anything via the review controls.
  const [excludedIds, setExcludedIds] = useState<Set<string>>(
    () => new Set(result.entries.filter((e) => e.excludedByDefault).map((e) => e.id)),
  )

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
  // A single detected culture is unambiguous; auto-select it as the source.
  // Multiple cultures with no native culture require an explicit choice — the
  // source must NEVER default to the first locale alphabetically.
  const singleCulture = cultures.length === 1 ? cultures[0] : undefined
  const defaultSource = nativeCulture ?? singleCulture
  const effectiveSource = sourceLocale ?? defaultSource
  const sourceRequired = !nativeCulture && cultures.length > 1
  const sourceMissing = sourceRequired && !sourceLocale

  // Source-language preview: apply the selected source culture to the LOGICAL
  // entries only (non-destructive — the original result is never mutated).
  const previewEntries = useMemo(
    () => previewSourceCulture(result.entries, effectiveSource),
    [result.entries, effectiveSource],
  )

  const filteredEntries = useMemo(
    () => filterEntries(previewEntries, filter, search, excludedFiles),
    [previewEntries, filter, search, excludedFiles],
  )

  const { included: includedCount, excluded: excludedCount } = useMemo(
    () => computeIncludedExcluded(previewEntries, excludedIds, excludedFiles),
    [previewEntries, excludedIds, excludedFiles],
  )

  // Per-filter counts (ignoring search), so chips show "Dialogue 27,415".
  const filterCounts = useMemo(
    () => computeFilterCounts(previewEntries, excludedFiles),
    [previewEntries, excludedFiles],
  )

  const sources = useMemo(
    () => groupSources(previewEntries, excludedFiles),
    [previewEntries, excludedFiles],
  )

  const audienceCounts = useMemo(() => computeAudienceCounts(previewEntries), [previewEntries])

  const diagnosticGroups = useMemo(() => categorizeDiagnostics(result.diagnostics), [result.diagnostics])
  const diagnosticSummary = useMemo(() => summarizeDiagnostics(diagnosticGroups), [diagnosticGroups])

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2600)
  }, [])

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
    const count = filteredEntries.length
    setExcludedIds((current) => {
      const next = new Set(current)
      for (const entry of filteredEntries) next.add(entry.id)
      return next
    })
    showToast(`${count.toLocaleString()} visible entries excluded.`)
  }, [filteredEntries, showToast])

  const includeVisible = useCallback(() => {
    const count = filteredEntries.length
    setExcludedIds((current) => {
      const next = new Set(current)
      for (const entry of filteredEntries) next.delete(entry.id)
      return next
    })
    showToast(`${count.toLocaleString()} visible entries included.`)
  }, [filteredEntries, showToast])

  function handleCreate() {
    const included = new Set(
      previewEntries
        .filter((e) => !excludedIds.has(e.id) && !excludedFiles.has(e.origin.containerPath ?? ''))
        .map((e) => e.id),
    )
    onCreateProject(included, effectiveSource)
  }

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
            Included: <strong>{includedCount.toLocaleString()}</strong> · Excluded: <strong>{excludedCount.toLocaleString()}</strong>
          </span>
          <button className="er-button" onClick={onCancel}>Cancel</button>
          <button
            className="er-button er-primary"
            onClick={handleCreate}
            disabled={includedCount === 0 || sourceMissing}
          >
            Create Project ({includedCount.toLocaleString()})
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

      <section className="er-summary">
        {cultures.length > 0 && (
          <div className="er-cultures">
            <span className="er-cultures-label">Languages: {cultures.length}</span>
            <div className="er-cultures-list">
              {cultures.map((culture) => (
                <span key={culture} className="er-culture-chip">{culture}</span>
              ))}
            </div>
            <label className="er-source-locale">
              Source language
              <select
                value={effectiveSource ?? ''}
                onChange={(event) => setSourceLocale(event.target.value)}
                aria-label="Source language"
              >
                {sourceRequired && <option value="" disabled>Select…</option>}
                {cultures.map((culture) => <option key={culture} value={culture}>{culture}</option>)}
              </select>
              {nativeCulture && <span className="er-native-hint">Native: {nativeCulture}</span>}
              {sourceMissing && <span className="er-native-hint">Select a source language to continue.</span>}
            </label>
          </div>
        )}

        <div className="er-stats">
          <Stat label="Entries" value={stats.entriesFound} />
          <Stat label="Included" value={audienceCounts.runtime} />
          <Stat label="Developer" value={audienceCounts.developerExcluded} />
          <Stat label="Uncertain" value={audienceCounts.uncertain} />
          <Stat label="Dialogue" value={stats.byClassification['Dialogue'] ?? 0} />
          <Stat label="UI" value={(stats.byClassification['UI'] ?? 0) + (stats.byClassification['Menu'] ?? 0)} />
          <Stat label="Speaker" value={stats.entriesWithSpeaker} />
          <Stat label="Errors" value={stats.errors} />
          <details className="er-stats-more">
            <summary>More</summary>
            <div className="er-stats-more-grid">
              <Stat label="Raw strings" value={stats.rawLocalizedStrings ?? stats.entriesFound} />
              <Stat label="Variants" value={stats.localizedVariants ?? 0} />
              <Stat label="Protected" value={stats.protectedTokenCount} />
              <Stat label="Listener" value={stats.entriesWithListener} />
              <Stat label="Gender" value={stats.entriesWithExplicitGender} />
              <Stat label="Resources" value={stats.resourcesDiscovered ?? stats.filesScanned} />
              <Stat label="Text resources" value={stats.textResources ?? 0} />
              <Stat label="Binary resources" value={stats.binaryResources ?? 0} />
              <Stat label="Unsupported" value={stats.unsupportedResources ?? 0} />
              <Stat label="Skipped" value={stats.skipped ?? 0} />
              <Stat label="Warnings" value={stats.warnings} />
            </div>
          </details>
        </div>
      </section>

      {result.entries.length === 0 && (
        <div className="er-zero-entry" role="alert">
          <strong>No translatable text was extracted from this game.</strong>
          <p>
            {stats.resourcesDiscovered ?? stats.filesScanned} resources were discovered but none produced text.
            This usually means the game's text lives in a binary resource type (e.g. compiled Ink, binary
            `.res`/`.scn`, optimized `.translation`) or a script format that needs conversion — or the source
            text uses a schema not yet recognized. See Diagnostics for a grouped summary.
          </p>
        </div>
      )}

      <div className="er-controls">
        <div className="er-filters" role="tablist" aria-label="Review filters">
          {REVIEW_FILTERS.map((item) => {
            const active = filter === item.id
            return (
              <button
                key={item.id}
                role="tab"
                id={`review-filter-${item.id}`}
                data-tab-key={item.id}
                aria-selected={active}
                aria-controls="review-filter-panel"
                tabIndex={tabStopIndex(active)}
                className={`er-filter-chip ${active ? 'active' : ''}`}
                onClick={() => setFilter(item.id)}
                onKeyDown={(event) => handleTabListKeys<ReviewFilterId>(event, setFilter)}
              >
                <span className="er-filter-label">{item.label}</span>
                <span className="er-filter-count">{filterCounts[item.id].toLocaleString()}</span>
              </button>
            )
          })}
        </div>
        <div className="er-controls-row">
          <input
            className="er-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search text, key, or speaker"
            aria-label="Search extracted entries"
          />
          <button className="er-button er-small" onClick={excludeVisible}>Exclude visible</button>
          <button className="er-button er-small" onClick={includeVisible}>Include visible</button>
          <button className="er-button er-small" onClick={() => setSourcesOpen(true)}>Sources ({sources.length.toLocaleString()})</button>
          <button className="er-button er-small" onClick={() => setMappingsOpen(true)}>Context mapping</button>
          <button className="er-button er-small" onClick={() => setDiagnosticsOpen(true)}>Diagnostics ({diagnosticSummary.groups})</button>
        </div>
        <p className="er-showing" aria-live="polite">
          {search.trim()
            ? `Showing ${filteredEntries.length.toLocaleString()} matching entries`
            : `Showing ${filteredEntries.length.toLocaleString()} of ${previewEntries.length.toLocaleString()}`}
        </p>
      </div>

      {toast && <div className="er-toast" role="status">{toast}</div>}

      <div className="er-list-wrap" role="tabpanel" id="review-filter-panel" aria-labelledby={`review-filter-${filter}`}>
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
        {filteredEntries.length === 0 && (
          <div className="er-empty" role="status">
            {search.trim()
              ? 'No entries match your search.'
              : `No entries match ${REVIEW_FILTERS.find((f) => f.id === filter)?.label ?? filter}.`}
          </div>
        )}
      </div>

      <ReviewDialog
        title={`Sources (${sources.length.toLocaleString()})`}
        open={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
      >
        <SourcesPanel
          sources={sources}
          onToggleFile={toggleFile}
          onIncludeAll={() => {
            setExcludedFiles(new Set())
            showToast('All sources included.')
          }}
          onExcludeAll={() => {
            setExcludedFiles(new Set(sources.map((s) => s.path)))
            showToast('All sources excluded.')
          }}
        />
      </ReviewDialog>

      <ReviewDialog
        title={`Diagnostics (${diagnosticSummary.groups} groups)`}
        open={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
      >
        <DiagnosticsPanel groups={diagnosticGroups} summary={diagnosticSummary} />
      </ReviewDialog>

      <ReviewDialog
        title="Context mapping"
        open={mappingsOpen}
        onClose={() => setMappingsOpen(false)}
      >
        <ContextMappingPanel
          onApply={(mappings) => {
            setMappingsOpen(false)
            onApplyMappings(mappings)
          }}
        />
      </ReviewDialog>
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

const EXCLUSION_REASON_LABELS: Record<string, string> = {
  'godot-editor-plugin': 'Editor plugin UI',
  'godot-tool-script': 'Tool script',
  'test-resource': 'Test / demo content',
  'debug-resource': 'Debug content',
  'developer-addon': 'Developer addon',
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
        {entry.excludedByDefault && (
          <span className="er-exclusion-reason" title="Excluded by default">
            {EXCLUSION_REASON_LABELS[entry.exclusionReason ?? ''] ?? 'Developer / editor tooling'}
          </span>
        )}
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
  'ignore',
]

function ContextMappingPanel({ onApply }: { onApply: (mappings: ContextFieldMapping[]) => void }) {
  const [mappings, setMappings] = useState<ContextFieldMapping[]>([])
  const [field, setField] = useState('')
  const [role, setRole] = useState<ContextFieldRole>('translatableText')

  return (
    <div className="er-mapping">
      <p className="er-panel-hint">
        Map source fields to context roles. Fields mapped to <strong>Ignore</strong> produce no
        translation entry and no context. Apply re-runs extraction with the new mapping.
      </p>
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

function SourcesPanel({ sources, onToggleFile, onIncludeAll, onExcludeAll }: {
  sources: Array<{ path: string; count: number; excluded: boolean; audience?: string; exclusionReason?: string }>
  onToggleFile: (path: string) => void
  onIncludeAll: () => void
  onExcludeAll: () => void
}) {
  const [query, setQuery] = useState('')
  const [showTooling, setShowTooling] = useState(false)
  const filtered = sources.filter((s) => {
    if (query.trim() && !s.path.toLowerCase().includes(query.trim().toLowerCase())) return false
    if (!showTooling && (s.audience === 'editor' || s.audience === 'test' || s.audience === 'debug' || s.audience === 'developer')) return false
    return true
  })

  return (
    <div className="er-sources">
      <div className="er-sources-toolbar">
        <input
          className="er-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sources"
          aria-label="Search sources"
        />
        <button className="er-button er-small" onClick={onIncludeAll}>Include all</button>
        <button className="er-button er-small" onClick={onExcludeAll}>Exclude all</button>
        <label className="er-source-toggle">
          <input type="checkbox" checked={showTooling} onChange={(e) => setShowTooling(e.target.checked)} />
          Show editor/developer sources
        </label>
      </div>
      <div className="er-sources-list" role="list">
        {filtered.map((source) => (
          <label key={source.path} className={`er-source-row ${source.excluded ? 'excluded' : ''}`}>
            <input
              type="checkbox"
              checked={!source.excluded}
              onChange={() => onToggleFile(source.path)}
              aria-label={`${source.excluded ? 'Include' : 'Exclude'} ${source.path}`}
            />
            <span className="er-source-path">{source.path}</span>
            {source.audience && source.audience !== 'runtime' && (
              <span className="er-source-audience">{source.audience}</span>
            )}
            <span className="er-source-count">{source.count.toLocaleString()} entries</span>
          </label>
        ))}
        {filtered.length === 0 && <div className="er-empty">No sources match.</div>}
      </div>
    </div>
  )
}

function DiagnosticsPanel({ groups, summary }: {
  groups: Array<{ kind: string; message: string; severity: string; count: number; path?: string; examplePaths: string[] }>
  summary: { groups: number; errors: number; warnings: number; unsupported: number; files: number }
}) {
  return (
    <div className="er-diagnostics-panel">
      <div className="er-diag-summary">
        <span className="er-diag-sum-item er-sev-error">{summary.errors.toLocaleString()} errors</span>
        <span className="er-diag-sum-item er-sev-warning">{summary.warnings.toLocaleString()} warnings</span>
        <span className="er-diag-sum-item er-sev-unsupported">{summary.unsupported.toLocaleString()} unsupported</span>
        <span className="er-diag-sum-item">{summary.groups} groups</span>
      </div>
      {groups.length === 0 && <p className="er-empty">No diagnostics.</p>}
      {groups.map((diagnostic, index) => (
        <details key={index} className={`er-diagnostic er-diag-${diagnostic.kind}`} open={diagnostic.severity === 'error'}>
          <summary className="er-diagnostic-summary">
            <span className={`er-diag-sev er-sev-${diagnostic.severity}`}>{diagnostic.severity}</span>
            <span className="er-diag-kind">{diagnostic.kind}</span>
            <span className="er-diag-message">{diagnostic.message}</span>
            {diagnostic.count > 1 && <span className="er-diag-count">{diagnostic.count.toLocaleString()} files</span>}
          </summary>
          <div className="er-diag-detail">
            {diagnostic.path && <span className="er-diag-path">{diagnostic.path}</span>}
            {diagnostic.examplePaths.length > 0 && (
              <div className="er-diag-examples">
                {diagnostic.examplePaths.map((p) => (
                  <code key={p} className="er-diag-example">{p}</code>
                ))}
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  )
}

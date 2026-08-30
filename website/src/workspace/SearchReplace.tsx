import { useMemo, useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import { useI18n } from '@localizationhub/i18n'

/*
 * Project-wide Search & Replace.
 *
 * All replacements go through the normal project save/history behavior.
 * Replace All requires confirmation and shows the affected entry count first.
 */
export default function SearchReplace({
  entries,
  writable,
  onApply,
  onClose,
}: {
  entries: any[]
  writable: boolean
  onApply: (updates: Array<{ index: number; translation: string }>) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [scope, setScope] = useState<'translation' | 'source' | 'both'>('translation')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const matches = useMemo(() => {
    if (!find) return []
    const needle = caseSensitive ? find : find.toLowerCase()
    const result: Array<{ index: number; field: 'translation' | 'source'; value: string }> = []
    entries.forEach((entry, index) => {
      const fields: Array<'translation' | 'source'> = []
      if (scope === 'translation' || scope === 'both') fields.push('translation')
      if (scope === 'source' || scope === 'both') fields.push('source')
      for (const field of fields) {
        const hay = caseSensitive ? (entry[field] ?? '') : (entry[field] ?? '').toLowerCase()
        if (hay.includes(needle)) result.push({ index, field, value: entry[field] ?? '' })
      }
    })
    return result
  }, [entries, find, scope, caseSensitive])

  function buildUpdates(): Array<{ index: number; translation: string }> {
    const updates: Array<{ index: number; translation: string }> = []
    const seen = new Set<number>()
    for (const match of matches) {
      if (seen.has(match.index)) continue
      seen.add(match.index)
      const entry = entries[match.index]
      if (match.field === 'translation') {
        const next = caseSensitive
          ? entry.translation.split(find).join(replace)
          : entry.translation.replace(new RegExp(escapeRegExp(find), 'gi'), replace)
        updates.push({ index: match.index, translation: next })
      }
    }
    return updates
  }

  function applyAll() {
    if (!writable) return
    const updates = buildUpdates()
    if (updates.length === 0) return
    onApply(updates)
    setConfirming(false)
    onClose()
  }

  const replaceCount = matches.length

  return (
    <div className="dialog-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="dialog dialog-wide" role="dialog" aria-modal="true" aria-label="Search and replace">
        <h2 className="dialog-title">Search &amp; Replace</h2>
        <label className="dialog-field">
          Find
          <input value={find} onChange={(event) => setFind(event.target.value)} autoFocus />
        </label>
        <label className="dialog-field">
          Replace with
          <input value={replace} onChange={(event) => setReplace(event.target.value)} />
        </label>
        <div className="sr-options">
          <label className="dialog-field">
            Scope
            <select value={scope} onChange={(event) => setScope(event.target.value as any)}>
              <option value="translation">Translation</option>
              <option value="source">Source</option>
              <option value="both">Both</option>
            </select>
          </label>
          <label className="sr-checkbox">
            <input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} />
            Case sensitive
          </label>
        </div>
        <p className="dialog-hint" data-i18n-skip>{find ? t('local.matches', { count: replaceCount }) : t('local.enterSearch')}</p>
        <div className="dialog-actions">
          <button className="dialog-button" onClick={onClose}>Close</button>
          <button className="dialog-button dialog-button-danger" disabled={!writable || replaceCount === 0} onClick={() => setConfirming(true)}>
            Replace All
          </button>
        </div>
        {confirming && (
          <ConfirmDialog
            title="Replace all"
            body={t('local.replaceConfirm', { count: replaceCount })}
            confirmLabel="Replace All"
            danger
            onConfirm={applyAll}
            onCancel={() => setConfirming(false)}
          />
        )}
      </div>
    </div>
  )
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

import { useState } from 'react'
import {
  open,
  save,
} from '@tauri-apps/plugin-dialog'
import {
  readTextFile,
  writeTextFile,
} from '@tauri-apps/plugin-fs'
import './App.css'

type TranslationEntry = {
  key: string
  source: string
  translation: string
}

type EntryFilter = 'all' | 'untranslated' | 'translated'

type LocalizationProject = {
  format: 'LocalizationHubProject'
  version: 1
  sourceFileName: string
  selectedKey: string | null
  entries: TranslationEntry[]
}

function App() {
  const [entries, setEntries] = useState<TranslationEntry[]>([])
  const [fileName, setFileName] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [entryFilter, setEntryFilter] = useState<EntryFilter>('all')

  const translatedCount = entries.filter(
    (entry) => entry.translation.trim() !== '',
  ).length

  const untranslatedCount = entries.length - translatedCount

  const progress =
    entries.length === 0
      ? 0
      : Math.round((translatedCount / entries.length) * 100)

  const selectedEntry =
    entries.find((entry) => entry.key === selectedKey) ?? null

  const normalizedSearch = searchQuery.trim().toLowerCase()

  const filteredEntries = entries.filter((entry) => {
    const isTranslated = entry.translation.trim() !== ''

    const matchesSearch =
      !normalizedSearch ||
      entry.key.toLowerCase().includes(normalizedSearch) ||
      entry.source.toLowerCase().includes(normalizedSearch) ||
      entry.translation.toLowerCase().includes(normalizedSearch)

    const matchesFilter =
      entryFilter === 'all' ||
      (entryFilter === 'translated' && isTranslated) ||
      (entryFilter === 'untranslated' && !isTranslated)

    return matchesSearch && matchesFilter
  })

  async function handleOpenFile() {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: 'JSON',
          extensions: ['json'],
        },
      ],
    })

    if (!selected) {
      return
    }

    try {
      const content = await readTextFile(selected)
      const parsed = JSON.parse(content)

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        alert('هذا الملف ليس JSON بالشكل المدعوم حاليًا.')
        return
      }

      const parsedEntries: TranslationEntry[] = Object.entries(parsed)
        .filter(([, value]) => typeof value === 'string')
        .map(([key, value]) => ({
          key,
          source: value as string,
          translation: '',
        }))

      if (parsedEntries.length === 0) {
        alert('لم يتم العثور على نصوص قابلة للترجمة.')
        return
      }

      const normalizedPath = selected.replace(/\\/g, '/')
      const name = normalizedPath.split('/').pop() ?? selected

      setEntries(parsedEntries)
      setFileName(name)
      setSelectedKey(parsedEntries[0].key)
      setSearchQuery('')
      setEntryFilter('all')
    } catch (error) {
      console.error(error)
      alert('فشل تحليل الملف. تأكد أن الملف JSON صالح.')
    }
  }

  async function handleSaveProject() {
    if (entries.length === 0) {
      return
    }

    const baseName =
      fileName.replace(/\.[^/.]+$/, '') || 'localization-project'

    const selectedPath = await save({
      defaultPath: `${baseName}.lhproj`,
      filters: [
        {
          name: 'LocalizationHub Project',
          extensions: ['lhproj'],
        },
      ],
    })

    if (!selectedPath) {
      return
    }

    const project: LocalizationProject = {
      format: 'LocalizationHubProject',
      version: 1,
      sourceFileName: fileName,
      selectedKey,
      entries,
    }

    try {
      const projectContent = JSON.stringify(project, null, 2)

      await writeTextFile(
        selectedPath,
        projectContent,
      )

      alert('تم حفظ المشروع بنجاح.')
    } catch (error) {
      console.error(error)
      alert('فشل حفظ المشروع.')
    }
  }

  async function handleOpenProject() {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: 'LocalizationHub Project',
          extensions: ['lhproj'],
        },
      ],
    })

    if (!selected) {
      return
    }

    try {
      const content = await readTextFile(selected)
      const parsed = JSON.parse(content) as LocalizationProject

      if (
        parsed.format !== 'LocalizationHubProject' ||
        parsed.version !== 1 ||
        !Array.isArray(parsed.entries)
      ) {
        alert('ملف المشروع غير صالح أو غير مدعوم.')
        return
      }

      if (parsed.entries.length === 0) {
        alert('المشروع لا يحتوي على نصوص.')
        return
      }

      const restoredSelectedKey =
        parsed.selectedKey &&
        parsed.entries.some(
          (entry) => entry.key === parsed.selectedKey,
        )
          ? parsed.selectedKey
          : parsed.entries[0].key

      setEntries(parsed.entries)
      setFileName(parsed.sourceFileName)
      setSelectedKey(restoredSelectedKey)
      setSearchQuery('')
      setEntryFilter('all')
    } catch (error) {
      console.error(error)
      alert('فشل فتح المشروع.')
    }
  }

  function handleTranslationChange(key: string, value: string) {
    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.key === key
          ? {
              ...entry,
              translation: value,
            }
          : entry,
      ),
    )
  }

  if (entries.length === 0) {
    return (
      <main className="welcome-screen">
        <div className="welcome-card">
          <div className="brand-mark">LH</div>

          <h1>LocalizationHub</h1>

          <p>
            A collaborative workspace for game localization.
          </p>

          <div className="welcome-actions">
            <button
              className="primary-button"
              type="button"
              onClick={handleOpenFile}
            >
              Open File
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={handleOpenProject}
            >
              Open Project
            </button>

            <button
              className="secondary-button"
              type="button"
            >
              Join Project
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-mark small">
            LH
          </div>

          <div>
            <h1>LocalizationHub</h1>
            <span>{fileName}</span>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="progress-info">
            <span>
              {translatedCount.toLocaleString()} /{' '}
              {entries.length.toLocaleString()}
            </span>

            <strong>{progress}%</strong>
          </div>

          <button
            className="secondary-button"
            type="button"
            onClick={handleSaveProject}
          >
            Save Project
          </button>

          <button
            className="secondary-button"
            type="button"
            onClick={handleOpenFile}
          >
            Open File
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="entries-summary">
              <strong>Entries</strong>

              <span>
                {filteredEntries.length.toLocaleString()} /{' '}
                {entries.length.toLocaleString()}
              </span>
            </div>

            <input
              className="search-input"
              type="text"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              placeholder="Search keys or text..."
            />

            <div className="filter-tabs">
              <button
                type="button"
                className={
                  entryFilter === 'all'
                    ? 'filter-button active'
                    : 'filter-button'
                }
                onClick={() => setEntryFilter('all')}
              >
                All
                <span>{entries.length}</span>
              </button>

              <button
                type="button"
                className={
                  entryFilter === 'untranslated'
                    ? 'filter-button active'
                    : 'filter-button'
                }
                onClick={() => setEntryFilter('untranslated')}
              >
                Untranslated
                <span>{untranslatedCount}</span>
              </button>

              <button
                type="button"
                className={
                  entryFilter === 'translated'
                    ? 'filter-button active'
                    : 'filter-button'
                }
                onClick={() => setEntryFilter('translated')}
              >
                Translated
                <span>{translatedCount}</span>
              </button>
            </div>
          </div>

          <div className="entry-list">
            {filteredEntries.length > 0 ? (
              filteredEntries.map((entry) => {
                const isTranslated =
                  entry.translation.trim() !== ''

                const isSelected =
                  entry.key === selectedKey

                return (
                  <button
                    type="button"
                    key={entry.key}
                    className={`entry-item ${
                      isSelected ? 'selected' : ''
                    }`}
                    onClick={() =>
                      setSelectedKey(entry.key)
                    }
                  >
                    <span
                      className={`status-dot ${
                        isTranslated ? 'translated' : ''
                      }`}
                    />

                    <span className="entry-key">
                      {entry.key}
                    </span>
                  </button>
                )
              })
            ) : (
              <div className="empty-search">
                No matching entries.
              </div>
            )}
          </div>
        </aside>

        <section className="editor-panel">
          {selectedEntry && (
            <>
              <div className="editor-header">
                <span className="editor-label">
                  Key
                </span>

                <h2>{selectedEntry.key}</h2>
              </div>

              <div className="editor-section">
                <label>Source</label>

                <div
                  className="source-text"
                  dir="auto"
                >
                  {selectedEntry.source}
                </div>
              </div>

              <div className="editor-section translation-section">
                <label htmlFor="translation">
                  Translation
                </label>

                <textarea
                  id="translation"
                  dir="auto"
                  value={selectedEntry.translation}
                  onChange={(event) =>
                    handleTranslationChange(
                      selectedEntry.key,
                      event.target.value,
                    )
                  }
                  placeholder="Enter translation..."
                />
              </div>

              <footer className="editor-footer">
                <span>
                  {selectedEntry.translation.trim() !== ''
                    ? 'Translated'
                    : 'Not translated'}
                </span>

                <span>
                  {selectedEntry.translation.length}{' '}
                  characters
                </span>
              </footer>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

export default App
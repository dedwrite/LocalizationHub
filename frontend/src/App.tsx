import { useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { readTextFile } from '@tauri-apps/plugin-fs'
import './App.css'

type TranslationEntry = {
  key: string
  source: string
  translation: string
}

function App() {
  const [entries, setEntries] = useState<TranslationEntry[]>([])
  const [fileName, setFileName] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const translatedCount = entries.filter(
    (entry) => entry.translation.trim() !== '',
  ).length

  const progress =
    entries.length === 0
      ? 0
      : Math.round((translatedCount / entries.length) * 100)

  const selectedEntry =
    entries.find((entry) => entry.key === selectedKey) ?? null

  const normalizedSearch = searchQuery.trim().toLowerCase()

  const filteredEntries = entries.filter((entry) => {
    if (!normalizedSearch) {
      return true
    }

    return (
      entry.key.toLowerCase().includes(normalizedSearch) ||
      entry.source.toLowerCase().includes(normalizedSearch) ||
      entry.translation.toLowerCase().includes(normalizedSearch)
    )
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

      setEntries(parsedEntries)
      setSelectedKey(parsedEntries[0].key)
      setSearchQuery('')

      const normalizedPath = selected.replace(/\\/g, '/')
      const name = normalizedPath.split('/').pop() ?? selected

      setFileName(name)
    } catch (error) {
      console.error(error)
      alert('فشل تحليل الملف. تأكد أن الملف JSON صالح.')
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
            onClick={handleOpenFile}
          >
            Open File
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div>
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
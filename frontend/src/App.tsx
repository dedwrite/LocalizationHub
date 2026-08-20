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

  const translatedCount = entries.filter(
    (entry) => entry.translation.trim() !== '',
  ).length

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

      setEntries(parsedEntries)

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

  return (
    <main>
      <h1>LocalizationHub</h1>

      <p>
        Collaborative localization workspace for game translation teams.
      </p>

      <div>
        <button type="button" onClick={handleOpenFile}>
          Open File
        </button>

        <button type="button">
          Join Project
        </button>
      </div>

      {entries.length > 0 && (
        <section>
          <h2>{fileName}</h2>

          <p>
            Loaded {entries.length.toLocaleString()} translation entries.
          </p>

          <p>
            Translated {translatedCount.toLocaleString()} /{' '}
            {entries.length.toLocaleString()}
          </p>

          <div>
            {entries.slice(0, 50).map((entry) => (
              <div key={entry.key}>
                <h3>{entry.key}</h3>

                <div>
                  <strong>Source</strong>
                  <p>{entry.source}</p>
                </div>

                <div>
                  <strong>Translation</strong>

                  <textarea
                    value={entry.translation}
                    onChange={(event) =>
                      handleTranslationChange(
                        entry.key,
                        event.target.value,
                      )
                    }
                    placeholder="Enter translation..."
                    rows={4}
                  />
                </div>

                <hr />
              </div>
            ))}
          </div>

          {entries.length > 50 && (
            <p>
              Showing the first 50 of{' '}
              {entries.length.toLocaleString()} entries.
            </p>
          )}
        </section>
      )}
    </main>
  )
}

export default App
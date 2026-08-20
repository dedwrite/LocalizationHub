import { useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { readTextFile } from '@tauri-apps/plugin-fs'
import './App.css'

type TranslationEntry = {
  key: string
  value: string
}

function App() {
  const [entries, setEntries] = useState<TranslationEntry[]>([])
  const [fileName, setFileName] = useState('')

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
          value: value as string,
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

          <div>
            {entries.slice(0, 50).map((entry) => (
              <div key={entry.key}>
                <strong>{entry.key}</strong>
                <p>{entry.value}</p>
                <hr />
              </div>
            ))}
          </div>

          {entries.length > 50 && (
            <p>
              Showing the first 50 entries.
            </p>
          )}
        </section>
      )}
    </main>
  )
}

export default App
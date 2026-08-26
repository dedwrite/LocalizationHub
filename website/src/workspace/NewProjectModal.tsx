import { useRef, useState } from 'react'

/*
 * Branded New Project modal replacing window.prompt.
 *
 * Supports creating an empty Cloud Project and, where a local file is chosen,
 * importing JSON/CSV/PO into a new Cloud Project.
 */
export default function NewProjectModal({
  onClose,
  onCreate,
  onImport,
}: {
  onClose: () => void
  onCreate: (name: string) => Promise<void>
  onImport: (name: string, file: File) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter a project name.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (file) await onImport(trimmed, file)
      else await onCreate(trimmed)
      onClose()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not create the project.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="dialog dialog-wide" role="dialog" aria-modal="true" aria-label="New project">
        <h2 className="dialog-title">New project</h2>
        <form onSubmit={submit}>
          <label className="dialog-field">
            Project name
            <input ref={inputRef} value={name} onChange={(event) => setName(event.target.value)} autoFocus placeholder="My localization project" />
          </label>
          <label className="dialog-field">
            Import a file (optional)
            <input type="file" accept=".json,.csv,.po,.pot" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <p className="dialog-hint">
            {file ? `Will import ${file.name} into a new Cloud Project.` : 'Creates an empty Cloud Project you can fill in later.'}
          </p>
          {error && <p className="dialog-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="dialog-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="dialog-button dialog-button-primary" disabled={busy || !name.trim()}>
              {busy ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

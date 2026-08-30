import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@localizationhub/i18n'
import './ProjectDeleteDialog.css'

/** Shared Web/Desktop confirmation. Only calls the supplied Cloud operation
 * after an exact-name match; errors leave both the dialog and project intact.
 */
export default function ProjectDeleteDialog({ name, onDelete, onDeleted, onCancel }: {
  name: string; onDelete: () => Promise<void>; onDeleted: () => void; onCancel: () => void
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => { const element = ref.current; element?.showModal(); return () => { element?.close() } }, [])
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy || confirmation !== name) return
    setBusy(true); setFailed(false)
    try { await onDelete(); onDeleted() }
    catch { setFailed(true); setBusy(false) }
  }
  return <dialog ref={ref} className="project-delete-dialog" aria-labelledby="project-delete-title" aria-describedby="project-delete-description" data-i18n-skip onKeyDown={(event) => event.stopPropagation()} onCancel={(event) => { event.preventDefault(); if (!busy) onCancel() }}>
    <form onSubmit={submit}>
      <h2 id="project-delete-title">{t('delete.title', { name })}</h2>
      <p id="project-delete-description">{t('delete.warning')}</p>
      <p>{t('delete.localSafe')}</p>
      <label>{t('delete.typeName')}<input autoFocus autoComplete="off" spellCheck={false} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} dir="auto" /></label>
      <p className="project-delete-name"><bdi>{name}</bdi></p>
      {failed && <p role="alert">{t('delete.failed')}</p>}
      <div className="project-delete-actions"><button type="button" onClick={onCancel} disabled={busy}>{t('common.actions.cancel')}</button><button className="project-delete-danger" type="submit" disabled={busy || confirmation !== name}>{t(busy ? 'delete.busy' : 'delete.permanently')}</button></div>
    </form>
  </dialog>
}

export function ProjectDangerZone({ onDelete }: { onDelete: () => void }) {
  const { t } = useI18n()
  return <section className="project-danger-zone" data-i18n-skip><h3>{t('delete.dangerZone')}</h3><button type="button" className="project-delete-danger" onClick={onDelete}>{t('delete.project')}</button></section>
}

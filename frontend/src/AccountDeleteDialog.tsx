import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@localizationhub/i18n'
import './AccountDeleteDialog.css'

/** Shared Web/Desktop confirmation for self-service account deletion. The
 * account address has to be typed back, owned Cloud Projects have to be
 * acknowledged, and nothing is sent until both are true. A failed request
 * leaves the account and the dialog exactly as they were. */
export default function AccountDeleteDialog({ email, ownedProjects, onDelete, onDeleted, onCancel }: {
  email: string; ownedProjects: number; onDelete: (deleteOwnedProjects: boolean) => Promise<void>; onDeleted: () => void; onCancel: () => void
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const [confirmation, setConfirmation] = useState('')
  const [includeProjects, setIncludeProjects] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<'failed' | 'projects' | null>(null)
  /* A modal focuses its first control on open, which is the projects checkbox
   * when the account owns any; the typed confirmation is the step that
   * matters, so focus lands there instead. */
  useEffect(() => { const element = ref.current; element?.showModal(); emailRef.current?.focus(); return () => { element?.close() } }, [])
  const typed = confirmation.trim().toLowerCase() === email.trim().toLowerCase()
  const ready = typed && (ownedProjects === 0 || includeProjects)
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy || !ready) return
    setBusy(true); setFailure(null)
    try { await onDelete(ownedProjects > 0 ? includeProjects : false); onDeleted() }
    catch (error) { setFailure((error as { code?: string })?.code === 'user-has-projects' ? 'projects' : 'failed'); setBusy(false) }
  }
  return <dialog ref={ref} className="account-delete-dialog" aria-labelledby="account-delete-title" aria-describedby="account-delete-description" data-i18n-skip onKeyDown={(event) => event.stopPropagation()} onCancel={(event) => { event.preventDefault(); if (!busy) onCancel() }}>
    <form onSubmit={submit}>
      <h2 id="account-delete-title">{t('accountDelete.title')}</h2>
      <p id="account-delete-description">{t('accountDelete.warning')}</p>
      <p>{t('accountDelete.localSafe')}</p>
      {ownedProjects > 0 && <label className="account-delete-include"><input type="checkbox" checked={includeProjects} onChange={(event) => setIncludeProjects(event.target.checked)} disabled={busy} /><span>{t('accountDelete.includeProjects')}</span></label>}
      {ownedProjects > 0 && <p className="account-delete-count">{t('accountDelete.projects', { count: ownedProjects })}</p>}
      <label>{t('accountDelete.typeEmail')}<input ref={emailRef} autoComplete="off" spellCheck={false} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} dir="auto" /></label>
      <p className="account-delete-email"><bdi>{email}</bdi></p>
      {failure && <p role="alert">{t(failure === 'projects' ? 'accountDelete.staleProjects' : 'accountDelete.failed')}</p>}
      <div className="account-delete-actions"><button type="button" onClick={onCancel} disabled={busy}>{t('common.actions.cancel')}</button><button className="account-delete-danger" type="submit" disabled={busy || !ready}>{t(busy ? 'accountDelete.busy' : 'accountDelete.permanently')}</button></div>
    </form>
  </dialog>
}

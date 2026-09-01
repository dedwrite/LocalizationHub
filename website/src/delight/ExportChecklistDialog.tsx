import { useEffect, useRef } from 'react'
import { useI18n, type MessageKey } from '@localizationhub/i18n'
import type { ExportChecklist } from './exportChecklist'

const LABELS: Record<string, MessageKey> = {
  coverage: 'quiet.checkCoverage',
  empty: 'quiet.checkEmpty',
  tokens: 'quiet.checkTokens',
  length: 'quiet.checkLength',
  review: 'quiet.checkReview',
  glossary: 'quiet.checkGlossary',
}

export default function ExportChecklistDialog({
  checklist,
  onExport,
  onCancel,
}: {
  checklist: ExportChecklist
  onExport: () => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => { dialog?.close() }
  }, [])

  return (
    <dialog ref={dialogRef} className="dialog native-confirm-dialog export-checklist-dialog" role="alertdialog" aria-labelledby="export-checklist-title" data-i18n-skip>
      <h2 id="export-checklist-title" className="dialog-title">{t('quiet.exportChecklistTitle')}</h2>
      <p className="dialog-body">{t(checklist.ready ? 'quiet.exportChecklistReady' : 'quiet.exportChecklistBody')}</p>
      <ul className="export-checklist">
        {checklist.items.map((item) => (
          <li key={item.id} data-severity={item.severity}>
            <span>{t(LABELS[item.id] ?? 'quiet.checkCoverage')}</span>
            <strong>{item.count}</strong>
          </li>
        ))}
      </ul>
      <div className="dialog-actions">
        <button className="dialog-button" onClick={onCancel}>{t('common.actions.cancel')}</button>
        <button className="dialog-button dialog-button-primary" autoFocus onClick={onExport}>
          {t('quiet.exportAnyway')}
        </button>
      </div>
    </dialog>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '@localizationhub/i18n'
import type { LocalizationProjectV3 } from '@localizationhub/core'
import { importLocalFile, loadLocalProjects, deleteLocalProject, normalizeLocalProject, projectFromLocalDocument } from './localProjects'
import { navigate } from './navigation'
import Workspace from './workspace/Workspace'
import ConfirmDialog from './workspace/ConfirmDialog'
import { localWorkspaceStorage } from './workspace/storage'
import './workspace-tools.css'

type LocalRow = { id: string; value: any; savedAt: string }
type OpenLocal = { id: string; project: LocalizationProjectV3; savedAt?: string }
const localUser = { id: '', username: '' }
const fileNameOf = (row: LocalRow) => row.value?.sourceFileName || row.id.slice(0, row.id.lastIndexOf(':')) || row.id

export default function LocalWorkspace() {
  const { t } = useI18n()
  const [opened, setOpened] = useState<OpenLocal | null>(null)
  const [notice, setNotice] = useState('')
  const [recent, setRecent] = useState<LocalRow[]>([])
  const [deleting, setDeleting] = useState<LocalRow | null>(null)
  const storage = useMemo(() => opened ? localWorkspaceStorage(opened.id, opened.project, opened.savedAt) : undefined, [opened])
  function refresh() { loadLocalProjects().then(setRecent).catch(() => setNotice(t('local.storageUnavailable'))) }
  useEffect(refresh, [])
  async function openFile(file: File) {
    try {
      const parsed = importLocalFile(await file.text(), file.name)
      if (!parsed.ok) throw new Error(parsed.reason)
      setOpened({ id: crypto.randomUUID(), project: projectFromLocalDocument(parsed.document, file.name) })
      setNotice('')
    } catch { setNotice(t('local.openFailed')) }
  }
  function openSaved(row: LocalRow) {
    try { setOpened({ id: row.id, project: normalizeLocalProject(row.value, fileNameOf(row)), savedAt: row.savedAt }); setNotice('') }
    catch { setNotice(t('local.openFailed')) }
  }
  async function removeCopy() {
    if (!deleting) return
    try { await deleteLocalProject(deleting.id); setDeleting(null); refresh(); setNotice(t('local.deleted')) }
    catch { setDeleting(null); setNotice(t('local.deleteFailed')) }
  }
  if (opened && storage) return <Workspace key={opened.id} storage={storage} user={localUser} onHome={() => { setOpened(null); refresh() }} />
  return <main className="local-page local-home" data-i18n-skip>
    <header className="local-header">
      <button className="local-brand" onClick={() => navigate('/')}><img src="/localizationhub-logo.jpg" alt="" /><span>LocalizationHub<small>{t('local.browserProject')}</small></span></button>
      <nav className="app-context-nav local-context-nav" aria-label={t('projects.context')}><button onClick={() => navigate('/app/projects')}><span>{t('projects.cloud')}</span><small>{t('projects.collaborative')}</small></button><button className="active" aria-current="page"><span>{t('projects.local')}</span><small>{t('projects.onDevice')}</small></button></nav>
    </header>
    <section className="local-drop">
      <div className="local-intro"><p className="app-kicker">{t('local.noAccount')}</p><h1>{t('local.title')}</h1><p>{t('local.description')}</p><div className="local-trust-row"><span>{t('local.onDevice')}</span><span>{t('local.offline')}</span><span>{t('local.explicitExport')}</span></div></div>
      <div className="local-open-panel"><span className="local-panel-index">{t('local.openStep')}</span><div className="local-file-graphic" aria-hidden="true"><i /><i /><i /></div><h2>{t('local.openFile')}</h2><p>{t('local.formats')}</p><label className="file-button">{t('local.choose')}<input type="file" accept=".json,.csv,.po,.pot" onChange={(event) => { const file = event.target.files?.[0]; if (file) void openFile(file); event.target.value = '' }} /></label><small>{t('local.notUploaded')}</small></div>
      {notice && <div className="notice" role="status">{notice}</div>}
      {recent.length > 0 ? <div className="recent-local"><div className="recent-local-heading"><div><span>{t('local.recentDevice')}</span><strong>{t('local.recent')}</strong></div><small>{t('local.storedDevice')}</small></div>{recent.map((row) => <div className="recent-local-row" key={row.id}><button aria-label={fileNameOf(row)} onClick={() => openSaved(row)}><strong><bdi>{fileNameOf(row)}</bdi></strong><span>{t('local.entryCount', { count: row.value?.entries?.length ?? 0 })}</span></button><button onClick={() => setDeleting(row)}>{t('local.deleteCopy')}</button></div>)}</div> : <div className="local-tip"><span>{t('projects.didYouKnow')}</span><p>{t('projects.tokensChecked')}</p></div>}
    </section>
    {deleting && <ConfirmDialog title={t('local.deleteCopy')} body={t('local.deleteExplanation')} confirmLabel={t('local.deleteCopy')} cancelLabel={t('common.actions.cancel')} danger onConfirm={() => { void removeCopy() }} onCancel={() => setDeleting(null)} />}
  </main>
}

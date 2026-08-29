import { useEffect, useState } from 'react'
import { exportLocalFile, importLocalFile, loadLocalProjects, deleteLocalProject, saveLocalProject } from './localProjects'
import { projectStats, tokenWarnings } from './appApi'
import { navigate } from './navigation'
import './workspace-tools.css'

function LocalHeader({ projectLabel, onFiles }: { projectLabel?: string; onFiles?: () => void }) {
  return <header className="local-header">
    <button className="local-brand" onClick={onFiles ?? (() => navigate('/'))}><img src="/localizationhub-logo.jpg" alt="" /><span>LocalizationHub<small>{projectLabel || 'LOCAL BROWSER PROJECT'}</small></span></button>
    <nav className="app-context-nav local-context-nav" aria-label="Project context"><button onClick={() => navigate('/app/projects')}><span>Cloud</span><small>Collaborative</small></button><button className="active" aria-current="page" onClick={onFiles}><span>Local</span><small>On this device</small></button></nav>
  </header>
}

export default function LocalWorkspace() {
  const [project, setProject] = useState<any>(null)
  const [fileName, setFileName] = useState('')
  const [selected, setSelected] = useState(0)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [recent, setRecent] = useState<any[]>([])
  useEffect(() => { loadLocalProjects().then(setRecent).catch(() => setNotice('Browser storage is unavailable. Your work will not be recovered.')) }, [])
  async function openFile(file: File) { try { const parsed = importLocalFile(await file.text(), file.name); if (!parsed.ok) throw new Error(parsed.reason); setProject(parsed.document); setFileName(file.name); setNotice('Imported locally. Nothing was uploaded.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not parse this file.') } }
  function updateTranslation(value: string) { setProject((current: any) => { const next = structuredClone(current); next.entries[selected].translation = value; return next }) }
  async function saveLocally() { if (!project) return; await saveLocalProject(`${fileName}:${project.parser}`, project); setRecent(await loadLocalProjects()); setNotice('Saved to this browser.') }
  function exportFile() { if (!project) return; const blob = new Blob([exportLocalFile(project)], { type: 'text/plain' }); const link = globalThis.document.createElement('a'); const url = URL.createObjectURL(blob); link.href = url; link.download = fileName; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) }
  async function removeRecent(id: string) { await deleteLocalProject(id); setRecent(await loadLocalProjects()); setNotice('Browser copy deleted.') }
  if (!project) return <main className="local-page local-home">
    <LocalHeader />
    <section className="local-drop">
      <div className="local-intro"><p className="app-kicker">LOCAL PROJECTS / NO ACCOUNT REQUIRED</p><h1>Translate privately<br />in your browser.</h1><p>Open a localization file without uploading it. Your work stays on this device until you explicitly choose a Cloud Project.</p><div className="local-trust-row"><span>ON-DEVICE</span><span>OFFLINE-CAPABLE</span><span>EXPLICIT EXPORT</span></div></div>
      <div className="local-open-panel"><span className="local-panel-index">01 / OPEN A FILE</span><div className="local-file-graphic" aria-hidden="true"><i /><i /><i /></div><h2>Start with the file you already have.</h2><p>JSON, CSV, gettext PO, and POT are parsed locally in your browser.</p><label className="file-button">Choose JSON, CSV, or PO<input type="file" accept=".json,.csv,.po,.pot" onChange={event => event.target.files?.[0] && openFile(event.target.files[0])} /></label><small>Nothing is uploaded by this action.</small></div>
      {notice && <div className="notice">{notice}</div>}
      {recent.length > 0 ? <div className="recent-local"><div className="recent-local-heading"><div><span>RECENT / THIS BROWSER</span><strong>Recent browser projects</strong></div><small>Stored only on this device</small></div>{recent.map(item => <div className="recent-local-row" key={item.id}><button aria-label={item.id} onClick={() => { setProject(item.value); setFileName(item.id.split(':')[0]) }}><strong>{item.id.split(':')[0]}</strong><span>{item.value?.entries?.length ?? 0} entries · {item.id.split(':')[1]?.toUpperCase() || 'LOCAL'}</span></button><button onClick={() => removeRecent(item.id)} aria-label={`Delete ${item.id}`}>Delete</button></div>)}</div> : <div className="local-tip"><span>DID YOU KNOW?</span><p>Protected tokens are checked before export, even in Local Projects.</p></div>}
    </section>
  </main>
  const filtered = project.entries.map((entry: any, index: number) => ({ entry, index })).filter(({ entry }: any) => `${entry.key} ${entry.source} ${entry.translation}`.toLowerCase().includes(query.toLowerCase()))
  const entry = project.entries[selected]
  const warnings = tokenWarnings(entry?.source ?? '', entry?.translation ?? '')
  const stats = projectStats({ entries: project.entries, workflow: { entries: {} } })
  return <main className="local-page local-editor-page"><LocalHeader projectLabel={`${fileName} · ${stats.translationCompletion}% translated`} onFiles={() => setProject(null)} /><div className="local-editor-actions"><button onClick={() => setProject(null)}>← Files</button><span>LOCAL / {fileName}</span><div><button onClick={saveLocally}>Save locally</button><button className="primary-button" onClick={exportFile}>Export</button></div></div>{notice && <div className="notice">{notice}</div>}<div className="local-layout"><aside className="entries-panel"><input className="search-input" type="search" name="local-entry-search" role="searchbox" spellCheck={false} enterKeyHint="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search local entries" aria-label="Search local entries" />{filtered.map(({ entry: item, index }: any) => <button className={`entry-row ${index === selected ? 'selected' : ''}`} key={item.id} onClick={() => setSelected(index)}><span>{item.key || item.id}</span><strong>{item.translation || 'Untranslated'}</strong></button>)}</aside><section className="translation-panel"><label>Source<input value={entry?.source ?? ''} readOnly /></label><label>Translation<textarea value={entry?.translation ?? ''} onChange={event => updateTranslation(event.target.value)} aria-label="Translation" /></label>{warnings.length > 0 && <div className="quality-warning">{warnings.length} protected token issue(s)</div>}<div className="entry-navigation"><button onClick={() => setSelected(Math.max(0, selected - 1))} disabled={selected === 0}>← Previous</button><button onClick={() => setSelected(Math.min(project.entries.length - 1, selected + 1))} disabled={selected === project.entries.length - 1}>Next →</button></div></section></div></main>
}

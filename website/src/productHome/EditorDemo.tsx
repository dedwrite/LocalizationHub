import React, { useEffect, useRef, useState } from 'react'
import { useI18n } from '@localizationhub/i18n'
import { IconButton, StatusBadge } from '@localizationhub/ui'
import { demoEntries } from './demoModel'
import { useDemoStory } from './useDemoStory'

function TokenText({text}: {text: string}) {
  return <>{text.split(/(\{player_name\})/g).map((part, i) => part === '{player_name}' ? <bdi dir="ltr" key={i}>{part}</bdi> : <React.Fragment key={i}>{part}</React.Fragment>)}</>
}
export default function EditorDemo() {
  const {t} = useI18n()
  const root = useRef<HTMLElement>(null)
  const [reducedMotion, setReducedMotion] = useState(true)
  const [visible, setVisible] = useState(false)
  const [editing, setEditing] = useState(false)
  const [ready, setReady] = useState(false)
  const story = useDemoStory({reducedMotion, visible})
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync(); setReady(true)
    media.addEventListener('change', sync)
    const visibility = () => setVisible(document.visibilityState === 'visible' && inView)
    let inView = true
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; visibility() }, {threshold: .1})
    if (root.current) observer.observe(root.current)
    document.addEventListener('visibilitychange', visibility)
    visibility()
    return () => { observer.disconnect(); media.removeEventListener('change', sync); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  const started = useRef(false)
  useEffect(() => { if (ready && !reducedMotion && !started.current) { started.current = true; story.start() } }, [ready, reducedMotion, story.start])
  const result = story.result
  const status = !result ? t('home.pending') : !result.valid ? t('home.invalid') : story.entry.source.includes('{player_name}') ? t('home.preserved') : t('home.noTokens')
  const stageKey = {select: 'home.selectStage', translate: 'home.translateStage', validate: 'home.validateStage'} as const
  return <section ref={root} id="home-editor" className="home-editor" aria-label={t('home.demo')} data-stage={story.stage} data-paused={story.paused} data-ready={ready} data-visible={visible}>
    <div className="home-stage" aria-hidden="true"><span key={story.stage}>{t(stageKey[story.stage])}</span></div>
    <div className="demo-chrome"><div><img src="/product-home/saved.svg" alt="" /><bdi dir="ltr">northern_gate.json</bdi><span className="demo-count">{t('home.count', {count: demoEntries.length})}</span></div><div><bdi dir="ltr">EN → AR</bdi><StatusBadge tone={result?.valid ? 'success' : 'neutral'}>{result?.valid ? t('home.valid') : t('home.local')}</StatusBadge></div></div>
    <div className="demo-body">
      <aside className="demo-rail" aria-label={t('home.strings')}><div className="demo-rail-title"><span>{t('home.strings')}</span><span>{demoEntries.length.toString().padStart(2, '0')}</span></div>
        <div className="demo-entries">{demoEntries.map((entry, index) => <button type="button" key={entry.id} aria-pressed={story.entry.id === entry.id} onClick={() => {story.selectEntry(entry.id); setEditing(false)}}><span className="demo-number">{(index + 1).toString().padStart(2, '0')}</span><bdi dir="ltr" className="demo-id">{entry.id}</bdi><img src={`/product-home/${index === 0 ? 'warning' : index === 4 ? 'error' : 'success'}.svg`} alt="" /><span dir="ltr" className="demo-excerpt">{entry.source.split('. ')[0]}</span></button>)}</div>
      </aside>
      <div className="demo-content">
        <p className="demo-context">{t(story.entry.id === 'quest.northern_gate' ? 'home.context' : 'home.example')}</p>
        <div className="demo-source"><h2>{t('home.source')}</h2><p dir="ltr"><TokenText text={story.entry.source} /></p></div>
        <div className="demo-translation"><label htmlFor="demo-target">{t('home.arabic')}</label><div className="demo-target-wrap" data-editing={editing}>
          <p className="demo-target-display" dir="rtl" aria-hidden="true" data-reveal={story.stage !== 'select'}><TokenText text={story.translation} /></p>
          <textarea id="demo-target" disabled={!ready} dir="rtl" lang="ar" spellCheck={false} value={story.translation} onFocus={() => {story.pause(); setEditing(true)}} onBlur={() => setEditing(false)} onChange={event => story.editTranslation(event.target.value)} onKeyDown={event => {if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {event.preventDefault(); story.validate()}}} />
        </div></div>
        <div className="demo-qa" data-result={result?.valid ? 'valid' : result ? 'invalid' : 'pending'}><div key={status}><img src={`/product-home/${result?.valid ? 'success' : result ? 'error' : 'pending'}.svg`} alt="" /><span>{status}</span></div><button type="button" onClick={story.validate}>{t('home.validate')}<span aria-hidden="true"> ↵</span></button></div>
        <p className="demo-announcement" role="status">{story.manual && result ? status : ''}</p>
        <div className="demo-bottom"><ol className="demo-workflow">{(['home.source', 'home.translate', 'home.validate', 'home.export'] as const).map((key, i) => <li key={key} data-active={i === ['select', 'translate', 'validate'].indexOf(story.stage)}>{t(key)}</li>)}</ol><IconButton label={story.paused ? t('home.replay') : t('home.pause')} onClick={story.paused ? story.replay : story.pause}>{story.paused ? '↻' : 'Ⅱ'}</IconButton></div>
        {result?.valid && <span className="demo-ready">{t('home.ready')}</span>}
      </div>
    </div>
  </section>
}

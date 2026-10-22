import {useState} from 'react'
import {useI18n} from '@localizationhub/i18n'
import {validateProtectedTokens} from '@localizationhub/core/tokens'
import {IconButton} from '@localizationhub/ui'
import Icon from '../components/Icon'
import {FridayClock} from '../delight/LittleSecrets'
import {useProductStory} from './useProductStory'

export function Dot({name = 'chip-dot'}: {name?: string}) {return <img src={`/product-details/${name}.svg`} alt="" />}
function StoryControl({story, onReplay}: {story: ReturnType<typeof useProductStory>; onReplay?: () => void}) {
  const {t} = useI18n()
  return <IconButton label={t(story.paused ? 'product.replay' : 'product.pause')} onClick={() => {if(story.paused) {onReplay?.(); story.replay()} else story.takeOver()}}><Icon name={story.paused ? 'refresh' : 'pause'} size={14} /></IconButton>
}
export function ContextDemo() {
  const {t} = useI18n(), story = useProductStory()
  return <div ref={story.root} className="pd-context" data-phase={story.phase} data-visible={story.visible}>
    <article id="arabic" aria-label={t('website.context.illustrative')}>
      <div className="pd-panel-top"><small dir="ltr">quest.last_broadcast</small><FridayClock hidden /></div>
      <div className="pd-context-fields">{([
        ['website.context.speaker','website.context.speakerMira'],
        ['website.context.scene','website.context.sceneRelay'],
        ['website.context.listener','website.context.listenerPlayer'],
      ] as const).map(([label,value],i) => <div key={label} data-focused={story.phase === i}><small>{t(label)}</small><strong><Dot name="micro-dot" />{t(value)}</strong></div>)}</div>
      <div className="pd-line-block"><small>{t('home.source')}</small><p className="pd-dialogue" dir="ltr">Stay on this frequency, <mark><bdi dir="ltr">{'{player_name}'}</bdi></mark>. I can hear you through the static.</p></div>
      <div className="pd-line-block"><small>{t('home.arabic')}</small><p className="pd-arabic" dir="rtl" lang="ar">ابقَ على هذا التردد يا <mark><bdi dir="ltr">{'{player_name}'}</bdi></mark>؛ أسمع صوتك وسط <span>التشويش</span>.</p></div>
    </article>
    <div className="pd-demo-note"><span><Dot name="note-dot" />{t('product.context.note')}</span><StoryControl story={story} /></div>
  </div>
}
export function TokenDemo() {
  const {t} = useI18n(), story = useProductStory()
  const [value, setValue] = useState('ابقَ على هذا التردد يا {player_name}.')
  const [editing, setEditing] = useState(false)
  const validation = validateProtectedTokens('Stay on this frequency, {player_name}.', value, 'generic')
  const valid = Boolean(value.trim()) && !validation.hasErrors && !validation.hasWarnings
  const phase = story.paused ? 2 : story.phase
  const result = phase === 0 ? 'product.tokens.inspect' : phase === 1 ? 'product.tokens.checking' : valid ? 'home.preserved' : 'home.invalid'
  return <div ref={story.root} className="pd-panel pd-token" data-valid={valid} data-phase={phase} data-visible={story.visible}>
    <small>{t('home.source')}</small><p className="pd-dialogue" dir="ltr">Stay on this frequency, <mark><bdi dir="ltr">{'{player_name}'}</bdi></mark>.</p>
    <label htmlFor="product-target">{t('home.arabic')}</label>
    <div className="pd-target-wrap" data-editing={editing}>
      <div className="pd-target-display" dir="rtl" lang="ar" aria-hidden="true">{value.split(/(\{player_name\})/g).map((part,i) => part === '{player_name}' ? <bdi key={i} dir="ltr">{part}</bdi> : <span key={i}>{part}</span>)}</div>
      <textarea id="product-target" dir="rtl" lang="ar" value={value} spellCheck={false} onFocus={() => {story.takeOver(); setEditing(true)}} onBlur={() => setEditing(false)} onChange={event => {story.takeOver(); setValue(event.target.value)}} />
    </div>
    <div className="pd-token-path" aria-hidden="true"><code>{'{player_name}'}</code><span /><Dot name={valid && phase === 2 ? 'valid-dot' : 'note-dot'} /></div>
    <div className="pd-demo-note"><div className="pd-result" role="status" aria-live={story.paused ? 'polite' : 'off'} data-pending={phase < 2}><Dot name={valid && phase === 2 ? 'valid-dot' : 'note-dot'} /><span key={result}>{t(result)}</span></div><StoryControl story={story} /></div>
  </div>
}
export function LocalDemo() {
  const {t} = useI18n(), story = useProductStory(4)
  return <div ref={story.root} className="pd-panel pd-local" data-phase={story.phase} data-visible={story.visible} data-paused={story.paused}>
    <ol className="pd-local-path">{(['product.file','product.editor','product.qa','home.export'] as const).map((key, i) => <li key={key} data-complete={i <= story.phase} data-active={i === story.phase} data-passed={i < story.phase}><Dot name={i <= story.phase ? 'flow-node0' : 'flow-node2'} /><strong>{t(key)}</strong><span>{i === 0 ? 'JSON / CSV / PO' : i === 1 ? t('product.browser') : i === 2 ? t('product.tokens.label') : t('product.local.export')}</span></li>)}</ol>
    <div className="pd-demo-note"><span>{t('home.localNote')}</span><StoryControl story={story} /></div>
  </div>
}
export function ExtractionDemo() {
  const {t} = useI18n(), story = useProductStory()
  return <div ref={story.root} className="pd-panel pd-extract" data-phase={story.phase} data-visible={story.visible}>
    <div className="pd-panel-top"><span><Dot />{t('website.extraction.gameFolder')}</span><span>{t('product.extract.platform')}</span></div>
    <ol className="pd-scan-steps">{(['website.extraction.gameFolder','website.extraction.scan','website.extraction.review','common.labels.project'] as const).map((key,i) => <li key={key} data-active={i === (story.phase < 2 ? 1 : 2)}>{t(key)}</li>)}</ol>
    <div className="pd-scan-box" dir="ltr"><span className="pd-scan-beam" aria-hidden="true" />{['Game/Content/Dialogues/last_broadcast.json','Game/Localization/UI/menu.csv','Game/Content/Items/items.po','Game/Config/settings.ini'].map((path,i) => <code key={path} data-found={i < story.phase + 1}><span>{path}</span></code>)}</div>
    <div className="pd-demo-note"><span><Dot />{t('product.extract.found', {count: story.phase + 1})}</span><StoryControl story={story} /></div>
    <small>{t('product.extract.example')}</small>
  </div>
}
export function ReviewDemo() {
  const {t} = useI18n(), story = useProductStory(4)
  const [comment, setComment] = useState<boolean | null>(null)
  const [status, setStatus] = useState<number | null>(null)
  const states = ['product.review.draft', 'product.review.translated', 'workspace.needsReview', 'workspace.approved'] as const
  const active = status ?? story.phase
  const expanded = comment ?? story.phase > 0
  return <div ref={story.root} className="pd-panel pd-review" data-phase={story.phase} data-visible={story.visible}>
    <div className="pd-tabs" role="group" aria-label={t('product.review.label')}>{states.map((key,i) => <button key={key} type="button" aria-pressed={active === i} onClick={() => {story.takeOver(); setStatus(i)}}>{t(key)}</button>)}</div>
    <small dir="ltr">quest.last_broadcast</small><p className="pd-dialogue" dir="ltr">{'Stay on this frequency, {player_name}. I can hear you through the static.'}</p><p className="pd-arabic" dir="rtl" lang="ar">ابقَ على هذا التردد يا <bdi dir="ltr">{'{player_name}'}</bdi>؛ أسمع صوتك وسط <span>التشويش</span>.</p>
    <p className="pd-assignee"><Dot name="assignee-dot" />{t('product.review.assignee')}</p>
    <button type="button" className="pd-comment-toggle" aria-expanded={expanded} onClick={() => {story.takeOver(); setComment(!expanded)}}>{t('workspace.comments')}</button>
    <div className="pd-comment-space"><p className="pd-comment" data-open={expanded} aria-hidden={!expanded}>{t('product.review.comment')}</p></div>
    <div className="pd-demo-note"><small>{t('product.review.version')}</small><button type="button" onClick={() => {story.select(0); setStatus(0); setComment(false)}}>{t('product.review.restore')}</button></div>
    <small>{t('product.review.example')}</small><div className="pd-control"><StoryControl story={story} onReplay={() => {setStatus(null); setComment(null)}} /></div>
  </div>
}
export function MemoryDemo() {
  const {t} = useI18n(), story = useProductStory()
  const [tab, setTab] = useState<string | null>(null), [used, setUsed] = useState(false)
  const activeTab = tab ?? (story.phase === 2 ? 'tm' : 'glossary')
  return <div ref={story.root} className="pd-panel pd-memory" data-phase={story.phase} data-visible={story.visible}>
    <div className="pd-tabs" role="group" aria-label={t('product.memory.label')}>{(['glossary','tm'] as const).map(key => <button key={key} type="button" aria-pressed={activeTab === key} onClick={() => {story.takeOver(); setTab(key)}}>{t(`product.memory.${key}`)}</button>)}</div>
    <div className="pd-term-space"><div className="pd-term" data-emphasis={activeTab === 'glossary'}><span dir="ltr">Relay Station</span><Icon name="arrow-up-right" /><span dir="rtl" lang="ar">{'محطة الاتصال'}</span></div><small>{t('product.memory.term')}</small></div>
    <div className="pd-suggestion" data-emphasis={activeTab === 'tm'}><strong><Dot />{t('product.memory.match')}</strong><p dir="ltr">{'The Relay Station is transmitting again.'}</p><p dir="rtl" lang="ar">{'عادت محطة الاتصال إلى البث.'}</p><button type="button" onClick={() => {story.takeOver(); setUsed(true)}} disabled={used}>{t('product.memory.use')}</button></div>
    <div className="pd-applied-space"><p className="pd-applied" data-open={used} aria-hidden={!used} role="status">{t('product.memory.used')}</p></div>
    <div className="pd-demo-note"><small>{t('product.memory.note')}</small><StoryControl story={story} onReplay={() => {setTab(null); setUsed(false)}} /></div>
  </div>
}

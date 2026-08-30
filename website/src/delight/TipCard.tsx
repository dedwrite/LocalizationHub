import { useState } from 'react'
import { useI18n } from '@localizationhub/i18n'
import { shuffledTips, setTipsHidden, tipDecks, tipsHidden, type TipContext } from './tips'

export default function TipCard({ context }: { context: TipContext }) {
  // A changed context starts a new deck. Entry changes and locale changes do not.
  return <TipDeck key={context} context={context} />
}

function TipDeck({ context }: { context: TipContext }) {
  const { t } = useI18n()
  const deck = tipDecks[context]
  const [order, setOrder] = useState(() => shuffledTips(deck.length))
  const [hidden, setHidden] = useState(() => tipsHidden(context))
  return <aside className={`field-tip${hidden ? ' is-hidden' : ''}`} data-tip-context={context} aria-label={t('delight.tip')} data-i18n-skip>
    {!hidden && <><div className="field-tip-heading"><span className="field-tip-glyph" aria-hidden="true">{'{…}'}</span><span>{t('delight.tip')}</span></div><p className="field-tip-copy" aria-live="polite" aria-atomic="true">{t(deck[order[0]])}</p></>}
    <div className="field-tip-actions">
      {!hidden && <button key="next" type="button" onClick={() => setOrder(current => current.length > 1 ? current.slice(1) : shuffledTips(deck.length, current[0]))}>{t('delight.nextTip')}<span aria-hidden="true">↻</span></button>}
      <button key="visibility" type="button" onClick={() => { setTipsHidden(context, !hidden); setHidden(!hidden) }}>{t(hidden ? 'delight.showTips' : 'delight.hideTips')}</button>
    </div>
  </aside>
}

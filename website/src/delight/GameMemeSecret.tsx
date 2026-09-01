import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@localizationhub/i18n'
import { advanceKonamiProgress, GAME_MEME_KEYS, KONAMI_SEQUENCE, OPEN_GAME_SECRET_EVENT } from './gameSecrets'

function isTyping(target: EventTarget | null) {
  return Boolean((target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]'))
}

export default function GameMemeSecret() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [progress, setProgress] = useState(0)
  const [memeIndex, setMemeIndex] = useState(0)
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  function close() {
    setOpen(false)
    requestAnimationFrame(() => returnFocus.current?.focus())
  }

  useEffect(() => {
    const reveal = () => {
      returnFocus.current = document.activeElement as HTMLElement | null
      setMemeIndex(index => open ? (index + 1) % GAME_MEME_KEYS.length : index)
      setOpen(true)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (open && event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
      const next = advanceKonamiProgress(progress, event.key)
      if (next === KONAMI_SEQUENCE.length) {
        setProgress(0)
        reveal()
        return
      }
      setProgress(next)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener(OPEN_GAME_SECRET_EVENT, reveal)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(OPEN_GAME_SECRET_EVENT, reveal)
    }
  }, [open, progress])

  useEffect(() => {
    if (open) requestAnimationFrame(() => closeRef.current?.focus())
  }, [open])

  if (!open) return null

  return <aside className="game-secret-toast" role="dialog" aria-label={t('delight.gameSecret.title')} data-i18n-skip>
    <div className="game-secret-pixel" aria-hidden="true"><i /><i /><i /></div>
    <div className="game-secret-copy">
      <span>{t('delight.gameSecret.kicker')}</span>
      <strong>{t('delight.gameSecret.title')}</strong>
      <p>{t(GAME_MEME_KEYS[memeIndex])}</p>
      <small><kbd>↑ ↑ ↓ ↓ ← → ← → B A</kbd> · {t('delight.gameSecret.body')}</small>
    </div>
    <div className="game-secret-actions">
      <button type="button" onClick={() => setMemeIndex(index => (index + 1) % GAME_MEME_KEYS.length)}>{t('delight.gameSecret.next')}</button>
      <button ref={closeRef} type="button" className="game-secret-close" onClick={close} aria-label={t('delight.gameSecret.close')}>×</button>
    </div>
  </aside>
}

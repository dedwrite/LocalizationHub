import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useI18n } from '@localizationhub/i18n'
import { navigate } from '../navigation'
import {
  isEditableTarget,
  listQuietCommands,
  matchQuietCommands,
  registerQuietCommands,
  subscribeQuietCommands,
  type QuietCommand,
} from './quietCommands'

const SHORTCUTS = [
  { keys: 'Ctrl/⌘ K', actionKey: 'quiet.shortcutPalette' as const },
  { keys: '?', actionKey: 'quiet.shortcutHelp' as const },
  { keys: 'Ctrl/⌘ S', actionKey: 'quiet.shortcutSave' as const },
  { keys: 'Ctrl/⌘ Enter', actionKey: 'quiet.shortcutAdvance' as const },
  { keys: 'Alt ↑ / ↓', actionKey: 'quiet.shortcutNavigate' as const },
  { keys: 'Ctrl/⌘ F', actionKey: 'quiet.shortcutSearch' as const },
  { keys: 'Esc', actionKey: 'quiet.shortcutEscape' as const },
]

function baseCommands(setLocale: (locale: 'en' | 'ar') => void, locale: 'en' | 'ar'): QuietCommand[] {
  return [
    {
      id: 'nav.cloud',
      label: 'Open Cloud Projects',
      keywords: 'projects cloud home',
      group: 'navigate',
      hint: 'G',
      run: () => navigate('/app/projects'),
    },
    {
      id: 'nav.local',
      label: 'Open Local Projects',
      keywords: 'local browser device',
      group: 'navigate',
      run: () => navigate('/app/local'),
    },
    {
      id: 'nav.landing',
      label: 'Open website home',
      keywords: 'landing marketing site',
      group: 'navigate',
      run: () => navigate('/'),
    },
    {
      id: 'system.locale',
      label: locale === 'en' ? 'Switch interface to Arabic' : 'Switch interface to English',
      keywords: 'language locale arabic english',
      group: 'system',
      run: () => setLocale(locale === 'en' ? 'ar' : 'en'),
    },
  ]
}

export default function CommandPalette() {
  const { t, locale, setLocale } = useI18n()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [extra, setExtra] = useState<QuietCommand[]>(() => listQuietCommands())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => subscribeQuietCommands(() => setExtra(listQuietCommands())), [])

  const commands = useMemo(() => {
    const merged = new Map<string, QuietCommand>()
    for (const command of [...baseCommands(setLocale, locale), ...extra]) merged.set(command.id, command)
    return matchQuietCommands(query, [...merged.values()])
  }, [extra, locale, query, setLocale])

  useEffect(() => {
    setActive(0)
  }, [query, paletteOpen])

  useEffect(() => {
    if (!paletteOpen) return
    const id = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [paletteOpen])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const typing = isEditableTarget(event.target)
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setHelpOpen(false)
        setPaletteOpen((open) => !open)
        setQuery('')
        return
      }
      if (!typing && event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        setPaletteOpen(false)
        setHelpOpen((open) => !open)
        return
      }
      if (event.key === 'Escape') {
        if (paletteOpen || helpOpen) {
          event.preventDefault()
          setPaletteOpen(false)
          setHelpOpen(false)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [helpOpen, paletteOpen])

  useEffect(() => registerQuietCommands([{
    id: 'system.help',
    label: 'Show keyboard shortcuts',
    keywords: 'help shortcuts keys',
    group: 'system',
    run: () => { setPaletteOpen(false); setHelpOpen(true) },
  }]), [])

  function run(command: QuietCommand) {
    setPaletteOpen(false)
    setQuery('')
    command.run()
  }

  function onPaletteKey(event: ReactKeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => Math.min(commands.length - 1, index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(0, index - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const command = commands[active]
      if (command) run(command)
    }
  }

  return (
    <>
      {paletteOpen && (
        <div className="quiet-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaletteOpen(false) }}>
          <div className="command-palette" role="dialog" aria-modal="true" aria-label={t('quiet.paletteTitle')} data-i18n-skip onKeyDown={onPaletteKey}>
            <div className="command-palette-search">
              <span aria-hidden="true">⌘K</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('quiet.palettePlaceholder')}
                aria-label={t('quiet.paletteTitle')}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="command-palette-list" role="listbox" aria-label={t('quiet.paletteTitle')}>
              {commands.length === 0 && <div className="command-palette-empty">{t('quiet.paletteEmpty')}</div>}
              {commands.map((command, index) => (
                <button
                  key={command.id}
                  type="button"
                  className={index === active ? 'active' : ''}
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => run(command)}
                >
                  <span>{command.label}</span>
                  {command.hint && <kbd>{command.hint}</kbd>}
                </button>
              ))}
            </div>
            <p className="command-palette-foot">{t('quiet.paletteFoot')}</p>
          </div>
        </div>
      )}
      {helpOpen && (
        <div className="quiet-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false) }}>
          <div className="shortcuts-center" role="dialog" aria-modal="true" aria-label={t('quiet.shortcutsTitle')} data-i18n-skip>
            <header>
              <strong>{t('quiet.shortcutsTitle')}</strong>
              <button type="button" onClick={() => setHelpOpen(false)} aria-label={t('quiet.dismiss')}>✕</button>
            </header>
            <ul>
              {SHORTCUTS.map((item) => (
                <li key={item.keys}><kbd>{item.keys}</kbd><span>{t(item.actionKey)}</span></li>
              ))}
            </ul>
            <p>{t('quiet.shortcutsFoot')}</p>
          </div>
        </div>
      )}
    </>
  )
}

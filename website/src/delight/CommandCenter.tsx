import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n, translateUiText } from '@localizationhub/i18n'
import { navigateInternal } from '../internalNavigation'
import { listDynamicQuietCommands, listQuietCommands, subscribeQuietCommands } from './quietCommands'

import { OPEN_COMMAND_CENTER_EVENT, WORKSPACE_COMMAND_EVENT, PROJECT_SEARCH_EVENT, type CenterMode } from './commandEvents'
type Command = { id: string; label: string; meta: string; group: 'navigate' | 'actions'; run: () => void }

function dispatchWorkspace(action: string) {
  window.dispatchEvent(new CustomEvent(WORKSPACE_COMMAND_EVENT, { detail: { action } }))
}

function isTyping(target: EventTarget | null) {
  const element = target as HTMLElement | null
  return Boolean(element?.closest('input, textarea, select, [contenteditable="true"]'))
}

export default function CommandCenter() {
  const { locale, setLocale, t } = useI18n()
  const [mode, setMode] = useState<CenterMode | null>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [path, setPath] = useState(window.location.pathname)
  const [quietTick, setQuietTick] = useState(0)
  const returnFocus = useRef<HTMLElement | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/u.test(navigator.platform)
  const mod = mac ? '⌘' : 'Ctrl'

  useEffect(() => {
    const onOpen = (event: Event) => {
      const requested = (event as CustomEvent<{ mode?: CenterMode }>).detail?.mode ?? 'palette'
      returnFocus.current = document.activeElement as HTMLElement | null
      setMode(requested); setQuery(''); setActive(0)
    }
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener(OPEN_COMMAND_CENTER_EVENT, onOpen)
    window.addEventListener('popstate', onPop)
    return () => { window.removeEventListener(OPEN_COMMAND_CENTER_EVENT, onOpen); window.removeEventListener('popstate', onPop) }
  }, [])

  function close() {
    setMode(null)
    requestAnimationFrame(() => returnFocus.current?.focus())
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const typing = isTyping(event.target)
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault()
        if (mode === 'palette') close()
        else { returnFocus.current = document.activeElement as HTMLElement | null; setMode('palette'); setQuery(''); setActive(0) }
        return
      }
      if (!mode && event.key === '?' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault(); returnFocus.current = document.activeElement as HTMLElement | null; setMode('shortcuts'); return
      }
      if (mode && event.key === 'Escape') { event.preventDefault(); close(); return }
      if (mode && event.key === 'Tab') {
        const layer = document.querySelector<HTMLElement>('[data-command-layer]')
        const focusable = [...(layer?.querySelectorAll<HTMLElement>('input, button:not([disabled])') ?? [])]
        if (!focusable.length) return
        const index = focusable.indexOf(document.activeElement as HTMLElement)
        if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1)?.focus() }
        else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0].focus() }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode])

  useEffect(() => { if (mode === 'palette') requestAnimationFrame(() => inputRef.current?.focus()) }, [mode])
  useEffect(() => subscribeQuietCommands(() => setQuietTick(value => value + 1)), [])

  const workspaceOpen = mode !== null && Boolean(document.querySelector('.workspace-shell, .mob-workspace'))
  const projectListOpen = path === '/app/projects' && Boolean(document.querySelector('.projects-page'))
  const commands = useMemo<Command[]>(() => {
    const items: Command[] = [
      { id: 'home', label: t('delight.command.home'), meta: '/', group: 'navigate', run: () => navigateInternal('/') },
      { id: 'cloud', label: t('delight.command.cloud'), meta: '/app/projects', group: 'navigate', run: () => navigateInternal('/app/projects') },
      { id: 'local', label: t('delight.command.local'), meta: '/app/local', group: 'navigate', run: () => navigateInternal('/app/local') },
      { id: 'download', label: t('delight.command.download'), meta: '/download', group: 'navigate', run: () => navigateInternal('/download') },
      { id: 'language', label: t('delight.command.language'), meta: locale === 'en' ? 'AR' : 'EN', group: 'actions', run: () => setLocale(locale === 'en' ? 'ar' : 'en') },
      { id: 'shortcuts', label: t('delight.command.shortcuts'), meta: '?', group: 'actions', run: () => setMode('shortcuts') },
    ]
    if (projectListOpen) items.push({ id: 'project-search', label: t('delight.command.projectSearch'), meta: '/', group: 'actions', run: () => window.dispatchEvent(new Event(PROJECT_SEARCH_EVENT)) })
    if (workspaceOpen) items.push(
      { id: 'save', label: t('delight.command.save'), meta: `${mod} S`, group: 'actions', run: () => dispatchWorkspace('save') },
      { id: 'next', label: t('delight.command.next'), meta: `${mod} ↵`, group: 'actions', run: () => dispatchWorkspace('next') },
      { id: 'entry-search', label: t('delight.command.entrySearch'), meta: `${mod} F`, group: 'actions', run: () => dispatchWorkspace('search') },
      { id: 'overview', label: t('delight.command.overview'), meta: 'O', group: 'actions', run: () => dispatchWorkspace('overview') },
      { id: 'focus', label: t('delight.command.focus'), meta: 'F', group: 'actions', run: () => dispatchWorkspace('focus') },
    )
    const labels = new Set(items.map(command => command.label.toLocaleLowerCase()))
    for (const command of [...listDynamicQuietCommands(query), ...listQuietCommands()]) {
      const label = translateUiText(locale, command.label)
      if (labels.has(label.toLocaleLowerCase())) continue
      labels.add(label.toLocaleLowerCase())
      items.push({
        id: `quiet:${command.id}`,
        label,
        meta: command.hint ?? '↗',
        group: command.group === 'navigate' ? 'navigate' : 'actions',
        run: command.run,
      })
    }
    return items
  }, [locale, mod, path, projectListOpen, query, quietTick, setLocale, t, workspaceOpen])
  const filtered = commands.filter(command => `${command.label} ${command.meta}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))

  useEffect(() => { if (active >= filtered.length) setActive(Math.max(0, filtered.length - 1)) }, [active, filtered.length])

  function run(command: Command) {
    command.run()
    if (command.id !== 'shortcuts') close()
  }

  if (!mode) return null
  const shortcutRows = [
    [t('delight.shortcuts.palette'), `${mod} K`],
    [t('delight.shortcuts.help'), '?'],
    ...(workspaceOpen ? [[t('delight.shortcuts.save'), `${mod} S`], [t('delight.shortcuts.find'), `${mod} F`], [t('delight.shortcuts.move'), 'Alt ↑ / ↓'], [t('delight.shortcuts.advance'), `${mod} Enter`]] : []),
    [t('delight.shortcuts.escape'), 'Esc'],
  ]
  return <div className="command-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
    <section className="command-center" role="dialog" aria-modal="true" aria-label={mode === 'palette' ? t('delight.command.title') : t('delight.shortcuts.title')} dir={locale === 'ar' ? 'rtl' : 'ltr'} data-command-layer data-i18n-skip>
      <header className="command-head"><span className="command-logo" aria-hidden="true">⌘</span><div><span>{t('delight.command.kicker')}</span><h2>{mode === 'palette' ? t('delight.command.title') : t('delight.shortcuts.title')}</h2></div><button type="button" onClick={close} aria-label={t('delight.command.close')}>{t('delight.command.esc')}</button></header>
      {mode === 'palette' ? <>
        <div className="command-search"><span aria-hidden="true">⌕</span><input ref={inputRef} value={query} onChange={event => { setQuery(event.target.value); setActive(0) }} onKeyDown={event => {
          if (event.key === 'ArrowDown') { event.preventDefault(); setActive(value => filtered.length ? (value + 1) % filtered.length : 0) }
          if (event.key === 'ArrowUp') { event.preventDefault(); setActive(value => filtered.length ? (value - 1 + filtered.length) % filtered.length : 0) }
          if (event.key === 'Enter' && filtered[active]) { event.preventDefault(); run(filtered[active]) }
        }} placeholder={t('delight.command.placeholder')} aria-label={t('delight.command.placeholder')} /></div>
        <div className="command-results" role="listbox" aria-label={t('delight.command.actions')}>
          {filtered.length === 0 && <p className="command-empty">{t('delight.command.empty')}</p>}
          {filtered.map((command, index) => <button key={command.id} type="button" role="option" aria-selected={index === active} className={index === active ? 'active' : ''} onMouseEnter={() => setActive(index)} onClick={() => run(command)}><span><i aria-hidden="true">{command.group === 'navigate' ? '↗' : '✦'}</i>{command.label}</span><kbd>{command.meta}</kbd></button>)}
        </div>
        <footer className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> {t('delight.command.toNavigate')}</span><span><kbd>↵</kbd> {t('delight.command.toRun')}</span></footer>
      </> : <div className="shortcut-guide"><p>{t('delight.shortcuts.body')}</p><div>{shortcutRows.map(([label, keys]) => <span key={label}><strong>{label}</strong><kbd>{keys}</kbd></span>)}</div><button type="button" onClick={() => setMode('palette')}>{t('delight.command.open')} <kbd>{`${mod}K`}</kbd></button></div>}
    </section>
  </div>
}

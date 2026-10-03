import type { KeyboardEvent } from 'react'

/*
 * Keyboard support for the tablists in the workspace, the review filters and
 * the admin console.
 *
 * A tablist keeps only the selected tab in the document tab order (roving
 * tabindex), so arrow keys, Home and End have to move focus and selection
 * themselves. The horizontal arrows follow the visual direction, which flips
 * under `dir="rtl"` so Arabic users get the same left-to-right reading order.
 */
export function handleTabListKeys<Key extends string>(event: KeyboardEvent<HTMLButtonElement>, onSelect: (key: Key) => void) {
  const tab = event.currentTarget
  const list = tab.closest('[role="tablist"]')
  if (!list) return
  const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
  const index = tabs.indexOf(tab)
  if (index < 0) return
  const rtl = getComputedStyle(list).direction === 'rtl'
  const step = event.key === 'ArrowRight' ? (rtl ? -1 : 1) : event.key === 'ArrowLeft' ? (rtl ? 1 : -1) : 0
  let next = -1
  if (step) next = (index + step + tabs.length) % tabs.length
  else if (event.key === 'Home' || event.key === 'PageUp') next = 0
  else if (event.key === 'End' || event.key === 'PageDown') next = tabs.length - 1
  if (next < 0) return
  event.preventDefault()
  const target = tabs[next]
  target.focus()
  const key = target.dataset.tabKey
  if (key) onSelect(key as Key)
}

/** Roving tabindex: the selected tab is the single tab stop for the group. */
export function tabStopIndex(selected: boolean) {
  return selected ? 0 : -1
}

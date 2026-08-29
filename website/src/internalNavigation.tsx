import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import { navigate } from './navigation'

/*
 * Safe internal navigation for the website.
 *
 * Ordinary same-origin `<a href>` clicks trigger a full document navigation,
 * which would destroy the global LH Radio player. `InternalLink` intercepts
 * same-origin internal routes and routes them through `window.history.pushState`
 * (see `navigation.ts`) instead, while leaving external links, modified clicks,
 * open-in-new-tab, and hash-only anchors to the browser's native behavior.
 */

export interface ClickLike {
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  button: number
}

function defaultBase(): string {
  return typeof window !== 'undefined' ? window.location.href : 'http://localhost/'
}

export function isModifiedClick(event: ClickLike): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0
}

export function isExternalHref(href: string, base = defaultBase()): boolean {
  if (!href) return false
  if (href.startsWith('//')) return true
  if (/^(mailto:|tel:|javascript:)/i.test(href)) return true
  try {
    const url = new URL(href, base)
    return url.origin !== new URL(base).origin
  } catch {
    return true
  }
}

export interface InternalTarget {
  path: string
  hash: string
}

export function parseInternalTarget(href: string, base = defaultBase()): InternalTarget | null {
  if (!href || href.startsWith('#')) return null
  if (isExternalHref(href, base)) return null
  try {
    const url = new URL(href, base)
    return { path: url.pathname + url.search, hash: url.hash }
  } catch {
    return null
  }
}

export function shouldInterceptClick(event: ClickLike, href: string, base = defaultBase()): boolean {
  if (isModifiedClick(event)) return false
  if (!href || href.startsWith('#')) return false
  return !isExternalHref(href, base)
}

export function navigateInternal(href: string): void {
  const target = parseInternalTarget(href)
  if (!target) return
  navigate(target.path + target.hash)
  // Defer scrolling until React commits the new route.
  requestAnimationFrame(() => {
    if (target.hash) {
      const id = decodeURIComponent(target.hash.slice(1))
      const element = document.getElementById(id)
      if (element) {
        element.scrollIntoView()
        return
      }
    }
    scrollToTop()
  })
}

function scrollToTop(): void {
  const root = document.documentElement
  const previous = root.style.scrollBehavior
  root.style.scrollBehavior = 'auto'
  window.scrollTo(0, 0)
  root.style.scrollBehavior = previous
}

type InternalLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string }

export function InternalLink({ href, onClick, children, ...rest }: InternalLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (event.defaultPrevented) return
    if (shouldInterceptClick(event, href)) {
      event.preventDefault()
      navigateInternal(href)
    }
  }
  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}

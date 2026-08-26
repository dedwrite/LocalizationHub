import { useEffect, useState } from 'react'

export type MotionState = {
  debug: boolean
  reduced: boolean
  registered: number
  revealed: number
}

const initialState: MotionState = {
  debug: false,
  reduced: false,
  registered: 0,
  revealed: 0,
}

export default function useScrollReveal(): MotionState {
  const [state, setState] = useState(initialState)

  useEffect(() => {
    let debug = false
    let force = false
    if (import.meta.env.DEV) {
      const query = new URLSearchParams(window.location.search)
      debug = query.get('motionDebug') === '1'
      force = query.get('motionForce') === '1'
    }
    const reducedPreference = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const reduced = reducedPreference && !force
    const root = document.documentElement
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))

    setState({ debug, reduced, registered: elements.length, revealed: 0 })

    if (!elements.length) return
    if (reduced || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-revealed'))
      setState((current) => ({ ...current, revealed: elements.length }))
      return
    }

    let observer: IntersectionObserver | null = null
    let firstFrame = 0
    let secondFrame = 0

    firstFrame = requestAnimationFrame(() => {
      root.classList.add('lh-motion')
      if (import.meta.env.DEV && debug) root.classList.add('lh-motion-debug')
      secondFrame = requestAnimationFrame(() => {
        observer = new IntersectionObserver(
          (entries) => {
            let revealed = 0
            for (const entry of entries) {
              const element = entry.target as HTMLElement
              if (!entry.isIntersecting || element.classList.contains('is-revealed')) continue
              element.style.setProperty('--reveal-delay', element.dataset.revealDelay ?? '0ms')
              element.classList.add('is-revealed')
              observer?.unobserve(element)
              revealed += 1
            }
            if (revealed) setState((current) => ({ ...current, revealed: current.revealed + revealed }))
          },
          { threshold: 0.12, rootMargin: '0px 0px -10% 0px' },
        )
        elements.forEach((element) => observer?.observe(element))
      })
    })

    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
      observer?.disconnect()
      root.classList.remove('lh-motion')
      if (import.meta.env.DEV) root.classList.remove('lh-motion-debug')
    }
  }, [])

  return state
}

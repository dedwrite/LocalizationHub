import {useEffect, useLayoutEffect, useRef, useState} from 'react'

/** Local illustrative stories only; no project, network or persistent state. */
export function useProductStory(steps = 3) {
  const root = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState(steps - 1)
  const [reduced, setReduced] = useState(true)
  const [visible, setVisible] = useState(false)
  const [manual, setManual] = useState(false)
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    let inView = false
    const sync = () => {setReduced(media.matches); if(media.matches) setPhase(steps - 1)}
    const visibility = () => setVisible(inView && document.visibilityState === 'visible')
    const observer = new IntersectionObserver(([entry]) => {inView = entry.isIntersecting && entry.intersectionRatio >= .2; visibility()}, {threshold: .2})
    if(root.current) observer.observe(root.current)
    sync()
    if(!media.matches) setPhase(0)
    media.addEventListener('change', sync)
    document.addEventListener('visibilitychange', visibility)
    return () => {observer.disconnect(); media.removeEventListener('change', sync); document.removeEventListener('visibilitychange', visibility)}
  }, [steps])
  useLayoutEffect(() => {
    if(reduced || !visible || manual) return
    const timer = setTimeout(() => {if(document.visibilityState === 'visible') setPhase(value => (value + 1) % steps)}, phase === steps - 1 ? 3000 : 2000)
    return () => clearTimeout(timer)
  }, [phase, reduced, visible, manual, steps])
  return {root, phase, reduced, visible, paused: manual || reduced, takeOver: () => setManual(true), select: (value: number) => {setManual(true); setPhase(value)}, replay: () => {setManual(false); setPhase(reduced ? steps - 1 : 0)}}
}

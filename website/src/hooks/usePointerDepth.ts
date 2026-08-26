import { useEffect, type RefObject } from 'react'

const lerp = 0.12
const closeEnough = 0.01

export type PointerDepthStatus = 'enabled' | 'reduced' | 'forced' | 'unsupported'

export function getPointerDepthStatus(): PointerDepthStatus {
  const supported = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  if (!supported) return 'unsupported'

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let forced = false
  if (import.meta.env.DEV && reduced) {
    forced = new URLSearchParams(window.location.search).get('pointerForce') === '1'
  }
  if (forced) return 'forced'
  return reduced ? 'reduced' : 'enabled'
}

export default function usePointerDepth(pointerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const status = getPointerDepthStatus()
    const element = pointerRef.current

    if ((status !== 'enabled' && status !== 'forced') || !element) return

    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0
    let frame = 0
    let hovered = false

    const render = () => {
      currentX += (targetX - currentX) * lerp
      currentY += (targetY - currentY) * lerp

      const translateX = currentX * 10
      const translateY = currentY * 8
      const rotateY = currentX * 1.8
      const rotateX = currentY * -1.4
      const scale = 1 + Math.min(Math.abs(currentX) + Math.abs(currentY), 1) * 0.005

      element.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`
      element.style.setProperty('--depth-back-x', `${-translateX * 0.25}px`)
      element.style.setProperty('--depth-back-y', `${-translateY * 0.25}px`)

      const settling = Math.abs(targetX - currentX) > closeEnough || Math.abs(targetY - currentY) > closeEnough
      if (hovered || settling) frame = requestAnimationFrame(render)
      else frame = 0
    }

    const start = () => {
      if (!frame) frame = requestAnimationFrame(render)
    }

    const handleMove = (event: PointerEvent) => {
      const bounds = element.getBoundingClientRect()
      targetX = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1))
      targetY = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1))
      hovered = true
      start()
    }

    const handleLeave = () => {
      targetX = 0
      targetY = 0
      hovered = false
      start()
    }

    element.addEventListener('pointermove', handleMove)
    element.addEventListener('pointerleave', handleLeave)

    return () => {
      element.removeEventListener('pointermove', handleMove)
      element.removeEventListener('pointerleave', handleLeave)
      if (frame) cancelAnimationFrame(frame)
      element.style.transform = ''
      element.style.removeProperty('--depth-back-x')
      element.style.removeProperty('--depth-back-y')
    }
  }, [pointerRef])
}
import type { MotionState } from '../hooks/useScrollReveal'
import { getPointerDepthStatus } from '../hooks/usePointerDepth'

type Props = { state: MotionState }

export default function MotionDebugBadge({ state }: Props) {
  if (!import.meta.env.DEV || !state.debug) return null
  return <aside aria-live="polite" style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 50, display: 'grid', gap: 3, minWidth: 150, padding: '9px 11px', border: '1px solid #665c9b', background: 'rgba(15, 17, 22, 0.94)', color: '#c8c1ff', font: '11px DM Mono, monospace', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)' }}><strong>Motion: {state.reduced ? 'reduced' : 'enabled'}</strong><span style={{ color: '#aeb1bd' }}>Pointer: {getPointerDepthStatus()}</span><span style={{ color: '#aeb1bd' }}>Registered: {state.registered}</span><span style={{ color: '#aeb1bd' }}>Revealed: {state.revealed}</span></aside>
}

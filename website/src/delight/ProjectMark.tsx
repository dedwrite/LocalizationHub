import type { CSSProperties } from 'react'
import { projectIdentity } from './projectIdentity'

type IdentityStyle = CSSProperties & {
  '--project-accent': string
  '--project-soft': string
  '--project-ink': string
}

export default function ProjectMark({ seed, label, detail, compact = false }: {
  seed: string
  label: string
  detail?: string
  compact?: boolean
}) {
  const identity = projectIdentity(seed, label)
  const style: IdentityStyle = {
    '--project-accent': identity.accent,
    '--project-soft': identity.soft,
    '--project-ink': identity.ink,
  }
  return <span className={`project-mark${compact ? ' project-mark-compact' : ''}`} style={style} aria-hidden="true">
    <strong>{identity.initials}</strong>
    {detail && <small>{detail.slice(0, 4).toLocaleUpperCase()}</small>}
  </span>
}

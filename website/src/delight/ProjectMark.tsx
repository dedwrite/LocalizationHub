import type { CSSProperties } from 'react'
import { projectIdentity } from './projectIdentity'

export default function ProjectMark({
  name,
  size = 'md',
  className = '',
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const identity = projectIdentity(name)
  const style = {
    '--project-accent': identity.accent,
    '--project-accent-soft': identity.accentSoft,
  } as CSSProperties
  return (
    <span
      className={`project-mark project-mark-${size} ${className}`.trim()}
      style={style}
      aria-hidden="true"
      data-tone={identity.tone}
    >
      <span className="project-mark-glyph">{identity.glyph}</span>
    </span>
  )
}

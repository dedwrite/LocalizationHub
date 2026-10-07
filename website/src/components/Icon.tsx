import type { CSSProperties } from 'react'

/**
 * The site's complete icon set. Unicode marks such as ↗ ↓ + ☰ ※ ↓ render as a
 * different picture in every font family and several of them are missing from
 * the two families we ship, so every glyph on a public surface comes from here.
 *
 * The strokes inherit `currentColor` and stay decorative: callers pass a text
 * label next to them, or an aria-label on the control that holds them.
 */
export type IconName =
  | 'arrow-up-right'
  | 'arrow-down'
  | 'plus'
  | 'refresh'
  | 'pause'
  | 'menu'
  | 'check'
  | 'alert'
  | 'empty'
  | 'asterisk'
  | 'sparkle'

const strokes: Record<Exclude<IconName, 'empty'>, string[]> = {
  'arrow-up-right': ['M7 17 17 7', 'M9.5 7H17v7.5'],
  'arrow-down': ['M12 5v14', 'M6 13l6 6 6-6'],
  plus: ['M12 5.5v13', 'M5.5 12h13'],
  refresh: ['M20 12a8 8 0 1 1-2.6-5.9', 'M20 4.5V11h-6.5'],
  pause: ['M9 5v14', 'M15 5v14'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  check: ['M5 12.5 9.5 17 19 7'],
  alert: ['M12 6.5v7', 'M12 17.2h.01'],
  asterisk: ['M12 5v14', 'M6 8.4l12 7.2', 'M18 8.4l-12 7.2'],
  sparkle: ['M12 3.5c0 4.7 3.8 8.5 8.5 8.5-4.7 0-8.5 3.8-8.5 8.5 0-4.7-3.8-8.5-8.5-8.5 4.7 0 8.5-3.8 8.5-8.5Z'],
}

type Props = {
  name: IconName
  size?: number
  className?: string
  style?: CSSProperties
}

export default function Icon({ name, size = 16, className, style }: Props) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === 'empty'
        ? <circle cx="12" cy="12" r="6.5" />
        : strokes[name].map((d) => <path key={d} d={d} />)}
    </svg>
  )
}

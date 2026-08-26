import type { ReactNode } from 'react'
import { cloneElement, isValidElement } from 'react'
import type { ReactElement } from 'react'

export type RevealVariant = 'left' | 'right' | 'up' | 'fade'

type Props = {
  variant?: RevealVariant
  children: ReactNode
}

export default function Reveal({ variant = 'up', children }: Props) {
  if (!isValidElement(children)) return <>{children}</>
  return cloneElement(children as ReactElement<{ 'data-reveal'?: string }>, {
    'data-reveal': variant,
  })
}

import React, { type ReactNode, type ComponentProps } from 'react'

export function UiTheme({ children, className = '' }: {children: ReactNode; className?: string}) {
  return React.createElement('div', {'data-lh-theme': 'product', className}, children)
}
export function ActionLink({variant = 'quiet', className = '', ...props}: ComponentProps<'a'> & {variant?: 'primary' | 'quiet'}) {
  return <a {...props} className={`lh-action ${className}`} data-variant={variant} />
}
export function IconButton({label, className = '', ...props}: ComponentProps<'button'> & {label: string}) {
  return <button type="button" {...props} aria-label={label} className={`lh-icon-button ${className}`} />
}
export function StatusBadge({children, tone = 'neutral'}: {children: ReactNode; tone?: 'neutral' | 'success' | 'warning'}) {
  return <span className="lh-status" data-tone={tone}>{children}</span>
}

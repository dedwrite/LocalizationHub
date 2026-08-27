import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/*
 * Fixed-height windowed virtualizer. Renders only the rows visible in the
 * viewport (plus overscan) so 100k-entry reviews keep the DOM bounded.
 */
export default function VirtualList({
  count,
  rowHeight,
  overscan = 6,
  className,
  renderRow,
}: {
  count: number
  rowHeight: number
  overscan?: number
  className?: string
  renderRow: (index: number) => ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)

  const measure = useCallback(() => {
    const container = containerRef.current
    if (container) setViewportHeight(container.clientHeight)
  }, [])

  useEffect(() => {
    measure()
    const observer = new ResizeObserver(measure)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [measure])

  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2
  const endIndex = Math.min(count, startIndex + visibleCount)

  const rows: ReactNode[] = []
  for (let i = startIndex; i < endIndex; i += 1) {
    rows.push(
      <div
        key={i}
        className="virtual-row"
        style={{ position: 'absolute', top: i * rowHeight, height: rowHeight, left: 0, right: 0 }}
      >
        {renderRow(i)}
      </div>,
    )
  }

  return (
    <div
      ref={containerRef}
      className={`virtual-list ${className ?? ''}`}
      onScroll={(event) => setScrollTop((event.currentTarget as HTMLDivElement).scrollTop)}
      role="list"
      data-testid="virtual-list"
    >
      <div className="virtual-list-spacer" style={{ height: count * rowHeight, position: 'relative' }}>
        {rows}
      </div>
    </div>
  )
}

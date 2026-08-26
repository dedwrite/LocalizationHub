import { useEffect, useRef, useState, type ReactNode } from 'react'

/*
 * Lightweight windowed virtualization for the entry list.
 *
 * Renders only the rows visible in the viewport (plus overscan) so projects
 * with tens of thousands of entries stay smooth. Row height is fixed; rows
 * are absolutely positioned inside a spacer of full content height.
 */
export default function VirtualList({
  items,
  rowHeight,
  overscan = 6,
  renderRow,
  className,
}: {
  items: unknown[]
  rowHeight: number
  overscan?: number
  renderRow: (item: unknown, index: number) => ReactNode
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const measure = () => setViewportHeight(container.clientHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const totalHeight = items.length * rowHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2
  const endIndex = Math.min(items.length, startIndex + visibleCount)

  const children: ReactNode[] = []
  for (let i = startIndex; i < endIndex; i++) {
    children.push(
      <div
        key={i}
        className="virtual-row"
        style={{ position: 'absolute', top: i * rowHeight, height: rowHeight, left: 0, right: 0 }}
      >
        {renderRow(items[i], i)}
      </div>,
    )
  }

  return (
    <div
      ref={containerRef}
      className={`virtual-list ${className ?? ''}`}
      onScroll={(event) => setScrollTop((event.currentTarget as HTMLDivElement).scrollTop)}
      role="list"
    >
      <div className="virtual-list-spacer" style={{ height: totalHeight, position: 'relative' }}>
        {children}
      </div>
    </div>
  )
}

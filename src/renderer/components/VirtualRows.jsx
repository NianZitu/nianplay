import React, { useRef } from 'react'
import { useVirtualRows } from '../hooks/useVirtualRows'

/**
 * Renders only the visible slice of `items` inside the scroller `scrollRef`.
 * Every row slot must be exactly `rowHeight` px tall (renderRow is responsible).
 */
export default function VirtualRows({ items, rowHeight, scrollRef, renderRow, className = '', overscan }) {
  const listRef = useRef(null)
  const { start, end, padTop, padBottom } = useVirtualRows({
    scrollRef, listRef, count: items.length, rowHeight, overscan,
  })

  return (
    <div ref={listRef} className={className}>
      {padTop > 0 && <div style={{ height: padTop }} aria-hidden />}
      {items.slice(start, end).map((item, i) => renderRow(item, start + i))}
      {padBottom > 0 && <div style={{ height: padBottom }} aria-hidden />}
    </div>
  )
}

import { useEffect, useState } from 'react'

/**
 * Windowing for fixed-height rows: renders only the rows visible in `scrollRef`
 * (plus `overscan` above/below) and returns spacer heights for the rest.
 *
 * - scrollRef: the element that scrolls (overflow-y: auto)
 * - listRef:   the element that contains the rows (may sit below other content
 *              inside the scroller; its offset is measured on every update)
 * - rowHeight: exact height in px of each row slot (including any gap)
 *
 * Uses useEffect (not useLayoutEffect) on purpose: a child's layout effect runs
 * before a parent's ref is attached, so scrollRef could still be null on mount.
 */
export function useVirtualRows({ scrollRef, listRef, count, rowHeight, overscan = 10 }) {
  const [range, setRange] = useState({ start: 0, end: Math.min(count, 30) })

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    // Updates run directly in the scroll handler (no requestAnimationFrame): scroll
    // events already fire at most once per frame, and rAF is heavily throttled in
    // hidden/background windows, which left blank areas until it fired
    function update() {
      const list = listRef.current
      const offset = list
        ? list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
        : 0
      const top   = Math.max(0, scroller.scrollTop - offset)
      const start = Math.max(0, Math.floor(top / rowHeight) - overscan)
      const end   = Math.min(count, Math.ceil((top + scroller.clientHeight) / rowHeight) + overscan)
      setRange(prev => (prev.start === start && prev.end === end ? prev : { start, end }))
    }

    update()
    scroller.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(scroller)
    // Content above the list can change height without any scroll (e.g. a group
    // folder expanding), which moves the list — watch the container around it too
    const container = listRef.current?.parentElement
    if (container && container !== scroller) observer.observe(container)
    return () => {
      scroller.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [scrollRef, listRef, count, rowHeight, overscan])

  const start = Math.min(range.start, count)
  const end   = Math.min(range.end, count)
  return {
    start,
    end,
    padTop:    start * rowHeight,
    padBottom: Math.max(0, count - end) * rowHeight,
  }
}

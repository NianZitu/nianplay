import { useCallback, useEffect, useRef, useState } from 'react'

// ── Colors ───────────────────────────────────────────────────────────────────
// Spotify tints the playlist header, the mini player and the full player with the cover's color.
const cache = new Map()

// Stable color for things without a cover (hash of the name), muted to fit the dark theme
export function colorFromString(s = '') {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return `hsl(${h % 360} 45% 32%)`
}

// Average color of the image, pushed away from gray and kept dark enough for white text
async function computeColor(src) {
  const img = await new Promise((res, rej) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => res(i)
    i.onerror = rej
    i.src = src
  })
  const c = document.createElement('canvas')
  c.width = c.height = 24
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, 24, 24)
  const d = ctx.getImageData(0, 0, 24, 24).data   // throws for remote images without CORS
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < d.length; i += 4) {
    const max = Math.max(d[i], d[i + 1], d[i + 2]), min = Math.min(d[i], d[i + 1], d[i + 2])
    const weight = 1 + (max - min) / 32          // favour colorful pixels over gray/black ones
    r += d[i] * weight; g += d[i + 1] * weight; b += d[i + 2] * weight; n += weight
  }
  r /= n; g /= n; b /= n
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const k = lum > 110 ? 110 / lum : 1                      // too bright → darken
  return `rgb(${Math.round(r * k)} ${Math.round(g * k)} ${Math.round(b * k)})`
}

export function useDominantColor(src, fallbackKey = '') {
  const fallback = colorFromString(fallbackKey)
  const [color, setColor] = useState(() => (src && cache.get(src)) || fallback)
  useEffect(() => {
    let alive = true
    if (!src) { setColor(fallback); return }
    if (cache.has(src)) { setColor(cache.get(src)); return }
    computeColor(src)
      .then(c => { cache.set(src, c); if (alive) setColor(c) })
      .catch(() => { cache.set(src, fallback); if (alive) setColor(fallback) })
    return () => { alive = false }
  }, [src, fallback])
  return color
}

// ── Data ─────────────────────────────────────────────────────────────────────
export function usePlaylists() {
  const [playlists, setPlaylists] = useState([])
  const reload = useCallback(async () => setPlaylists(await window.electron.playlists.getAll()), [])
  useEffect(() => {
    reload()
    return window.electron.library.onChanged(reload)
  }, [reload])
  return [playlists, reload]
}

// ── Gestures ─────────────────────────────────────────────────────────────────
// Long press (Spotify opens the track menu). Cancels on scroll/move so lists still scroll.
export function useLongPress(onLongPress, ms = 450) {
  const timer = useRef(null)
  const start = useRef(null)
  const fired = useRef(false)
  const clear = () => { clearTimeout(timer.current); timer.current = null }
  return {
    onTouchStart: e => {
      fired.current = false
      const t = e.touches[0]
      start.current = { x: t.clientX, y: t.clientY }
      timer.current = setTimeout(() => { fired.current = true; navigator.vibrate?.(10); onLongPress() }, ms)
    },
    onTouchMove: e => {
      const t = e.touches[0]
      if (start.current && (Math.abs(t.clientX - start.current.x) > 8 || Math.abs(t.clientY - start.current.y) > 8)) clear()
    },
    onTouchEnd: clear,
    onTouchCancel: clear,
    onContextMenu: e => { e.preventDefault(); onLongPress() },
    // lets onClick handlers ignore the tap that ended a long press
    wasLongPress: () => fired.current,
  }
}

export function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

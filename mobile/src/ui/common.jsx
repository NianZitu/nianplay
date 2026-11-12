import React, { useCallback, useEffect, useState } from 'react'
import { Music2, X } from 'lucide-react'
import { listCoverSrc, coverSrc } from '../../../src/renderer/utils/covers'
import { mediaUrl } from '../platform/paths'

export const formatTime = secs => {
  if (!secs || !Number.isFinite(secs)) return '0:00'
  return `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`
}

// A track plays on this phone only if its file is here (cloud tracks may have none, and desktop
// paths like C:\... synced from the PC can't be opened)
export const isPlayable = t => Boolean(t?.file_path && mediaUrl(t.file_path))

// Cover for lists (thumbnail) or big views; cloud-only tracks may carry a remote cover_url
export function trackArt(track, big = false) {
  const local = big ? coverSrc(track?.cover_path) : listCoverSrc(track)
  if (local) return local
  return /^https?:\/\//.test(track?.cover_url || '') ? track.cover_url : null
}

export function Cover({ track, size = 44, big = false, className = '', rounded = 'rounded-lg' }) {
  const [failed, setFailed] = useState(false)
  const src = trackArt(track, big)
  useEffect(() => { setFailed(false) }, [src])
  return (
    <div className={`${rounded} overflow-hidden bg-surface-700 shrink-0 flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}>
      {src && !failed
        ? <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="w-full h-full object-cover" />
        : <Music2 size={typeof size === 'number' ? Math.round(size * 0.36) : 64} strokeWidth={1.25} className="text-white/12" />}
    </div>
  )
}

// The NianPlay mark (same as the desktop's NavRail logo: a record in amber)
export function Logo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="10" stroke="#d97706" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="5" stroke="#d97706" strokeWidth="1" strokeOpacity="0.45" />
      <circle cx="12" cy="12" r="2" fill="#d97706" />
    </svg>
  )
}

// VU meter (desktop StudioPanel): moves only while music is really playing
export function VUBars({ playing, bars = 5, height = 14, className = '' }) {
  const durations = [350, 500, 280, 420, 320]
  return (
    <span className={`inline-flex items-end gap-[2px] shrink-0 ${className}`} style={{ height }} aria-hidden="true">
      {durations.slice(0, bars).map((d, i) => (
        <span key={i} className="w-[3px] bg-brand-500 rounded-full"
          style={playing
            ? { height, transformOrigin: 'bottom', animation: `vuPulse ${d}ms ease-in-out infinite alternate`, animationDelay: `${i * 60}ms` }
            : { height: 2, opacity: 0.3 }} />
      ))}
    </span>
  )
}

// Top of a tab page, like the desktop's sticky page headers: mark + heavy title + counts on the
// left, actions on the right, charcoal glass with a hairline border.
export function PageHeader({ title, subtitle, left, right, children }) {
  return (
    <div className="sticky top-0 z-10 bg-surface-900/95 backdrop-blur-md border-b border-white/[0.05]"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}>
      <div className="flex items-center gap-3 px-4 pb-3">
        {left}
        <div className="flex-1 min-w-0">
          <h1 className="text-[26px] leading-none font-black text-white tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-white/35 mt-1.5 truncate tabular-nums">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

// Section title: small uppercase equipment label above a bold name (desktop panels)
export function SectionTitle({ label, title, right, className = '' }) {
  return (
    <div className={`flex items-end gap-3 px-4 ${className}`}>
      <div className="flex-1 min-w-0">
        {label && <p className="m-label mb-1">{label}</p>}
        <h2 className="text-lg font-bold text-white/90 tracking-tight truncate">{title}</h2>
      </div>
      {right}
    </div>
  )
}

// Bottom sheet with the desktop modal look (modal-box / modal-header). Tapping the backdrop closes it.
export function Sheet({ title, onClose, children, tall = false }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm fade-in" onClick={onClose} />
      <div className={`relative bg-surface-800 rounded-t-2xl border-t border-x border-white/10 shadow-2xl slide-up flex flex-col
                       ${tall ? 'h-[85%]' : 'max-h-[85%]'}`}
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
        <div className="mx-auto mt-2 mb-1 w-9 h-1 rounded-full bg-white/15 shrink-0" />
        {title && (
          <div className="flex items-center justify-between pl-5 pr-3 py-2.5 border-b border-white/6 shrink-0">
            <h2 className="text-[15px] font-bold text-white truncate">{title}</h2>
            <button onClick={onClose} aria-label="Fechar" className="m-icon-btn"><X size={18} /></button>
          </div>
        )}
        <div className="overflow-y-auto min-h-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

// One action in a sheet menu (desktop dropdown item, touch-sized). Destructive ones go last,
// after a hairline (desktop menus do the same).
export function MenuItem({ icon: Icon, label, onPress, destructive = false, disabled = false, right = null }) {
  return (
    <button disabled={disabled} onClick={onPress}
      className={`w-full flex items-center gap-3.5 px-5 py-3 text-[15px] text-left active:bg-white/5 disabled:opacity-35
        ${destructive ? 'text-red-400' : 'text-white/85'}`}>
      {Icon && (
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
          ${destructive ? 'bg-red-500/10' : 'bg-white/[0.05] border border-white/[0.05]'}`}>
          <Icon size={17} strokeWidth={1.75} className={destructive ? 'text-red-400' : 'text-white/55'} />
        </span>
      )}
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {right}
    </button>
  )
}

// List of actions; each { label, icon, onPress, destructive, disabled, keep }
export function MenuList({ actions, onClose }) {
  const list = actions.filter(Boolean)
  const normal = list.filter(a => !a.destructive)
  const danger = list.filter(a => a.destructive)
  const run = a => () => { if (!a.keep) onClose?.(); a.onPress() }
  return (
    <div className="py-2">
      {normal.map(a => <MenuItem key={a.label} {...a} onPress={run(a)} />)}
      {danger.length > 0 && normal.length > 0 && <div className="h-px bg-white/6 mx-5 my-1.5" />}
      {danger.map(a => <MenuItem key={a.label} {...a} onPress={run(a)} />)}
    </div>
  )
}

// Text input sheet (new playlist, rename). onSubmit returns an error message to show, or nothing.
export function PromptSheet({ title, label, initial = '', confirmLabel = 'Salvar', onSubmit, onClose }) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit() {
    if (!value.trim() || busy) return
    setBusy(true)
    const err = await onSubmit(value.trim())
    setBusy(false)
    if (err) setError(err)
    else onClose()
  }
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="px-5 pt-4 pb-4 flex flex-col gap-3">
        {label && <p className="m-label">{label}</p>}
        <input autoFocus value={value} onChange={e => { setValue(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          className={`m-input ${error ? '!border-red-500/60' : ''}`} />
        {error && <p className="text-xs text-red-400 leading-relaxed">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="m-btn-ghost">Cancelar</button>
          <button onClick={submit} disabled={!value.trim() || busy} className="m-btn-primary">{confirmLabel}</button>
        </div>
      </div>
    </Sheet>
  )
}

export function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className="fixed left-4 right-4 z-[70] slide-up pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 150px)' }}>
      <div className={`mx-auto max-w-sm rounded-xl px-4 py-3 text-sm font-medium shadow-2xl shadow-black/50 border flex items-center gap-2.5
        ${toast.ok === false ? 'bg-red-950/95 border-red-500/30 text-red-200' : 'bg-surface-700/95 border-white/10 text-white/90'}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${toast.ok === false ? 'bg-red-400' : 'bg-brand-500'}`} />
        {toast.msg}
      </div>
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = useState(null)
  const show = useCallback((msg, ok = true, ms = 3200) => {
    setToast({ msg, ok })
    clearTimeout(show._t)
    show._t = setTimeout(() => setToast(null), ms)
  }, [])
  return [toast, show]
}

// Library tracks, reloaded whenever the library changes (imports, cloud download, removals)
export function useLibrary() {
  const [tracks, setTracks] = useState([])
  const reload = useCallback(async () => setTracks(await window.electron.library.getTracks()), [])
  useEffect(() => {
    reload()
    return window.electron.library.onChanged(reload)
  }, [reload])
  return [tracks, reload, setTracks]
}

// Empty state (desktop .empty-state): faint big icon, title, hint, optional actions
export function EmptyState({ icon: Icon, title, desc, children }) {
  return (
    <div className="flex flex-col items-center text-center px-8 py-14 gap-3">
      {Icon && <Icon size={52} strokeWidth={0.8} className="text-white/10 mb-1" />}
      <p className="text-[15px] font-semibold text-white/45">{title}</p>
      {desc && <p className="text-[13px] text-white/30 leading-relaxed max-w-xs">{desc}</p>}
      {children && <div className="w-full max-w-xs flex flex-col gap-2 mt-3">{children}</div>}
    </div>
  )
}

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
    <div className={`${rounded} overflow-hidden bg-surface-600 shrink-0 flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}>
      {src && !failed
        ? <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="w-full h-full object-cover" />
        : <Music2 size={typeof size === 'number' ? Math.round(size * 0.38) : 72} className="text-white/20" />}
    </div>
  )
}

// Bottom sheet (iOS style). Tapping the backdrop closes it.
export function Sheet({ title, onClose, children, tall = false }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 fade-in" onClick={onClose} />
      <div className={`relative bg-surface-800 rounded-t-3xl border-t border-white/10 slide-up flex flex-col
                       ${tall ? 'h-[85%]' : 'max-h-[85%]'}`}
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
        <div className="mx-auto mt-2.5 mb-1 w-10 h-1 rounded-full bg-white/20 shrink-0" />
        {title && (
          <div className="flex items-center justify-between px-5 py-2 shrink-0">
            <h2 className="text-base font-bold text-white truncate">{title}</h2>
            <button onClick={onClose} className="p-2 -mr-2 text-white/50 active:text-white"><X size={20} /></button>
          </div>
        )}
        <div className="overflow-y-auto min-h-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

// List of actions; each { label, icon, onPress, destructive, disabled }
export function ActionSheet({ title, subtitle, actions, onClose }) {
  return (
    <Sheet onClose={onClose}>
      {(title || subtitle) && (
        <div className="px-5 pt-1 pb-3 border-b border-white/6">
          {title && <p className="text-sm font-semibold text-white truncate">{title}</p>}
          {subtitle && <p className="text-xs text-white/40 truncate mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="py-1">
        {actions.filter(Boolean).map(a => (
          <button key={a.label} disabled={a.disabled}
            onClick={() => { onClose(); a.onPress() }}
            className={`w-full flex items-center gap-3.5 px-5 py-3.5 text-[15px] text-left active:bg-white/5 disabled:opacity-35
              ${a.destructive ? 'text-red-400' : 'text-white/90'}`}>
            {a.icon && <a.icon size={19} className={a.destructive ? 'text-red-400' : 'text-white/45'} />}
            {a.label}
          </button>
        ))}
      </div>
    </Sheet>
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
      <div className="px-5 pb-4 flex flex-col gap-3">
        {label && <p className="text-xs text-white/45">{label}</p>}
        <input autoFocus value={value} onChange={e => { setValue(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          className="m-input" />
        {error && <p className="text-xs text-red-400 leading-relaxed">{error}</p>}
        <button onClick={submit} disabled={!value.trim() || busy} className="m-btn-primary">{confirmLabel}</button>
      </div>
    </Sheet>
  )
}

export function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className="fixed left-4 right-4 z-[70] slide-up pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 140px)' }}>
      <div className={`mx-auto max-w-sm rounded-2xl px-4 py-3 text-sm shadow-2xl border
        ${toast.ok === false ? 'bg-red-950/95 border-red-500/30 text-red-200' : 'bg-surface-700/95 border-white/10 text-white/90'}`}>
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

export function ScreenHeader({ title, subtitle, left, right }) {
  return (
    <div className="shrink-0 px-5 pb-3 flex items-end gap-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
      {left}
      <div className="flex-1 min-w-0">
        <h1 className="text-[26px] leading-tight font-black text-white tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-xs text-white/40 mt-0.5 truncate">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

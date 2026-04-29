import React, { useState, useEffect } from 'react'
import { Download, X, RefreshCw, CheckCircle2, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

const DISMISSED_KEY = 'nianplay_update_dismissed'

function parseReleaseNotes(notes) {
  if (!notes) return []
  const raw = Array.isArray(notes)
    ? notes.map(n => n.note || n.version || '').join('\n')
    : String(notes)

  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map(line => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 6)
}

export default function UpdateBanner() {
  const [update,    setUpdate]    = useState(null)
  const [phase,     setPhase]     = useState(null)
  const [progress,  setProgress]  = useState(0)
  const [errMsg,    setErrMsg]    = useState('')
  const [dismissed, setDismissed] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  useEffect(() => {
    if (!window.electron?.updater) return
    const unsubs = [
      window.electron.updater.onAvailable(info => {
        if (localStorage.getItem(DISMISSED_KEY) === info.version) return
        setUpdate(info)
        setPhase('available')
      }),
      window.electron.updater.onProgress(p => {
        setPhase('downloading')
        setProgress(p.percent ?? 0)
      }),
      window.electron.updater.onDownloaded(() => {
        setPhase('downloaded')
        setProgress(100)
      }),
      window.electron.updater.onError(msg => {
        setPhase('error')
        setErrMsg(typeof msg === 'string' ? msg : 'Erro ao atualizar')
      }),
    ]
    setTimeout(() => window.electron.updater.check(), 1500)
    return () => unsubs.forEach(u => u?.())
  }, [])

  if (!update || dismissed) return null

  const notes = parseReleaseNotes(update.notes)

  function handleDownload() {
    setPhase('downloading')
    setProgress(0)
    window.electron.updater.download()
  }

  function handleInstall() {
    window.electron.updater.install()
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, update.version)
    setDismissed(true)
  }

  return (
    <div className="bg-brand-600/20 border-b border-brand-500/30 shrink-0">
      <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
        <RefreshCw size={14} className="text-brand-400 shrink-0" />

        <div className="flex-1 min-w-0 flex items-center gap-3">
          <span className="text-white font-medium whitespace-nowrap">
            Nova versão {update.version}
          </span>

          {phase === 'available' && (
            <span className="text-white/50 text-xs truncate">
              {notes[0] || 'Atualize para ter as últimas melhorias.'}
            </span>
          )}

          {phase === 'downloading' && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-white/50 shrink-0 tabular-nums">{Math.round(progress)}%</span>
            </div>
          )}

          {phase === 'downloaded' && (
            <span className="text-green-400 text-xs flex items-center gap-1">
              <CheckCircle2 size={11} /> Pronto para instalar
            </span>
          )}

          {phase === 'error' && (
            <span className="text-red-400 text-xs truncate">{errMsg}</span>
          )}
        </div>

        {notes.length > 0 && phase !== 'downloading' && (
          <button
            onClick={() => setShowNotes(v => !v)}
            className="flex items-center gap-1 text-xs text-white/45 hover:text-white/80 transition-colors shrink-0"
          >
            Mudanças {showNotes ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}

        {phase === 'available' && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            <Download size={12} /> Baixar
          </button>
        )}

        {phase === 'downloading' && (
          <span className="flex items-center gap-1.5 text-xs text-white/40 shrink-0">
            <Loader2 size={12} className="animate-spin" /> Baixando...
          </span>
        )}

        {phase === 'downloaded' && (
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            <CheckCircle2 size={12} /> Instalar e reiniciar
          </button>
        )}

        {phase === 'error' && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            <Download size={12} /> Tentar novamente
          </button>
        )}

        {phase !== 'downloading' && (
          <button
            onClick={handleDismiss}
            className="text-white/30 hover:text-white/70 transition-colors shrink-0"
            title="Dispensar"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {showNotes && notes.length > 0 && (
        <div className="px-10 pb-3">
          <div className="rounded-lg border border-white/10 bg-surface-900/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-white/30 mb-1">O que mudou</p>
            <ul className="space-y-1">
              {notes.map((note, i) => (
                <li key={i} className="text-xs text-white/65 flex gap-2">
                  <span className="text-brand-400">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

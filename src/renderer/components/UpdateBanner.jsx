import React, { useState, useEffect } from 'react'
import { Download, X, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react'

const DISMISSED_KEY = 'nianplay_update_dismissed'

export default function UpdateBanner() {
  const [update,    setUpdate]    = useState(null)   // { version, notes }
  const [phase,     setPhase]     = useState(null)   // null | 'available' | 'downloading' | 'downloaded' | 'error'
  const [progress,  setProgress]  = useState(0)      // 0–100
  const [errMsg,    setErrMsg]    = useState('')
  const [dismissed, setDismissed] = useState(false)

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
    return () => unsubs.forEach(u => u?.())
  }, [])

  if (!update || dismissed) return null

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
    <div className="flex items-center gap-3 bg-brand-600/20 border-b border-brand-500/30 px-4 py-2.5 text-sm shrink-0">
      <RefreshCw size={14} className="text-brand-400 shrink-0" />

      {/* Info / progress */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <span className="text-white font-medium whitespace-nowrap">
          Nova versão {update.version}
        </span>

        {phase === 'available' && (
          <span className="text-white/50 text-xs">Atualize para ter as últimas melhorias.</span>
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

      {/* Action button */}
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
          <Loader2 size={12} className="animate-spin" /> Baixando…
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

      {/* Dismiss — hidden while actively downloading */}
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
  )
}

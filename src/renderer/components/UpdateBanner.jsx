import React, { useState, useEffect } from 'react'
import { Download, X, RefreshCw, ExternalLink } from 'lucide-react'

export default function UpdateBanner() {
  const [update,    setUpdate]    = useState(null)   // { version, notes, downloadUrl }
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!window.electron?.updater) return
    const unsub = window.electron.updater.onAvailable(info => setUpdate(info))
    return () => unsub?.()
  }, [])

  if (!update || dismissed) return null

  function handleDownload() {
    window.electron.updater.openDownload(update.downloadUrl)
  }

  return (
    <div className="flex items-center gap-3 bg-brand-600/20 border-b border-brand-500/30 px-4 py-2.5 text-sm shrink-0">
      <RefreshCw size={14} className="text-brand-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-white font-medium">Nova versão {update.version} disponível!</span>
        <span className="text-white/50 ml-2 text-xs">Atualize para ter as últimas melhorias.</span>
      </div>
      <button
        onClick={handleDownload}
        className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
      >
        <Download size={12} />
        Baixar atualização
        <ExternalLink size={11} className="opacity-60" />
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-white/30 hover:text-white/70 transition-colors shrink-0"
      >
        <X size={15} />
      </button>
    </div>
  )
}

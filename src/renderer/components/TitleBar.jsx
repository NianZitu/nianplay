import React from 'react'
import { Minus, Square, X, Music2 } from 'lucide-react'

export default function TitleBar() {
  const isElectron = !!window.electron

  return (
    <div className="drag-region flex items-center justify-between h-10 bg-surface-800/80 border-b border-white/5 px-4 shrink-0">
      {/* Left: logo */}
      <div className="flex items-center gap-2 no-drag">
        <div className="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center">
          <Music2 size={13} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-white/90 tracking-wide">NianPlay</span>
      </div>

      {/* Center: draggable zone (filled by flex) */}
      <div className="flex-1" />

      {/* Right: window controls */}
      {isElectron && (
        <div className="flex items-center gap-1 no-drag">
          <button
            onClick={() => window.electron.window.minimize()}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <Minus size={13} />
          </button>
          <button
            onClick={() => window.electron.window.maximize()}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <Square size={11} />
          </button>
          <button
            onClick={() => window.electron.window.close()}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-500/80 text-white/50 hover:text-white transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

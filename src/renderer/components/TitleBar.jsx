import React from 'react'
import { Minus, Square, X } from 'lucide-react'

export default function TitleBar() {
  const isElectron = !!window.electron

  return (
    <div className="drag-region flex items-center h-8 bg-surface-900 border-b border-white/[0.04] shrink-0 select-none">
      {/* Spacer for nav rail width */}
      <div className="w-14 shrink-0 flex items-center justify-center">
        <span className="text-[9px] font-bold tracking-[0.2em] text-white/12 uppercase">NP</span>
      </div>

      {/* Center label */}
      <div className="flex-1 flex items-center justify-center pointer-events-none">
        <span className="text-[10px] font-semibold tracking-[0.3em] text-white/12 uppercase">NianPlay</span>
      </div>

      {isElectron && (
        <div className="flex items-center no-drag shrink-0">
          <button
            onClick={() => window.electron.window.minimize()}
            className="w-8 h-8 flex items-center justify-center text-white/20 hover:text-white/60 hover:bg-white/5 transition-colors"
          >
            <Minus size={10} />
          </button>
          <button
            onClick={() => window.electron.window.maximize()}
            className="w-8 h-8 flex items-center justify-center text-white/20 hover:text-white/60 hover:bg-white/5 transition-colors"
          >
            <Square size={9} />
          </button>
          <button
            onClick={() => window.electron.window.close()}
            className="w-8 h-8 flex items-center justify-center text-white/20 hover:text-white hover:bg-red-600/70 transition-colors"
          >
            <X size={10} />
          </button>
        </div>
      )}
    </div>
  )
}

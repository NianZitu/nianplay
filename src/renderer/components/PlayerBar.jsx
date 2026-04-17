import React, { useRef, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, ListMusic, X } from 'lucide-react'
import { usePlayer } from '../store/PlayerContext'

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function QueuePanel({ onClose }) {
  const { upcomingTracks, currentTrack, shuffle, playTrack, queue } = usePlayer()

  return (
    <div className="absolute bottom-full right-0 mb-2 w-80 bg-surface-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <span className="text-sm font-semibold text-white">
          Fila {shuffle ? '(aleatório)' : ''}
        </span>
        <button onClick={onClose} className="btn-ghost p-1 text-white/40"><X size={14} /></button>
      </div>

      {currentTrack && (
        <div className="px-4 py-2.5 border-b border-white/5 bg-brand-600/10">
          <p className="text-xs text-brand-400 mb-1 uppercase tracking-wider font-medium">Tocando agora</p>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded overflow-hidden bg-surface-600 shrink-0">
              {currentTrack.cover_path
                ? <img src={/^https?:\/\//.test(currentTrack.cover_path) ? currentTrack.cover_path : `file://${currentTrack.cover_path}`} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-white/20">♪</div>
              }
            </div>
            <div className="overflow-hidden">
              <p className="text-sm text-white truncate">{currentTrack.title}</p>
              <p className="text-xs text-white/40 truncate">{currentTrack.artist}</p>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-y-auto max-h-72">
        {upcomingTracks.length === 0 ? (
          <p className="text-center text-white/20 text-xs py-6">Fila vazia</p>
        ) : (
          upcomingTracks.slice(0, 30).map((track, i) => (
            <div
              key={`${track.id}-${i}`}
              onDoubleClick={() => playTrack(track)}
              className="flex items-center gap-2.5 px-4 py-2 hover:bg-white/5 cursor-pointer group"
            >
              <span className="text-xs text-white/20 w-4 shrink-0">{i + 1}</span>
              <div className="w-7 h-7 rounded overflow-hidden bg-surface-600 shrink-0">
                {track.cover_path
                  ? <img src={/^https?:\/\//.test(track.cover_path) ? track.cover_path : `file://${track.cover_path}`} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">♪</div>
                }
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs text-white truncate">{track.title}</p>
                <p className="text-xs text-white/40 truncate">{track.artist}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function PlayerBar({ onOpenNowPlaying }) {
  const {
    currentTrack, isPlaying, progress, duration, volume, shuffle,
    togglePlay, skipNext, skipPrev, seek, setVolume, setShuffle,
  } = usePlayer()

  const progressRef  = useRef(null)
  const [showQueue,    setShowQueue]    = useState(false)
  const [dragging,     setDragging]     = useState(false)
  const [dragProgress, setDragProgress] = useState(0)

  function getRatio(clientX) {
    const rect = progressRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  function handleMouseDown(e) {
    if (!currentTrack) return
    setDragging(true)
    setDragProgress(getRatio(e.clientX))
  }

  function handleMouseMove(e) {
    if (!dragging) return
    setDragProgress(getRatio(e.clientX))
  }

  function handleMouseUp(e) {
    if (!dragging) return
    seek(getRatio(e.clientX))
    setDragging(false)
  }

  const displayProgress = dragging ? dragProgress : progress

  return (
    <div className="h-20 bg-surface-800/90 border-t border-white/5 backdrop-blur-md flex items-center px-4 gap-4 shrink-0 relative">
      {/* Cover + track info */}
      <div className="flex items-center gap-3 w-64 shrink-0">
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface-600 shrink-0">
          {currentTrack?.cover_path
            ? <img src={/^https?:\/\//.test(currentTrack.cover_path) ? currentTrack.cover_path : `file://${currentTrack.cover_path}`} alt="cover" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-white/20 text-xl">♪</div>
          }
        </div>
        {currentTrack ? (
          <div
            className="overflow-hidden cursor-pointer group"
            onClick={() => currentTrack && onOpenNowPlaying?.()}
            title="Ver agora tocando"
          >
            <p className="text-sm font-medium text-white truncate group-hover:text-brand-300 transition-colors">{currentTrack.title}</p>
            <p className="text-xs text-white/40 truncate">{currentTrack.artist}</p>
          </div>
        ) : (
          <p className="text-sm text-white/30">Nenhuma faixa</p>
        )}
      </div>

      {/* Center controls */}
      <div className="flex flex-col items-center gap-1.5 flex-1">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShuffle(s => !s)}
            className={`btn-ghost p-1 transition-colors ${shuffle ? 'text-brand-400' : 'text-white/30 hover:text-white/60'}`}
            title="Modo aleatório"
          >
            <Shuffle size={15} />
          </button>
          <button onClick={skipPrev} className="btn-ghost p-1" disabled={!currentTrack}>
            <SkipBack size={18} />
          </button>
          <button
            onClick={togglePlay}
            disabled={!currentTrack}
            className="w-10 h-10 rounded-full bg-brand-600 hover:bg-brand-500 flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
          >
            {isPlaying ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" className="ml-0.5" />}
          </button>
          <button onClick={skipNext} className="btn-ghost p-1" disabled={!currentTrack}>
            <SkipForward size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div
          className="flex items-center gap-2 w-full max-w-lg"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <span className="text-xs text-white/30 w-8 text-right">{formatTime(displayProgress * duration)}</span>
          <div
            ref={progressRef}
            onMouseDown={handleMouseDown}
            className={`flex-1 h-1.5 bg-white/10 rounded-full group relative select-none ${currentTrack ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div
              className={`h-full bg-brand-500 rounded-full relative ${dragging ? '' : 'transition-all'}`}
              style={{ width: `${displayProgress * 100}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow" />
            </div>
          </div>
          <span className="text-xs text-white/30 w-8">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume + queue */}
      <div className="flex items-center gap-2 w-44 justify-end shrink-0 relative">
        <button onClick={() => setVolume(volume > 0 ? 0 : 0.8)} className="btn-ghost p-1">
          {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <input
          type="range" min="0" max="1" step="0.01"
          value={volume}
          onChange={e => setVolume(parseFloat(e.target.value))}
          className="w-20 accent-brand-500 cursor-pointer"
        />
        <button
          onClick={() => setShowQueue(q => !q)}
          className={`btn-ghost p-1 transition-colors ${showQueue ? 'text-brand-400' : 'text-white/30 hover:text-white/60'}`}
          title="Fila de reprodução"
        >
          <ListMusic size={16} />
        </button>

        {showQueue && <QueuePanel onClose={() => setShowQueue(false)} />}
      </div>
    </div>
  )
}

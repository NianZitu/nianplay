import React, { useEffect, useRef, useState } from 'react'
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Shuffle, ListMusic, X, Music2,
} from 'lucide-react'
import { usePlayer } from '../store/PlayerContext'

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function CoverImg({ track, size = 'sm' }) {
  const dim = size === 'lg' ? 'w-10 h-10' : 'w-8 h-8'
  if (!track?.cover_path) {
    return (
      <div className={`${dim} rounded-lg bg-surface-600 flex items-center justify-center text-white/20 shrink-0`}>
        <Music2 size={14} />
      </div>
    )
  }
  const src = /^https?:\/\//.test(track.cover_path)
    ? track.cover_path
    : `file://${track.cover_path}`
  return (
    <img src={src} alt="" className={`${dim} rounded-lg object-cover shrink-0`} />
  )
}

function QueuePanel({ onClose }) {
  const { upcomingItems, currentTrack, shuffle, playQueueIndex } = usePlayer()

  return (
    <div className="absolute bottom-full right-0 mb-2.5 w-80 bg-surface-800 border border-white/10
                    rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-50 slide-up">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
        <div>
          <span className="text-sm font-bold text-white/90">Fila</span>
          {shuffle && <span className="ml-2 badge badge-brand">Aleatório</span>}
        </div>
        <button onClick={onClose} className="btn-ghost p-1 text-white/35">
          <X size={13} />
        </button>
      </div>

      {currentTrack && (
        <div className="px-4 py-3 border-b border-white/6 bg-brand-600/8">
          <p className="text-[10px] text-brand-500 mb-2 uppercase tracking-widest font-bold">Tocando agora</p>
          <div className="flex items-center gap-3">
            <CoverImg track={currentTrack} />
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">{currentTrack.title}</p>
              <p className="text-xs text-white/40 truncate">{currentTrack.artist}</p>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-y-auto max-h-64">
        {upcomingItems.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-white/20 text-xs">
            Fila vazia
          </div>
        ) : (
          upcomingItems.slice(0, 30).map(({ track, queueIndex }, i) => (
            <button
              key={`${track.id}-${i}`}
              onClick={() => playQueueIndex(queueIndex)}
              className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-white/5 transition-colors text-left group"
              title="Tocar agora"
            >
              <span className="text-xs text-white/20 w-5 shrink-0 text-right">{i + 1}</span>
              <CoverImg track={track} />
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-medium text-white truncate">{track.title}</p>
                <p className="text-xs text-white/35 truncate">{track.artist}</p>
              </div>
            </button>
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
    if (!progressRef.current) return 0
    const rect = progressRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  function handleMouseDown(e) {
    if (!currentTrack) return
    e.preventDefault()
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

  useEffect(() => {
    if (!dragging) return

    function handleWindowMove(e) {
      setDragProgress(getRatio(e.clientX))
    }

    function handleWindowUp(e) {
      seek(getRatio(e.clientX))
      setDragging(false)
    }

    window.addEventListener('mousemove', handleWindowMove)
    window.addEventListener('mouseup', handleWindowUp)
    return () => {
      window.removeEventListener('mousemove', handleWindowMove)
      window.removeEventListener('mouseup', handleWindowUp)
    }
  }, [dragging, seek])

  const displayProgress = dragging ? dragProgress : progress
  const coverSrc = currentTrack?.cover_path
    ? (/^https?:\/\//.test(currentTrack.cover_path) ? currentTrack.cover_path : `file://${currentTrack.cover_path}`)
    : null

  return (
    <div className="h-[72px] m-2.5 mt-0 rounded-2xl shrink-0 relative
                    bg-surface-800/98 border border-white/6 backdrop-blur-md
                    shadow-2xl shadow-black/40
                    flex items-center px-4 gap-3">

      {/* Capa + info da faixa */}
      <div className="flex items-center gap-3 w-60 shrink-0">
        <div className="w-11 h-11 rounded-xl overflow-hidden bg-surface-600 shrink-0 shadow-md shadow-black/30">
          {coverSrc
            ? <img src={coverSrc} alt="capa" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-white/15">
                <Music2 size={18} />
              </div>
          }
        </div>
        {currentTrack ? (
          <button
            className="overflow-hidden text-left group"
            onClick={() => onOpenNowPlaying?.()}
            title="Ver agora tocando"
          >
            <p className="text-sm font-semibold text-white/90 truncate group-hover:text-brand-400 transition-colors leading-tight">
              {currentTrack.title}
            </p>
            <p className="text-xs text-white/35 truncate leading-tight mt-0.5">
              {currentTrack.artist}
            </p>
          </button>
        ) : (
          <span className="text-sm text-white/20">Nenhuma faixa</span>
        )}
      </div>

      {/* Controles centrais */}
      <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
        {/* Botões */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShuffle(s => !s)}
            className={`p-1.5 rounded-lg transition-all ${
              shuffle
                ? 'text-brand-400 bg-brand-600/15'
                : 'text-white/25 hover:text-white/55 hover:bg-white/5'
            }`}
            title="Modo aleatório"
          >
            <Shuffle size={14} />
          </button>

          <button
            onClick={skipPrev}
            disabled={!currentTrack}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5
                       disabled:opacity-25 transition-all"
          >
            <SkipBack size={17} />
          </button>

          <button
            onClick={togglePlay}
            disabled={!currentTrack}
            className="w-9 h-9 rounded-full bg-brand-600 hover:bg-brand-500 flex items-center justify-center
                       transition-all active:scale-90 disabled:opacity-25 shadow-md shadow-black/30
                       shadow-brand-600/20"
          >
            {isPlaying
              ? <Pause size={16} fill="white" className="text-white" />
              : <Play  size={16} fill="white" className="text-white ml-0.5" />
            }
          </button>

          <button
            onClick={skipNext}
            disabled={!currentTrack}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5
                       disabled:opacity-25 transition-all"
          >
            <SkipForward size={17} />
          </button>

          <div className="w-7" /> {/* espaçador simétrico */}
        </div>

        {/* Barra de progresso */}
        <div
          className="flex items-center gap-2 w-full max-w-md"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <span className="text-[10px] text-white/25 w-8 text-right tabular-nums">
            {formatTime(displayProgress * duration)}
          </span>

          <div
            ref={progressRef}
            onMouseDown={handleMouseDown}
            className={`flex-1 h-1 bg-white/10 rounded-full group relative select-none
                        ${currentTrack ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div
              className={`h-full bg-brand-500 rounded-full relative ${dragging ? '' : 'transition-all duration-200'}`}
              style={{ width: `${displayProgress * 100}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5
                              bg-white rounded-full opacity-0 group-hover:opacity-100
                              transition-opacity shadow-sm" />
            </div>
          </div>

          <span className="text-[10px] text-white/25 w-8 tabular-nums">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Volume + fila */}
      <div className="flex items-center gap-1.5 w-44 justify-end shrink-0 relative">
        <button
          onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
          className="p-1.5 rounded-lg text-white/35 hover:text-white/70 hover:bg-white/5 transition-all"
        >
          {volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>

        <input
          type="range" min="0" max="1" step="0.01"
          value={volume}
          onChange={e => setVolume(parseFloat(e.target.value))}
          className="w-20 cursor-pointer"
        />

        <button
          onClick={() => setShowQueue(q => !q)}
          className={`p-1.5 rounded-lg transition-all ${
            showQueue
              ? 'text-brand-400 bg-brand-600/15'
              : 'text-white/35 hover:text-white/65 hover:bg-white/5'
          }`}
          title="Fila de reprodução"
        >
          <ListMusic size={15} />
        </button>

        {showQueue && <QueuePanel onClose={() => setShowQueue(false)} />}
      </div>
    </div>
  )
}

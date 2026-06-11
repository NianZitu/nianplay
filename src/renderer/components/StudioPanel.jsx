import React, { useState, useRef, useEffect } from 'react'
import {
  Play, Pause, SkipBack, SkipForward, Shuffle,
  Volume2, VolumeX, List, AlignLeft, Maximize2,
  Music2,
} from 'lucide-react'
import { usePlayer } from '../store/PlayerContext'

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function buildCoverUrl(p) {
  if (!p) return null
  if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('file://')) return p
  return 'file:///' + p.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/')
}

function VUBars({ isPlaying }) {
  return (
    <div className="flex items-end gap-[2px] h-3.5 shrink-0">
      {[350, 500, 280, 420, 320].map((dur, i) => (
        <div
          key={i}
          className="w-[3px] bg-brand-500 rounded-full"
          style={isPlaying ? {
            animation: `vuPulse ${dur}ms ease-in-out infinite alternate`,
            animationDelay: `${i * 60}ms`,
          } : { height: '2px', opacity: 0.3 }}
        />
      ))}
    </div>
  )
}

export default function StudioPanel({ onOpenFullscreen }) {
  const {
    currentTrack, progress, duration, seek,
    isPlaying, togglePlay, skipNext, skipPrev,
    shuffle, setShuffle, playQueueIndex,
    volume, setVolume, queue, currentIdx, upcomingItems,
  } = usePlayer()

  const [activeTab,   setActiveTab]   = useState('queue')
  const [coverError,  setCoverError]  = useState(false)
  const [showVolume,  setShowVolume]  = useState(false)
  const progressRef = useRef(null)

  useEffect(() => { setCoverError(false) }, [currentTrack?.id])

  function handleProgressClick(e) {
    if (!progressRef.current) return
    const rect = progressRef.current.getBoundingClientRect()
    seek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)))
  }

  const cover = currentTrack ? buildCoverUrl(currentTrack.cover_path) : null
  const pct   = (progress || 0) * 100

  // Full display queue: current track first, then upcoming (upcomingItems has correct queueIndex even in shuffle)
  const displayQueue = queue.length > 0
    ? [
        ...(currentIdx >= 0 ? [{ track: queue[currentIdx], queueIndex: currentIdx, isCurrent: true }] : []),
        ...upcomingItems.slice(0, 40).map(item => ({ ...item, isCurrent: false })),
      ]
    : []

  return (
    <aside className="relative flex flex-col w-72 shrink-0 bg-surface-900 border-l border-white/[0.04] overflow-hidden">

      {/* ── Art zone ── */}
      <div className="relative w-full shrink-0 overflow-hidden" style={{ paddingBottom: '100%' }}>
        <div className="absolute inset-0">

          {/* Blurred bg layer */}
          {cover && !coverError ? (
            <img
              src={cover} alt=""
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl"
              style={{ opacity: 0.55 }}
              onError={() => setCoverError(true)}
            />
          ) : (
            <div className="absolute inset-0 bg-surface-800" />
          )}

          {/* Sharp art */}
          {cover && !coverError ? (
            <img
              src={cover} alt={currentTrack?.title}
              className="absolute inset-0 w-full h-full object-cover cursor-pointer transition-transform duration-700 hover:scale-[1.03]"
              onClick={onOpenFullscreen}
              onError={() => setCoverError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Music2 size={48} className="text-white/8" strokeWidth={1} />
            </div>
          )}

          {/* Expand button */}
          <button
            onClick={onOpenFullscreen}
            className="absolute top-3 right-3 z-20 p-1.5 rounded-lg bg-black/30 text-white/40
                       hover:text-white hover:bg-black/55 transition-all opacity-0 hover:opacity-100
                       group-hover:opacity-100"
            style={{ opacity: cover ? undefined : 0 }}
          >
            <Maximize2 size={12} />
          </button>

          {/* Bottom gradient + info */}
          <div className="absolute bottom-0 left-0 right-0 z-10 pt-16 pb-3 px-4"
            style={{ background: 'linear-gradient(to top, #0c0b09 0%, #0c0b0980 55%, transparent 100%)' }}>
            {currentTrack ? (
              <div className="flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-[13px] leading-snug truncate drop-shadow">
                    {currentTrack.title}
                  </p>
                  <p className="text-white/45 text-[11px] mt-0.5 truncate">
                    {currentTrack.artist}
                    {currentTrack.album && <span className="text-white/25"> · {currentTrack.album}</span>}
                  </p>
                </div>
                <VUBars isPlaying={isPlaying} />
              </div>
            ) : (
              <p className="text-white/18 text-xs italic">Nenhuma música tocando</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="shrink-0 px-4 pt-3 pb-2 flex flex-col gap-3">

        {/* Progress bar */}
        <div className="flex flex-col gap-1">
          <div
            ref={progressRef}
            onClick={handleProgressClick}
            className="group relative w-full h-[3px] rounded-full cursor-pointer overflow-visible"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <div
              className="absolute left-0 top-0 h-full bg-brand-500 rounded-full transition-none"
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white
                         shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-white/20 tabular-nums">
            <span>{formatTime((progress || 0) * (duration || 0))}</span>
            <span>{formatTime(duration || 0)}</span>
          </div>
        </div>

        {/* Transport row */}
        <div className="flex items-center justify-between px-1">
          <button
            onClick={() => setShuffle(s => !s)}
            className={`p-1.5 rounded-lg transition-all ${shuffle ? 'text-brand-400 bg-brand-600/15' : 'text-white/20 hover:text-white/50 hover:bg-white/5'}`}
            title="Aleatório"
          >
            <Shuffle size={14} strokeWidth={shuffle ? 2 : 1.5} />
          </button>

          <button onClick={skipPrev}
            className="p-2 rounded-xl text-white/45 hover:text-white hover:bg-white/5 transition-all">
            <SkipBack size={18} strokeWidth={1.5} />
          </button>

          <button
            onClick={togglePlay}
            className="w-11 h-11 rounded-full bg-brand-600 hover:bg-brand-500 flex items-center justify-center
                       transition-all active:scale-90 shadow-xl shadow-brand-600/25"
          >
            {isPlaying
              ? <Pause size={18} fill="white" className="text-white" />
              : <Play  size={18} fill="white" className="text-white ml-0.5" />
            }
          </button>

          <button onClick={skipNext}
            className="p-2 rounded-xl text-white/45 hover:text-white hover:bg-white/5 transition-all">
            <SkipForward size={18} strokeWidth={1.5} />
          </button>

          {/* Volume */}
          <div className="relative">
            <button
              onClick={() => setShowVolume(v => !v)}
              className={`p-1.5 rounded-lg transition-all ${showVolume ? 'text-white/80 bg-white/8' : 'text-white/20 hover:text-white/50 hover:bg-white/5'}`}
              title="Volume"
            >
              {(volume || 0) < 0.01 ? <VolumeX size={14} /> : <Volume2 size={14} strokeWidth={1.5} />}
            </button>
            {showVolume && (
              <div className="absolute bottom-full right-0 mb-2 bg-surface-700 border border-white/10
                              rounded-xl shadow-xl p-3 flex flex-col items-center gap-2 slide-up z-50"
                style={{ width: '40px' }}>
                <input
                  type="range" min="0" max="1" step="0.02"
                  value={volume ?? 0.8}
                  onChange={e => setVolume(parseFloat(e.target.value))}
                  className="cursor-pointer volume-vertical"
                  style={{
                    writingMode: 'vertical-lr',
                    direction: 'rtl',
                    width: '4px',
                    height: '80px',
                    WebkitAppearance: 'slider-vertical',
                    appearance: 'slider-vertical',
                  }}
                />
                <span className="text-[9px] text-white/25 tabular-nums">{Math.round((volume ?? 0.8) * 100)}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex shrink-0 border-y border-white/[0.04]">
        {[
          { id: 'queue',  icon: List,      label: 'Fila' },
          { id: 'lyrics', icon: AlignLeft, label: 'Letra' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium
                        transition-all duration-150 relative
              ${activeTab === t.id ? 'text-brand-400' : 'text-white/22 hover:text-white/50'}`}
          >
            <t.icon size={11} />
            {t.label}
            {activeTab === t.id && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-brand-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {activeTab === 'queue' && (
          <div className="flex flex-col py-1">
            {displayQueue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <List size={24} className="text-white/8" strokeWidth={1} />
                <p className="text-white/15 text-xs">Fila vazia</p>
              </div>
            ) : (
              displayQueue.map(({ track, queueIndex, isCurrent }) => (
                <button
                  key={`${track.id}-${queueIndex}`}
                  onDoubleClick={() => !isCurrent && playQueueIndex(queueIndex)}
                  className={`flex items-center gap-2.5 px-3 py-2 text-left transition-colors w-full
                    ${isCurrent ? 'bg-brand-600/8' : 'hover:bg-white/[0.03]'}`}
                >
                  <div className="w-7 h-7 rounded-md overflow-hidden bg-surface-600 shrink-0 relative">
                    {track.cover_path ? (
                      <img src={buildCoverUrl(track.cover_path)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/15 text-[9px]">♪</div>
                    )}
                    {isCurrent && isPlaying && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="flex items-end gap-[2px] h-2.5">
                          {[1,2,3].map(i => (
                            <div key={i} className="w-[2px] bg-brand-400 rounded-full"
                              style={{ animation: `vuPulse ${300 + i * 80}ms ease-in-out infinite alternate`, animationDelay: `${i * 50}ms` }} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] truncate leading-snug ${isCurrent ? 'text-brand-300 font-semibold' : 'text-white/65'}`}>
                      {track.title}
                    </p>
                    <p className="text-[9px] text-white/25 truncate">{track.artist}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {activeTab === 'lyrics' && (
          <div className="px-5 py-4">
            {currentTrack?.lyrics ? (
              <pre className="text-[11px] text-white/50 whitespace-pre-wrap font-sans leading-loose">
                {currentTrack.lyrics}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                <AlignLeft size={24} className="text-white/8" strokeWidth={1} />
                <p className="text-white/15 text-xs">Sem letra disponível</p>
                <p className="text-white/10 text-[10px]">Adicione via Painel do Maestro</p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

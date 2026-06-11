import React, { useState, useRef, useEffect } from 'react'
import {
  X, Search, Save, ChevronDown, ExternalLink,
  SkipBack, SkipForward, Play, Pause, Shuffle, Disc3, ImageIcon,
} from 'lucide-react'
import { usePlayer } from '../store/PlayerContext'

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function VinylDisc({ cover, isPlaying }) {
  return (
    <div
      className="relative w-64 h-64 rounded-full shadow-2xl overflow-hidden"
      style={{ animation: isPlaying ? 'spin 4s linear infinite' : 'none' }}
    >
      {cover
        ? <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
        : <div className="absolute inset-0 bg-surface-800" />
      }
      <svg viewBox="0 0 256 256" className="absolute inset-0 w-full h-full">
        <circle cx="128" cy="128" r="128" fill="rgba(0,0,0,0.3)" />
        {Array.from({ length: 13 }, (_, i) => {
          const r = 62 + i * 5
          return (
            <g key={i}>
              <circle cx="128" cy="128" r={r}       fill="none" stroke="rgba(0,0,0,0.5)"      strokeWidth="1.4" />
              <circle cx="128" cy="128" r={r - 1.2} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.7" />
            </g>
          )
        })}
        <circle cx="128" cy="128" r="50" fill="#0c0b09" />
        <circle cx="128" cy="128" r="47" fill="none" stroke="#252119" strokeWidth="1.2" />
        <circle cx="128" cy="128" r="5"  fill="#050504" />
      </svg>
    </div>
  )
}

export default function NowPlayingModal({ onClose }) {
  const {
    currentTrack, progress, duration, seek,
    isPlaying, togglePlay, skipNext, skipPrev, shuffle, setShuffle,
  } = usePlayer()
  const progressRef = useRef(null)

  const [coverInput,    setCoverInput]    = useState('')
  const [showCoverEdit, setShowCoverEdit] = useState(false)
  const [savingCover,   setSavingCover]   = useState(false)
  const [freshTrack,    setFreshTrack]    = useState(null)
  const [coverError,    setCoverError]    = useState(false)
  const [showVinyl,     setShowVinyl]     = useState(false)

  useEffect(() => {
    if (!currentTrack?.id || !window.electron) return
    window.electron.library.getTrack(currentTrack.id).then(t => {
      if (t) setFreshTrack(t)
    })
  }, [currentTrack?.id])

  useEffect(() => { setCoverError(false) }, [currentTrack?.id])

  if (!currentTrack) return null
  const track = freshTrack || currentTrack

  function buildCoverUrl(p) {
    if (!p) return null
    if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('file://')) return p
    return 'file:///' + p.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/')
  }
  const cover = buildCoverUrl(track.cover_path)

  function handleProgressClick(e) {
    const rect = progressRef.current.getBoundingClientRect()
    seek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)))
  }

  async function handleChooseCover() {
    if (!window.electron) return
    const p = await window.electron.playlists.chooseCover()
    if (p) setCoverInput(`file://${p}`)
  }

  async function handleSaveCover() {
    if (!window.electron || !coverInput) return
    setSavingCover(true)
    const raw = coverInput.startsWith('file://') ? coverInput.slice(7) : coverInput
    await window.electron.library.updateTrack({ ...track, cover_path: raw })
    setSavingCover(false)
    setShowCoverEdit(false)
    setFreshTrack(prev => ({ ...prev, cover_path: raw }))
    setCoverInput('')
  }

  return (
    <>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div
        className="fixed inset-0 z-50 flex flex-col overflow-hidden fade-in"
        style={{ background: 'rgba(8,7,5,0.97)' }}
      >
        {/* Fundo desfocado da capa */}
        {cover && !coverError && (
          <div className="absolute inset-0 pointer-events-none">
            <img
              src={cover} alt=""
              className="w-full h-full object-cover scale-110 blur-3xl"
              style={{ opacity: 0.15 }}
            />
          </div>
        )}

        {/* Fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-xl text-white/30 hover:text-white
                     hover:bg-white/8 transition-all"
        >
          <X size={18} />
        </button>

        <div className="relative flex-1 flex gap-10 px-10 py-8 overflow-hidden items-start">

          {/* Coluna esquerda: arte + controles */}
          <div className="flex flex-col items-center gap-5 w-72 shrink-0 pt-4">

            {/* Arte / Vinil */}
            <div className="relative w-64 h-64">
              {showVinyl ? (
                <VinylDisc cover={cover} isPlaying={isPlaying} />
              ) : (
                <div className="group rounded-2xl overflow-hidden bg-surface-700 shadow-2xl w-full h-full relative">
                  {cover && !coverError
                    ? <img src={cover} alt="" className="w-full h-full object-cover" onError={() => setCoverError(true)} />
                    : <div className="w-full h-full flex items-center justify-center text-white/10 text-7xl">♪</div>
                  }
                  <div
                    className="absolute inset-0 rounded-2xl bg-black/55 flex flex-col items-center justify-center gap-1.5
                                opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={() => setShowCoverEdit(v => !v)}
                  >
                    <Search size={18} className="text-white" />
                    <span className="text-xs text-white font-medium">Mudar capa</span>
                  </div>
                </div>
              )}
            </div>

            {/* Alternador Capa / Vinil */}
            <div className="flex gap-1 bg-surface-800/80 border border-white/8 rounded-xl p-1">
              <button
                onClick={() => { setShowVinyl(false); setShowCoverEdit(false) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${!showVinyl ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}
              >
                <ImageIcon size={11} /> Capa
              </button>
              <button
                onClick={() => { setShowVinyl(true); setShowCoverEdit(false) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${showVinyl ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}
              >
                <Disc3 size={11} /> Vinil
              </button>
            </div>

            {/* Edição de capa */}
            {showCoverEdit && !showVinyl && (
              <div className="w-64 bg-surface-800 border border-white/10 rounded-2xl p-4 flex flex-col gap-2 shadow-2xl slide-up">
                <input
                  autoFocus
                  value={coverInput}
                  onChange={e => setCoverInput(e.target.value)}
                  placeholder="URL ou caminho da capa..."
                  className="input-base text-xs"
                />
                <div className="flex gap-2">
                  <button onClick={handleChooseCover} className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1">
                    <Search size={10} /> Arquivo
                  </button>
                  <button
                    onClick={() => window.electron?.playlists.searchImageBrowser(track.title)}
                    className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1"
                  >
                    <ExternalLink size={10} /> Google
                  </button>
                  <button
                    onClick={handleSaveCover}
                    disabled={!coverInput || savingCover}
                    className="btn-primary text-xs px-2.5 py-1.5 flex items-center gap-1 disabled:opacity-40"
                  >
                    <Save size={10} /> Salvar
                  </button>
                </div>
              </div>
            )}

            {/* Info da faixa */}
            <div className="text-center">
              <p className="text-xl font-bold text-white leading-tight tracking-tight">{track.title}</p>
              <p className="text-sm text-white/45 mt-1">{track.artist}</p>
              {track.album && <p className="text-xs text-white/25 mt-0.5">{track.album}</p>}
            </div>

            {/* Controles */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShuffle(s => !s)}
                className={`p-1.5 rounded-lg transition-all ${shuffle ? 'text-brand-400 bg-brand-600/15' : 'text-white/25 hover:text-white/55 hover:bg-white/5'}`}
                title="Aleatório"
              >
                <Shuffle size={16} />
              </button>
              <button onClick={skipPrev} className="p-1.5 rounded-lg text-white/55 hover:text-white hover:bg-white/5 transition-all">
                <SkipBack size={22} />
              </button>
              <button
                onClick={togglePlay}
                className="w-12 h-12 rounded-full bg-brand-600 hover:bg-brand-500 flex items-center justify-center
                           transition-all active:scale-90 shadow-lg shadow-brand-600/25"
              >
                {isPlaying
                  ? <Pause size={20} fill="white" className="text-white" />
                  : <Play  size={20} fill="white" className="text-white ml-0.5" />
                }
              </button>
              <button onClick={skipNext} className="p-1.5 rounded-lg text-white/55 hover:text-white hover:bg-white/5 transition-all">
                <SkipForward size={22} />
              </button>
              <div className="w-7" />
            </div>

            {/* Progresso */}
            <div className="w-full flex flex-col gap-1.5">
              <div
                ref={progressRef}
                onClick={handleProgressClick}
                className="w-full h-1 bg-white/10 rounded-full cursor-pointer group relative"
              >
                <div
                  className="h-full bg-brand-500 rounded-full relative"
                  style={{ width: `${progress * 100}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full
                                  opacity-0 group-hover:opacity-100 shadow transition-opacity" />
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-white/25 tabular-nums">
                <span>{formatTime(progress * duration)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>

          {/* Coluna direita: letra */}
          <div className="flex-1 flex flex-col overflow-hidden h-full">
            <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-4">Letra</p>
            {track.lyrics ? (
              <div className="flex-1 overflow-y-auto">
                <pre className="text-sm text-white/65 whitespace-pre-wrap font-sans leading-loose">
                  {track.lyrics}
                </pre>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm text-white/20">Sem letra disponível.</p>
                <p className="text-xs text-white/14">Adicione via Painel do Maestro.</p>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="shrink-0 flex items-center justify-center py-3 text-white/15 hover:text-white/45 transition-colors"
        >
          <ChevronDown size={18} />
        </button>
      </div>
    </>
  )
}

import React, { useState, useRef, useEffect } from 'react'
import { X, Search, Save, ChevronDown, ExternalLink, SkipBack, SkipForward, Play, Pause, Shuffle, Disc3, ImageIcon } from 'lucide-react'
import { usePlayer } from '../store/PlayerContext'

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// Vinyl disc — cover fills the full disc, grooves overlay on top
function VinylDisc({ cover, isPlaying }) {
  return (
    <div
      className="relative w-64 h-64 rounded-full shadow-2xl overflow-hidden"
      style={{ animation: isPlaying ? 'spin 4s linear infinite' : 'none' }}
    >
      {/* Cover art as the disc surface */}
      {cover
        ? <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
        : <div className="absolute inset-0 bg-zinc-900" />
      }

      {/* Groove texture + center label overlay */}
      <svg viewBox="0 0 256 256" className="absolute inset-0 w-full h-full">
        {/* Slight dark tint so grooves read clearly over any cover */}
        <circle cx="128" cy="128" r="128" fill="rgba(0,0,0,0.28)" />

        {/* Vinyl groove rings — dark band + light shimmer pairs */}
        {Array.from({ length: 13 }, (_, i) => {
          const r = 62 + i * 5
          return (
            <g key={i}>
              <circle cx="128" cy="128" r={r}       fill="none" stroke="rgba(0,0,0,0.48)"    strokeWidth="1.4" />
              <circle cx="128" cy="128" r={r - 1.2} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.7" />
            </g>
          )
        })}

        {/* Center label — solid dark, normal vinyl look */}
        <circle cx="128" cy="128" r="50" fill="#0c0c1a" />
        <circle cx="128" cy="128" r="47" fill="none" stroke="#242438" strokeWidth="1.2" />
        <circle cx="128" cy="128" r="43" fill="none" stroke="#1a1a2e" strokeWidth="0.6" />

        {/* Center spindle hole */}
        <circle cx="128" cy="128" r="5" fill="#050508" />
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

  // Reset vinyl/cover error when track changes
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
    const ratio = (e.clientX - rect.left) / rect.width
    seek(Math.max(0, Math.min(1, ratio)))
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
      {/* Spin animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ background: 'rgba(10,10,18,0.97)' }}>
        {/* Blurred cover background */}
        {cover && !coverError && (
          <div className="absolute inset-0 pointer-events-none">
            <img src={cover} alt="" className="w-full h-full object-cover scale-110 blur-3xl opacity-20" />
          </div>
        )}

        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 z-10 btn-ghost p-2 text-white/40 hover:text-white">
          <X size={20} />
        </button>

        <div className="relative flex-1 flex gap-8 p-8 overflow-hidden">
          {/* Left: cover/vinyl + info + controls */}
          <div className="flex flex-col items-center justify-center gap-5 w-80 shrink-0">

            {/* Cover / Vinyl display */}
            <div className="relative w-64 h-64">
              {showVinyl ? (
                <VinylDisc cover={cover} isPlaying={isPlaying} />
              ) : (
                <div className="group rounded-2xl overflow-hidden bg-surface-700 shadow-2xl w-full h-full">
                  {cover && !coverError
                    ? <img src={cover} alt="" className="w-full h-full object-cover" onError={() => setCoverError(true)} />
                    : <div className="w-full h-full flex items-center justify-center text-white/20 text-6xl">♪</div>
                  }
                  <div
                    className="absolute inset-0 rounded-2xl bg-black/50 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={() => setShowCoverEdit(v => !v)}
                  >
                    <Search size={20} className="text-white" />
                    <span className="text-xs text-white">Mudar capa</span>
                  </div>
                </div>
              )}
            </div>

            {/* Cover / Vinyl toggle button */}
            <div className="flex gap-1 bg-surface-800 border border-white/10 rounded-lg p-1">
              <button
                onClick={() => { setShowVinyl(false); setShowCoverEdit(false) }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all ${!showVinyl ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}
              >
                <ImageIcon size={12} /> Capa
              </button>
              <button
                onClick={() => { setShowVinyl(true); setShowCoverEdit(false) }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all ${showVinyl ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}
              >
                <Disc3 size={12} /> Vinil
              </button>
            </div>

            {/* Cover edit */}
            {showCoverEdit && !showVinyl && (
              <div className="w-64 bg-surface-800 border border-white/10 rounded-xl p-4 flex flex-col gap-2 shadow-xl">
                <input autoFocus value={coverInput} onChange={e => setCoverInput(e.target.value)}
                  placeholder="URL ou caminho da capa..." className="input-base text-xs" />
                <div className="flex gap-2 flex-wrap">
                  <button onClick={handleChooseCover} className="btn-ghost text-xs px-2 py-1 flex items-center gap-1">
                    <Search size={10} /> Arquivo
                  </button>
                  <button onClick={() => window.electron?.playlists.searchImageBrowser(track.title)}
                    className="btn-ghost text-xs px-2 py-1 flex items-center gap-1">
                    <ExternalLink size={10} /> Google
                  </button>
                  <button onClick={handleSaveCover} disabled={!coverInput || savingCover}
                    className="btn-primary text-xs px-2 py-1 flex items-center gap-1 disabled:opacity-40">
                    <Save size={10} /> Salvar
                  </button>
                </div>
              </div>
            )}

            {/* Track info */}
            <div className="text-center">
              <p className="text-xl font-bold text-white leading-tight">{track.title}</p>
              <p className="text-sm text-white/50 mt-1">{track.artist}</p>
              {track.album && <p className="text-xs text-white/30 mt-0.5">{track.album}</p>}
            </div>

            {/* Playback controls */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShuffle(s => !s)}
                className={`btn-ghost p-1.5 transition-colors ${shuffle ? 'text-brand-400' : 'text-white/30 hover:text-white/60'}`}
                title="Aleatório"
              >
                <Shuffle size={16} />
              </button>
              <button onClick={skipPrev} className="btn-ghost p-1.5 text-white/60 hover:text-white">
                <SkipBack size={20} />
              </button>
              <button
                onClick={togglePlay}
                className="w-12 h-12 rounded-full bg-brand-600 hover:bg-brand-500 flex items-center justify-center transition-all active:scale-95"
              >
                {isPlaying
                  ? <Pause size={20} fill="white" />
                  : <Play size={20} fill="white" className="ml-0.5" />
                }
              </button>
              <button onClick={skipNext} className="btn-ghost p-1.5 text-white/60 hover:text-white">
                <SkipForward size={20} />
              </button>
            </div>

            {/* Progress */}
            <div className="w-full flex flex-col gap-1.5">
              <div
                ref={progressRef}
                onClick={handleProgressClick}
                className="w-full h-1.5 bg-white/10 rounded-full cursor-pointer group relative"
              >
                <div className="h-full bg-brand-500 rounded-full relative" style={{ width: `${progress * 100}%` }}>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow" />
                </div>
              </div>
              <div className="flex justify-between text-xs text-white/30">
                <span>{formatTime(progress * duration)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>

          {/* Right: lyrics */}
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {track.lyrics ? (
              <div className="flex-1 overflow-y-auto">
                <p className="text-xs text-white/30 uppercase tracking-wider font-medium mb-3">Letra</p>
                <pre className="text-sm text-white/70 whitespace-pre-wrap font-sans leading-relaxed">{track.lyrics}</pre>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-white/20 text-sm">
                Sem letra disponível. Adicione via Painel do Maestro.
              </div>
            )}
          </div>
        </div>

        <button onClick={onClose} className="shrink-0 flex items-center justify-center py-3 text-white/20 hover:text-white/50 transition-colors">
          <ChevronDown size={20} />
        </button>
      </div>
    </>
  )
}

import React, { useState, useEffect } from 'react'
import { X, Save, Sliders, FileText, Youtube, Volume2, ListMusic, Check, Plus } from 'lucide-react'

export default function MaestroModal({ track, onClose, onSave }) {
  const [gain,      setGain]      = useState(track.gain   ?? 0)
  const [lyrics,    setLyrics]    = useState(track.lyrics ?? '')
  const [ytUrl,     setYtUrl]     = useState(track.yt_url ?? '')
  const [playlists, setPlaylists] = useState([])
  const [membership,setMembership]= useState(new Set()) // playlist IDs this track belongs to
  const [adding,    setAdding]    = useState(null) // playlist ID being added

  useEffect(() => {
    if (!window.electron) return
    window.electron.playlists.getAll().then(async list => {
      setPlaylists(list || [])
      // Check membership for each playlist
      const memberOf = new Set()
      for (const pl of (list || [])) {
        const tracks = await window.electron.playlists.getTracks(pl.id)
        if (tracks?.some(t => t.id === track.id)) memberOf.add(pl.id)
      }
      setMembership(memberOf)
    })
  }, [track.id])

  function handleSave() {
    onSave({ ...track, gain, lyrics, yt_url: ytUrl })
  }

  async function handleAddToPlaylist(playlistId) {
    if (!window.electron || membership.has(playlistId)) return
    setAdding(playlistId)
    await window.electron.playlists.addTrack(playlistId, track.id)
    setMembership(prev => new Set(prev).add(playlistId))
    setAdding(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="card w-full max-w-lg p-6 flex flex-col gap-5 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Sliders size={16} className="text-brand-400" />
              Painel do Maestro
            </h2>
            <p className="text-xs text-white/40 mt-0.5 truncate max-w-xs">{track.title} — {track.artist}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X size={16} />
          </button>
        </div>

        {/* Gain */}
        <div>
          <label className="text-xs text-white/50 mb-2 flex items-center gap-1.5">
            <Volume2 size={12} />
            Ganho (Gain) — <span className={`font-mono font-semibold ${gain > 0 ? 'text-green-400' : gain < 0 ? 'text-red-400' : 'text-white/60'}`}>{gain > 0 ? '+' : ''}{gain.toFixed(1)} dB</span>
          </label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/30 w-8 text-right">-20</span>
            <input
              type="range" min="-20" max="20" step="0.5"
              value={gain}
              onChange={e => setGain(parseFloat(e.target.value))}
              className="flex-1 accent-brand-500 cursor-pointer"
            />
            <span className="text-xs text-white/30 w-6">+20</span>
            <button onClick={() => setGain(0)} className="text-xs text-white/30 hover:text-white/70 transition-colors ml-1">
              Reset
            </button>
          </div>
        </div>

        {/* Add to playlist */}
        {playlists.length > 0 && (
          <div>
            <label className="text-xs text-white/50 mb-2 flex items-center gap-1.5">
              <ListMusic size={12} />
              Adicionar à Playlist
            </label>
            <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
              {playlists.map(pl => {
                const isMember = membership.has(pl.id)
                return (
                  <div key={pl.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/5">
                    <div className="w-7 h-7 rounded overflow-hidden bg-surface-600 shrink-0">
                      {pl.cover_url
                        ? <img src={pl.cover_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">♫</div>
                      }
                    </div>
                    <span className="flex-1 text-sm text-white truncate">{pl.name}</span>
                    <span className="text-xs text-white/30 shrink-0">{pl.trackCount} faixas</span>
                    <button
                      onClick={() => handleAddToPlaylist(pl.id)}
                      disabled={isMember || adding === pl.id}
                      className={`shrink-0 p-1 rounded transition-colors ${
                        isMember
                          ? 'text-green-400 cursor-default'
                          : 'btn-ghost text-brand-400 hover:text-brand-300'
                      }`}
                      title={isMember ? 'Já está nesta playlist' : 'Adicionar'}
                    >
                      {isMember ? <Check size={14} /> : <Plus size={14} />}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* YouTube URL */}
        <div>
          <label className="text-xs text-white/50 mb-1.5 flex items-center gap-1.5">
            <Youtube size={12} />
            URL do vídeo YouTube (fundo visual)
          </label>
          <input
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={ytUrl}
            onChange={e => setYtUrl(e.target.value)}
            className="input-base w-full text-sm"
          />
        </div>

        {/* Lyrics */}
        <div>
          <label className="text-xs text-white/50 mb-1.5 flex items-center gap-1.5">
            <FileText size={12} />
            Letra da música
          </label>
          <textarea
            rows={5}
            placeholder="Cole a letra aqui..."
            value={lyrics}
            onChange={e => setLyrics(e.target.value)}
            className="input-base w-full text-sm resize-none select-text"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost text-sm">Cancelar</button>
          <button onClick={handleSave} className="btn-primary flex items-center gap-2 text-sm">
            <Save size={14} /> Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

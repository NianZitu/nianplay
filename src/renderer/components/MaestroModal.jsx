import React, { useState, useEffect } from 'react'
import {
  X, Save, Sliders, FileText, Youtube, Volume2,
  ListMusic, Check, Plus, Scissors, Trash2,
} from 'lucide-react'

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0))
  const min = Math.floor(value / 60)
  const sec = value % 60
  return `${min}:${String(sec).padStart(2, '0')}`
}

function parseTime(value) {
  const text = String(value || '').trim()
  if (!text) return null
  if (text.includes(':')) {
    const parts = text.split(':').map(part => Number(part.trim()))
    if (parts.some(part => !Number.isFinite(part))) return null
    return parts.reduce((total, part) => total * 60 + part, 0)
  }
  const num = Number(text.replace(',', '.'))
  return Number.isFinite(num) ? num : null
}

function normalizeCuts(cuts, duration = 0) {
  const max = Number(duration) || 0
  return (Array.isArray(cuts) ? cuts : [])
    .map(cut => ({
      start: Math.max(0, Number(cut.start) || 0),
      end:   Math.max(0, Number(cut.end)   || 0),
      label: String(cut.label || '').trim(),
    }))
    .filter(cut => cut.end > cut.start)
    .map(cut => max ? { ...cut, start: Math.min(cut.start, max), end: Math.min(cut.end, max) } : cut)
    .filter(cut => cut.end > cut.start)
    .sort((a, b) => a.start - b.start)
}

function SectionLabel({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-white/35 font-bold uppercase tracking-wider mb-2">
      <Icon size={11} className="text-brand-500" />
      {children}
    </div>
  )
}

export default function MaestroModal({ track, onClose, onSave }) {
  const [gain,       setGain]       = useState(track.gain   ?? 0)
  const [lyrics,     setLyrics]     = useState(track.lyrics ?? '')
  const [ytUrl,      setYtUrl]      = useState(track.yt_url ?? '')
  const [cuts,       setCuts]       = useState(() => normalizeCuts(track.cut_segments, track.duration))
  const [cutStart,   setCutStart]   = useState('')
  const [cutEnd,     setCutEnd]     = useState('')
  const [cutError,   setCutError]   = useState('')
  const [playlists,  setPlaylists]  = useState([])
  const [membership, setMembership] = useState(new Set())
  const [adding,     setAdding]     = useState(null)

  useEffect(() => {
    if (!window.electron) return
    window.electron.playlists.getAll().then(async list => {
      setPlaylists(list || [])
      const memberOf = new Set()
      for (const pl of (list || [])) {
        const tracks = await window.electron.playlists.getTracks(pl.id)
        if (tracks?.some(t => t.id === track.id)) memberOf.add(pl.id)
      }
      setMembership(memberOf)
    })
  }, [track.id])

  function handleSave() {
    onSave({ ...track, gain, lyrics, yt_url: ytUrl, cut_segments: normalizeCuts(cuts, track.duration) })
  }

  function handleAddCut() {
    const start = parseTime(cutStart)
    const end   = parseTime(cutEnd)
    if (start == null || end == null) { setCutError('Informe início e fim do corte.'); return }
    if (end <= start) { setCutError('O fim precisa ser maior que o início.'); return }
    if (track.duration && start >= track.duration) { setCutError('O início está fora da duração da música.'); return }
    setCuts(normalizeCuts([...cuts, { start, end }], track.duration))
    setCutStart('')
    setCutEnd('')
    setCutError('')
  }

  function handleRemoveCut(index) {
    setCuts(prev => prev.filter((_, i) => i !== index))
  }

  async function handleAddToPlaylist(playlistId) {
    if (!window.electron || membership.has(playlistId)) return
    setAdding(playlistId)
    await window.electron.playlists.addTrack(playlistId, track.id)
    setMembership(prev => new Set(prev).add(playlistId))
    setAdding(null)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="modal-header">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders size={15} className="text-brand-500 shrink-0" />
              Painel do Maestro
            </h2>
            <p className="text-xs text-white/35 mt-0.5 truncate">
              {track.title} — {track.artist}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 shrink-0"><X size={15} /></button>
        </div>

        <div className="flex flex-col gap-5 p-5">

          {/* Ganho */}
          <div>
            <SectionLabel icon={Volume2}>
              Ganho (Gain) — {' '}
              <span className={`font-mono font-bold ${gain > 0 ? 'text-green-400' : gain < 0 ? 'text-red-400' : 'text-white/50'}`}>
                {gain > 0 ? '+' : ''}{gain.toFixed(1)} dB
              </span>
            </SectionLabel>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/25 w-8 text-right">-20</span>
              <input
                type="range" min="-20" max="20" step="0.5"
                value={gain}
                onChange={e => setGain(parseFloat(e.target.value))}
                className="flex-1 cursor-pointer"
              />
              <span className="text-[10px] text-white/25 w-6">+20</span>
              <button
                onClick={() => setGain(0)}
                className="text-xs text-white/30 hover:text-brand-400 transition-colors ml-1"
              >
                Zerar
              </button>
            </div>
          </div>

          {/* Cortes */}
          <div>
            <SectionLabel icon={Scissors}>
              Cortar interrupções
              {track.duration ? <span className="text-white/20 normal-case font-normal ml-1">duração {formatTime(track.duration)}</span> : null}
            </SectionLabel>
            <div className="rounded-xl border border-white/8 bg-surface-900/30 p-3 flex flex-col gap-3">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input
                  value={cutStart}
                  onChange={e => setCutStart(e.target.value)}
                  placeholder="Início (1:23)"
                  className="input-base text-xs"
                />
                <input
                  value={cutEnd}
                  onChange={e => setCutEnd(e.target.value)}
                  placeholder="Fim (1:48)"
                  className="input-base text-xs"
                />
                <button onClick={handleAddCut} className="btn-secondary text-xs flex items-center gap-1.5">
                  <Plus size={11} /> Adicionar
                </button>
              </div>

              {cutError && <p className="text-xs text-red-300">{cutError}</p>}

              {cuts.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {cuts.map((cut, index) => (
                    <div
                      key={`${cut.start}-${cut.end}-${index}`}
                      className="flex items-center gap-2 rounded-xl bg-surface-700/60 border border-white/6 px-3 py-2"
                    >
                      <span className="text-xs text-white/65 flex-1">
                        Pular de{' '}
                        <span className="font-mono text-brand-400">{formatTime(cut.start)}</span>
                        {' '}até{' '}
                        <span className="font-mono text-brand-400">{formatTime(cut.end)}</span>
                      </span>
                      <button
                        onClick={() => handleRemoveCut(index)}
                        className="p-1 rounded-lg text-white/30 hover:text-red-300 hover:bg-red-500/10 transition-all"
                        title="Remover corte"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/25 leading-relaxed">
                  Adicione trechos para o player pular automaticamente sem modificar o arquivo original.
                </p>
              )}
            </div>
          </div>

          {/* Playlists */}
          {playlists.length > 0 && (
            <div>
              <SectionLabel icon={ListMusic}>Adicionar à playlist</SectionLabel>
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                {playlists.map(pl => {
                  const isMember = membership.has(pl.id)
                  return (
                    <div key={pl.id} className="flex items-center gap-2.5 py-2 px-2 rounded-xl hover:bg-white/4">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-surface-600 shrink-0">
                        {pl.cover_url
                          ? <img src={pl.cover_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-white/20"><ListMusic size={12} /></div>
                        }
                      </div>
                      <span className="flex-1 text-sm text-white/85 truncate">{pl.name}</span>
                      <span className="text-[11px] text-white/25 shrink-0">{pl.trackCount} faixas</span>
                      <button
                        onClick={() => handleAddToPlaylist(pl.id)}
                        disabled={isMember || adding === pl.id}
                        className={`shrink-0 p-1.5 rounded-lg transition-all ${
                          isMember
                            ? 'text-green-400 cursor-default'
                            : 'text-brand-400 hover:text-brand-300 hover:bg-brand-600/15'
                        }`}
                        title={isMember ? 'Já está nesta playlist' : 'Adicionar'}
                      >
                        {isMember ? <Check size={13} /> : <Plus size={13} />}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* URL YouTube */}
          <div>
            <SectionLabel icon={Youtube}>URL do vídeo YouTube</SectionLabel>
            <input
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={ytUrl}
              onChange={e => setYtUrl(e.target.value)}
              className="input-base w-full text-sm"
            />
          </div>

          {/* Letra */}
          <div>
            <SectionLabel icon={FileText}>Letra da música</SectionLabel>
            <textarea
              rows={5}
              placeholder="Cole a letra aqui..."
              value={lyrics}
              onChange={e => setLyrics(e.target.value)}
              className="input-base w-full text-sm resize-none select-text"
            />
          </div>
        </div>

        {/* Rodapé */}
        <div className="modal-footer">
          <button onClick={onClose} className="btn-ghost text-sm px-4 py-2">Cancelar</button>
          <button onClick={handleSave} className="btn-primary flex items-center gap-2 text-sm px-4 py-2">
            <Save size={13} /> Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

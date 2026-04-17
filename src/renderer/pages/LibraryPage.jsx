import React, { useState, useEffect } from 'react'
import { FolderOpen, RefreshCw, Search, Music2, Play, Settings2, Trash2, AlertTriangle, X, ListPlus, CheckSquare, Square, ListMusic, Upload, Download } from 'lucide-react'
import { usePlayer } from '../store/PlayerContext'
import MaestroModal from '../components/MaestroModal'

function formatDuration(secs) {
  if (!secs) return '--:--'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-800 border border-white/10 rounded-2xl p-6 w-80 flex flex-col gap-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-white/80">{message}</p>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn-ghost text-sm px-4 py-2">Cancelar</button>
          <button onClick={onConfirm} className="bg-red-600 hover:bg-red-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// Modal to add selected tracks to a playlist
function AddToPlaylistModal({ tracks, onClose }) {
  const [playlists, setPlaylists] = useState([])
  const [adding, setAdding] = useState(null)
  const [done, setDone] = useState(null)

  useEffect(() => {
    if (!window.electron) return
    window.electron.playlists.getAll().then(list => setPlaylists(list || []))
  }, [])

  async function handleAdd(playlistId) {
    if (!window.electron) return
    setAdding(playlistId)
    for (const t of tracks) {
      await window.electron.playlists.addTrack(playlistId, t.id)
    }
    setAdding(null)
    setDone(playlistId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-800 border border-white/10 rounded-2xl w-80 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-sm font-semibold text-white">Adicionar {tracks.length} faixa{tracks.length !== 1 ? 's' : ''} à playlist</h2>
          <button onClick={onClose} className="btn-ghost p-1 text-white/40"><X size={16} /></button>
        </div>
        <div className="flex flex-col gap-1 px-4 pb-5 max-h-72 overflow-y-auto">
          {playlists.length === 0 && <p className="text-xs text-white/30 text-center py-4">Nenhuma playlist criada ainda.</p>}
          {playlists.map(pl => (
            <div key={pl.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/5">
              <div className="w-8 h-8 rounded overflow-hidden bg-surface-600 shrink-0">
                {pl.cover_url
                  ? <img src={pl.cover_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">♫</div>
                }
              </div>
              <span className="flex-1 text-sm text-white truncate">{pl.name}</span>
              <button
                onClick={() => handleAdd(pl.id)}
                disabled={!!adding || done === pl.id}
                className={`text-xs px-3 py-1 rounded-lg transition-all ${
                  done === pl.id
                    ? 'bg-green-600/30 text-green-400'
                    : 'btn-primary disabled:opacity-40'
                }`}
              >
                {done === pl.id ? '✓ Adicionado' : adding === pl.id ? '...' : 'Adicionar'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LibraryPage() {
  const [tracks,      setTracks]      = useState([])
  const [query,       setQuery]       = useState('')
  const [scanning,    setScanning]    = useState(false)
  const [selected,    setSelected]    = useState(null)       // Maestro modal
  const [confirm,     setConfirm]     = useState(null)
  const [checkedIds,  setCheckedIds]  = useState(new Set())  // multi-select
  const [showBulkPl,  setShowBulkPl]  = useState(false)      // add-to-playlist modal
  const [exporting,   setExporting]   = useState(false)
  const [importing,   setImporting]   = useState(false)
  const [libToast,    setLibToast]    = useState(null)

  const { playTrack, playNext, currentTrack, isPlaying } = usePlayer()
  const isElectron = !!window.electron

  useEffect(() => { loadTracks() }, [])

  async function loadTracks() {
    if (!isElectron) return
    const data = await window.electron.library.getTracks()
    setTracks(data || [])
    setCheckedIds(new Set())
  }

  async function handleScan() {
    if (!isElectron) return
    const folder = await window.electron.library.chooseFolder()
    if (!folder) return
    setScanning(true)
    const result = await window.electron.library.scan(folder)
    setScanning(false)
    if (result.error) { alert(result.error); return }
    await loadTracks()
  }

  async function handleRemoveTrack(id) {
    if (!isElectron) return
    await window.electron.library.removeTrack(id)
    setTracks(prev => prev.filter(t => t.id !== id))
    setCheckedIds(prev => { const s = new Set(prev); s.delete(id); return s })
    setConfirm(null)
  }

  async function handleClearAll() {
    if (!isElectron) return
    await window.electron.library.clearAll()
    setTracks([])
    setCheckedIds(new Set())
    setConfirm(null)
  }

  function showToast(msg, ok = true) {
    setLibToast({ msg, ok })
    setTimeout(() => setLibToast(null), 3000)
  }

  async function handleExportLibrary() {
    if (!isElectron) return
    setExporting(true)
    const res = await window.electron.library.exportAll()
    setExporting(false)
    if (res?.ok) showToast(`Biblioteca exportada — ${res.trackCount} faixas`)
    else if (!res?.canceled) showToast(res?.error || 'Erro ao exportar', false)
  }

  async function handleImportLibrary() {
    if (!isElectron) return
    setImporting(true)
    const res = await window.electron.library.importAll()
    setImporting(false)
    if (res?.ok) {
      showToast(`Importadas: ${res.added} novas, ${res.merged} atualizadas`)
      loadTracks()
    } else if (!res?.canceled) {
      showToast(res?.error || 'Erro ao importar', false)
    }
  }

  const filtered = tracks.filter(t => {
    if (!query) return true
    const q = query.toLowerCase()
    return t.title?.toLowerCase().includes(q) || t.artist?.toLowerCase().includes(q) || t.album?.toLowerCase().includes(q)
  })

  function playFrom(track) { playTrack(track, filtered) }

  function toggleCheck(id, e) {
    e.stopPropagation()
    setCheckedIds(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function toggleAll() {
    if (checkedIds.size === filtered.length) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(filtered.map(t => t.id)))
    }
  }

  const checkedTracks = filtered.filter(t => checkedIds.has(t.id))
  const allChecked = filtered.length > 0 && checkedIds.size === filtered.length
  const someChecked = checkedIds.size > 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white">Biblioteca</h1>
          <p className="text-xs text-white/40">{tracks.length} faixas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input type="text" placeholder="Buscar músicas..." value={query}
              onChange={e => setQuery(e.target.value)} className="input-base pl-8 w-64" />
          </div>
          <button onClick={loadTracks} className="btn-ghost p-2" title="Atualizar"><RefreshCw size={16} /></button>
          <button onClick={handleImportLibrary} disabled={importing} className="btn-ghost p-2 text-white/40 hover:text-brand-400 transition-colors" title="Importar biblioteca (.nianlibrary)">
            <Upload size={16} />
          </button>
          {tracks.length > 0 && (
            <>
              <button onClick={handleExportLibrary} disabled={exporting} className="btn-ghost p-2 text-white/40 hover:text-brand-400 transition-colors" title="Exportar biblioteca">
                <Download size={16} />
              </button>
              <button onClick={() => setConfirm({ type: 'all' })}
                className="btn-ghost p-2 text-white/30 hover:text-red-400 transition-colors" title="Limpar biblioteca">
                <Trash2 size={16} />
              </button>
            </>
          )}
          <button onClick={handleScan} disabled={scanning} className="btn-primary flex items-center gap-2">
            {scanning ? <><RefreshCw size={14} className="animate-spin" /> Escaneando...</> : <><FolderOpen size={14} /> Escanear Pasta</>}
          </button>
        </div>
      </div>

      {/* Toast */}
      {libToast && (
        <div className={`fixed bottom-24 right-6 z-50 px-4 py-2.5 rounded-xl text-sm shadow-xl ${libToast.ok ? 'bg-green-600/90 text-white' : 'bg-red-600/90 text-white'}`}>
          {libToast.msg}
        </div>
      )}

      {/* Bulk action bar */}
      {someChecked && (
        <div className="flex items-center gap-3 px-6 py-2.5 bg-brand-600/10 border-b border-brand-500/20 shrink-0">
          <span className="text-xs text-brand-300 font-medium">{checkedIds.size} selecionada{checkedIds.size !== 1 ? 's' : ''}</span>
          <button
            onClick={() => setShowBulkPl(true)}
            className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 text-brand-300 hover:text-white"
          >
            <ListMusic size={13} /> Adicionar à playlist
          </button>
          <button
            onClick={() => setCheckedIds(new Set())}
            className="btn-ghost text-xs px-3 py-1.5 text-white/40"
          >
            Desmarcar
          </button>
        </div>
      )}

      {/* Track list */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white/20">
          <Music2 size={48} strokeWidth={1} />
          <p className="text-sm">
            {tracks.length === 0 ? 'Nenhuma música. Clique em "Escanear Pasta" para começar.' : 'Nenhum resultado para a busca.'}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Header row */}
          <div className="grid grid-cols-[2rem_1.5rem_3rem_1fr_1fr_1fr_5rem_2.5rem_2.5rem_2.5rem_2.5rem] gap-3 px-4 py-2 text-xs text-white/30 font-medium uppercase tracking-wider border-b border-white/5 sticky top-0 bg-surface-900">
            <span>#</span>
            <button onClick={toggleAll} className="flex items-center justify-center text-white/30 hover:text-white/60">
              {allChecked ? <CheckSquare size={13} className="text-brand-400" /> : <Square size={13} />}
            </button>
            <span />
            <span>Título</span>
            <span>Artista</span>
            <span>Álbum</span>
            <span className="text-right">Duração</span>
            <span /><span /><span /><span />
          </div>
          {filtered.map((track, idx) => {
            const active = currentTrack?.id === track.id
            const checked = checkedIds.has(track.id)
            return (
              <div
                key={track.id}
                onDoubleClick={() => playFrom(track)}
                className={`grid grid-cols-[2rem_1.5rem_3rem_1fr_1fr_1fr_5rem_2.5rem_2.5rem_2.5rem_2.5rem] gap-3 items-center px-4 py-2.5 group cursor-pointer transition-colors
                  ${active ? 'bg-brand-600/10 text-brand-300' : checked ? 'bg-white/5' : 'hover:bg-white/5 text-white/80'}`}
              >
                <span className="text-xs text-white/30 group-hover:hidden">{idx + 1}</span>
                <button
                  onClick={() => playFrom(track)}
                  className="hidden group-hover:flex items-center justify-center w-5 text-white"
                >
                  {active && isPlaying ? <span className="text-brand-400">▮▮</span> : <Play size={13} fill="currentColor" />}
                </button>

                {/* Checkbox */}
                <button onClick={e => toggleCheck(track.id, e)} className="flex items-center justify-center text-white/30 hover:text-white/60">
                  {checked ? <CheckSquare size={13} className="text-brand-400" /> : <Square size={13} />}
                </button>

                <div className="w-9 h-9 rounded overflow-hidden bg-surface-600 shrink-0">
                  {track.cover_path
                    ? <img src={/^https?:\/\//.test(track.cover_path) ? track.cover_path : `file://${track.cover_path}`} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-white/20 text-sm">♪</div>
                  }
                </div>

                <span className={`text-sm font-medium truncate ${active ? 'text-brand-300' : 'text-white'}`}>{track.title}</span>
                <span className="text-sm text-white/50 truncate">{track.artist}</span>
                <span className="text-sm text-white/40 truncate">{track.album}</span>
                <span className="text-xs text-white/30 text-right">{formatDuration(track.duration)}</span>

                <button onClick={e => { e.stopPropagation(); playNext(track) }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-white/30 hover:text-brand-400 transition-all"
                  title="Tocar a seguir"><ListPlus size={14} /></button>

                <button onClick={e => { e.stopPropagation(); setSelected(track) }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-all"
                  title="Painel do Maestro"><Settings2 size={14} /></button>

                <button onClick={e => { e.stopPropagation(); setConfirm({ type: 'track', id: track.id, title: track.title }) }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-white/30 hover:text-red-400 transition-all"
                  title="Remover da biblioteca"><Trash2 size={14} /></button>
              </div>
            )
          })}
        </div>
      )}

      {/* Maestro Modal */}
      {selected && (
        <MaestroModal track={selected} onClose={() => setSelected(null)}
          onSave={async (updated) => {
            if (isElectron) await window.electron.library.updateTrack(updated)
            setTracks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
            setSelected(null)
          }}
        />
      )}

      {/* Bulk add to playlist */}
      {showBulkPl && (
        <AddToPlaylistModal tracks={checkedTracks} onClose={() => setShowBulkPl(false)} />
      )}

      {confirm?.type === 'track' && (
        <ConfirmModal
          message={`Remover "${confirm.title}" da biblioteca? O arquivo não será deletado do disco.`}
          onConfirm={() => handleRemoveTrack(confirm.id)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.type === 'all' && (
        <ConfirmModal
          message="Limpar toda a biblioteca? As faixas serão removidas das playlists também. Os arquivos não serão deletados do disco."
          onConfirm={handleClearAll}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import {
  FolderOpen, RefreshCw, Search, Music2, Play, Settings2, Trash2,
  AlertTriangle, X, ListPlus, CheckSquare, Square, ListMusic,
  Upload, Download, Pause,
} from 'lucide-react'
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
    <div className="modal-overlay">
      <div className="modal-box w-80 shadow-2xl">
        <div className="px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={17} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-white/80 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onCancel} className="btn-ghost text-sm px-4 py-2">Cancelar</button>
          <button onClick={onConfirm} className="btn-destructive text-sm px-4 py-2">Confirmar</button>
        </div>
      </div>
    </div>
  )
}

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
    <div className="modal-overlay">
      <div className="modal-box w-80">
        <div className="modal-header">
          <h2 className="text-sm font-bold text-white">
            Adicionar {tracks.length} faixa{tracks.length !== 1 ? 's' : ''} à playlist
          </h2>
          <button onClick={onClose} className="btn-ghost p-1 text-white/35"><X size={15} /></button>
        </div>
        <div className="flex flex-col gap-1 px-4 py-3 max-h-72 overflow-y-auto">
          {playlists.length === 0 && (
            <p className="text-xs text-white/30 text-center py-6">Nenhuma playlist criada ainda.</p>
          )}
          {playlists.map(pl => (
            <div key={pl.id} className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-white/4">
              <div className="w-9 h-9 rounded-lg overflow-hidden bg-surface-600 shrink-0">
                {pl.cover_url
                  ? <img src={pl.cover_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-white/20"><ListMusic size={14} /></div>
                }
              </div>
              <span className="flex-1 text-sm text-white/85 truncate">{pl.name}</span>
              <button
                onClick={() => handleAdd(pl.id)}
                disabled={!!adding || done === pl.id}
                className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all ${
                  done === pl.id
                    ? 'bg-green-600/20 text-green-400 border border-green-500/20'
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

function TrackCover({ track }) {
  if (!track.cover_path) {
    return (
      <div className="w-9 h-9 rounded-lg bg-surface-600 flex items-center justify-center text-white/20 shrink-0">
        <Music2 size={13} />
      </div>
    )
  }
  const src = /^https?:\/\//.test(track.cover_path)
    ? track.cover_path
    : `file://${track.cover_path}`
  return <img src={src} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
}

export default function LibraryPage() {
  const [tracks,     setTracks]     = useState([])
  const [query,      setQuery]      = useState('')
  const [scanning,   setScanning]   = useState(false)
  const [selected,   setSelected]   = useState(null)
  const [confirm,    setConfirm]    = useState(null)
  const [checkedIds, setCheckedIds] = useState(new Set())
  const [showBulkPl, setShowBulkPl] = useState(false)
  const [exporting,  setExporting]  = useState(false)
  const [importing,  setImporting]  = useState(false)
  const [libToast,   setLibToast]   = useState(null)

  const { playTrack, playNext, currentTrack, isPlaying, updateQueuedTrack } = usePlayer()
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
    return t.title?.toLowerCase().includes(q)
        || t.artist?.toLowerCase().includes(q)
        || t.album?.toLowerCase().includes(q)
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
    if (checkedIds.size === filtered.length) setCheckedIds(new Set())
    else setCheckedIds(new Set(filtered.map(t => t.id)))
  }

  const checkedTracks = filtered.filter(t => checkedIds.has(t.id))
  const allChecked    = filtered.length > 0 && checkedIds.size === filtered.length
  const someChecked   = checkedIds.size > 0

  return (
    <div className="flex flex-col h-full overflow-hidden p-2.5 gap-2.5">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-5 py-3.5 rounded-2xl wallpaper-panel shrink-0">
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">Biblioteca</h1>
          <p className="text-xs text-white/35 mt-0.5 tabular-nums">
            {tracks.length} {tracks.length === 1 ? 'faixa' : 'faixas'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Busca */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar músicas..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="input-base pl-8 w-56 text-sm h-9"
            />
          </div>

          <button onClick={loadTracks} className="btn-ghost p-2" title="Atualizar">
            <RefreshCw size={15} />
          </button>
          <button
            onClick={handleImportLibrary}
            disabled={importing}
            className="btn-ghost p-2 text-white/35 hover:text-brand-400"
            title="Importar biblioteca (.nianlibrary)"
          >
            <Upload size={15} />
          </button>
          {tracks.length > 0 && (
            <>
              <button
                onClick={handleExportLibrary}
                disabled={exporting}
                className="btn-ghost p-2 text-white/35 hover:text-brand-400"
                title="Exportar biblioteca"
              >
                <Download size={15} />
              </button>
              <button
                onClick={() => setConfirm({ type: 'all' })}
                className="btn-ghost p-2 text-white/25 hover:text-red-400"
                title="Limpar biblioteca"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
          <button onClick={handleScan} disabled={scanning} className="btn-primary flex items-center gap-2 h-9 text-sm">
            {scanning
              ? <><RefreshCw size={13} className="animate-spin" /> Escaneando...</>
              : <><FolderOpen size={13} /> Escanear Pasta</>
            }
          </button>
        </div>
      </div>

      {/* Toast */}
      {libToast && (
        <div className={`fixed bottom-24 right-6 z-50 px-4 py-2.5 rounded-xl text-sm
                         font-medium shadow-xl slide-up
                         ${libToast.ok ? 'bg-green-600/90 text-white' : 'bg-red-600/90 text-white'}`}>
          {libToast.msg}
        </div>
      )}

      {/* Barra de seleção múltipla */}
      {someChecked && (
        <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl
                        bg-brand-600/10 border border-brand-500/18 shrink-0 slide-up">
          <span className="text-xs text-brand-400 font-bold">
            {checkedIds.size} selecionada{checkedIds.size !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setShowBulkPl(true)}
            className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 text-brand-400 hover:text-white"
          >
            <ListMusic size={13} /> Adicionar à playlist
          </button>
          <button
            onClick={() => setCheckedIds(new Set())}
            className="btn-ghost text-xs px-3 py-1.5 text-white/35"
          >
            Desmarcar tudo
          </button>
        </div>
      )}

      {/* Lista de faixas */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 wallpaper-panel rounded-2xl">
          <Music2 size={52} strokeWidth={0.8} className="text-white/10" />
          <div className="text-center">
            <p className="text-sm font-semibold text-white/25">
              {tracks.length === 0 ? 'Biblioteca vazia' : 'Nenhum resultado'}
            </p>
            <p className="text-xs text-white/18 mt-1">
              {tracks.length === 0
                ? 'Clique em "Escanear Pasta" para adicionar músicas'
                : 'Tente outro termo de busca'}
            </p>
          </div>
          {tracks.length === 0 && (
            <button onClick={handleScan} className="btn-primary flex items-center gap-2 text-sm mt-2">
              <FolderOpen size={14} /> Escanear Pasta
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col rounded-2xl wallpaper-panel">
          {/* Cabeçalho da tabela */}
          <div className="grid items-center px-4 py-2 text-[10px] text-white/35 font-bold uppercase
                          tracking-widest border-b border-white/6 sticky top-0 bg-surface-900/90
                          backdrop-blur-md shrink-0"
               style={{ gridTemplateColumns: '1.5rem 1.5rem 2.5rem 1fr 1fr 1fr 4.5rem 2rem 2rem 2rem' }}>
            <button onClick={toggleAll} className="flex items-center justify-center text-white/30 hover:text-white/65">
              {allChecked
                ? <CheckSquare size={12} className="text-brand-500" />
                : <Square size={12} />
              }
            </button>
            <span className="text-center">#</span>
            <span />
            <span>Título</span>
            <span>Artista</span>
            <span>Álbum</span>
            <span className="text-right">Duração</span>
            <span /><span /><span />
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.map((track, idx) => {
              const active  = currentTrack?.id === track.id
              const checked = checkedIds.has(track.id)
              return (
                <div
                  key={track.id}
                  onDoubleClick={() => playFrom(track)}
                  className={`grid items-center px-4 py-2.5 group cursor-pointer transition-colors duration-100
                    ${active   ? 'bg-brand-600/15 text-brand-300'
                    : checked  ? 'bg-white/6'
                    :            'hover:bg-white/4 text-white/80'}`}
                  style={{ gridTemplateColumns: '1.5rem 1.5rem 2.5rem 1fr 1fr 1fr 4.5rem 2rem 2rem 2rem' }}
                >
                  {/* Checkbox */}
                  <button
                    onClick={e => toggleCheck(track.id, e)}
                    className="flex items-center justify-center text-white/25 hover:text-white/60"
                  >
                    {checked
                      ? <CheckSquare size={12} className="text-brand-500" />
                      : <Square size={12} />
                    }
                  </button>

                  {/* Número / Play */}
                  <div className="flex items-center justify-center">
                    <span className="text-[11px] text-white/25 group-hover:hidden tabular-nums">{idx + 1}</span>
                    <button
                      onClick={() => playFrom(track)}
                      className="hidden group-hover:flex items-center justify-center w-4 text-white/80"
                    >
                      {active && isPlaying
                        ? <Pause size={12} fill="currentColor" className="text-brand-400" />
                        : <Play  size={12} fill="currentColor" />
                      }
                    </button>
                  </div>

                  <TrackCover track={track} />

                  <span className={`text-sm font-semibold truncate leading-tight ${active ? 'text-brand-400' : 'text-white/90'}`}>
                    {track.title}
                  </span>
                  <span className="text-sm text-white/45 truncate">{track.artist}</span>
                  <span className="text-sm text-white/30 truncate">{track.album}</span>
                  <span className="text-[11px] text-white/30 text-right tabular-nums">{formatDuration(track.duration)}</span>

                  <button
                    onClick={e => { e.stopPropagation(); playNext(track) }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-white/8
                               text-white/30 hover:text-brand-400 transition-all"
                    title="Tocar a seguir"
                  >
                    <ListPlus size={13} />
                  </button>

                  <button
                    onClick={e => { e.stopPropagation(); setSelected(track) }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-white/8
                               text-white/40 hover:text-white transition-all"
                    title="Painel do Maestro"
                  >
                    <Settings2 size={13} />
                  </button>

                  <button
                    onClick={e => { e.stopPropagation(); setConfirm({ type: 'track', id: track.id, title: track.title }) }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-white/8
                               text-white/25 hover:text-red-400 transition-all"
                    title="Remover da biblioteca"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {selected && (
        <MaestroModal
          track={selected}
          onClose={() => setSelected(null)}
          onSave={async updated => {
            if (isElectron) await window.electron.library.updateTrack(updated)
            setTracks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
            updateQueuedTrack(updated)
            setSelected(null)
          }}
        />
      )}

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

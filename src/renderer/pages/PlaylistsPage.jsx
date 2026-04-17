import React, { useState, useEffect } from 'react'
import { Plus, ListMusic, Trash2, Pencil, X, Check, Search, ExternalLink, Upload, Download } from 'lucide-react'

function CreateModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [coverUrl, setCoverUrl] = useState('')

  async function handleChooseCover() {
    if (!window.electron) return
    const p = await window.electron.playlists.chooseCover()
    if (p) setCoverUrl(`file://${p}`)
  }

  async function handleSearchCover() {
    if (!window.electron || !name.trim()) return
    await window.electron.playlists.searchImageBrowser(name)
  }

  async function handleCreate() {
    if (!name.trim()) return
    await onCreate({ name: name.trim(), cover_url: coverUrl })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-800 border border-white/10 rounded-2xl p-6 w-96 flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Nova Playlist</h2>
          <button onClick={onClose} className="btn-ghost p-1 text-white/40"><X size={16} /></button>
        </div>

        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Nome</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            placeholder="Nome da playlist..."
            className="input-base w-full text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Capa (opcional)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={coverUrl}
              onChange={e => setCoverUrl(e.target.value)}
              placeholder="URL ou caminho do arquivo..."
              className="input-base flex-1 text-xs"
            />
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={handleChooseCover} className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5">
              <Search size={11} /> Arquivo local
            </button>
            <button onClick={handleSearchCover} disabled={!name.trim()} className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-40">
              <ExternalLink size={11} /> Buscar no Google
            </button>
          </div>
          {coverUrl && (
            <div className="mt-2 w-16 h-16 rounded-lg overflow-hidden border border-white/10">
              <img src={coverUrl.startsWith('file://') ? coverUrl : coverUrl} alt="preview" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button onClick={handleCreate} disabled={!name.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-40">
            Criar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PlaylistsPage({ onOpenPlaylist }) {
  const [playlists,     setPlaylists]     = useState([])
  const [showCreate,    setShowCreate]    = useState(false)
  const [editingId,     setEditingId]     = useState(null)
  const [editName,      setEditName]      = useState('')
  const [exportingId,   setExportingId]   = useState(null)
  const [importing,     setImporting]     = useState(false)
  const [toast,         setToast]         = useState(null)

  const isElectron = !!window.electron

  useEffect(() => {
    loadPlaylists()
  }, [])

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function loadPlaylists() {
    if (!isElectron) return
    const list = await window.electron.playlists.getAll()
    setPlaylists(list || [])
  }

  async function handleCreate(opts) {
    if (!isElectron) return
    await window.electron.playlists.create(opts)
    loadPlaylists()
  }

  async function handleDelete(id, e) {
    e.stopPropagation()
    if (!isElectron) return
    await window.electron.playlists.delete(id)
    setPlaylists(prev => prev.filter(p => p.id !== id))
  }

  function startEdit(p, e) {
    e.stopPropagation()
    setEditingId(p.id)
    setEditName(p.name)
  }

  async function submitEdit(p) {
    if (!editName.trim() || !isElectron) return
    await window.electron.playlists.update({ id: p.id, name: editName.trim(), cover_url: p.cover_url })
    setEditingId(null)
    loadPlaylists()
  }

  async function handleExport(p, e) {
    e.stopPropagation()
    if (!isElectron) return
    setExportingId(p.id)
    const res = await window.electron.playlists.export(p.id)
    setExportingId(null)
    if (res?.ok) showToast(`"${p.name}" exportada com ${res.trackCount} faixas`)
    else if (!res?.canceled) showToast(res?.error || 'Erro ao exportar', false)
  }

  async function handleImport() {
    if (!isElectron) return
    setImporting(true)
    const res = await window.electron.playlists.import()
    setImporting(false)
    if (res?.ok) {
      showToast(`Importada "${res.playlist.name}" — ${res.trackCount} faixas (${res.created} novas)`)
      loadPlaylists()
    } else if (!res?.canceled) {
      showToast(res?.error || 'Erro ao importar', false)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Playlists</h1>
            <p className="text-xs text-white/40">{playlists.length} playlist{playlists.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleImport}
              disabled={importing}
              className="btn-ghost flex items-center gap-1.5 text-sm"
              title="Importar playlist (.nianplaylist)"
            >
              <Upload size={14} /> {importing ? 'Importando...' : 'Importar'}
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Plus size={14} /> Nova Playlist
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`fixed bottom-24 right-6 z-50 px-4 py-2.5 rounded-xl text-sm shadow-xl transition-all ${toast.ok ? 'bg-green-600/90 text-white' : 'bg-red-600/90 text-white'}`}>
            {toast.msg}
          </div>
        )}

        {/* Grid */}
        {playlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-white/20 gap-3">
            <ListMusic size={40} strokeWidth={1.2} />
            <p className="text-sm">Nenhuma playlist ainda</p>
            <button onClick={() => setShowCreate(true)} className="btn-ghost text-xs px-3 py-1.5 mt-1">
              Criar primeira playlist
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {playlists.map(p => (
              <div
                key={p.id}
                onClick={() => onOpenPlaylist(p)}
                className="card p-4 flex flex-col gap-3 cursor-pointer hover:bg-white/5 transition-colors group"
              >
                {/* Cover */}
                <div className="aspect-square rounded-lg overflow-hidden bg-surface-700 shrink-0">
                  {p.cover_url ? (
                    <img
                      src={p.cover_url.startsWith('file://') ? p.cover_url : p.cover_url}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/10">
                      <ListMusic size={32} strokeWidth={1} />
                    </div>
                  )}
                </div>

                {/* Name / edit */}
                {editingId === p.id ? (
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') submitEdit(p); if (e.key === 'Escape') setEditingId(null) }}
                      className="input-base text-xs flex-1 py-1"
                    />
                    <button onClick={() => submitEdit(p)} className="btn-ghost p-1 text-green-400"><Check size={13} /></button>
                    <button onClick={() => setEditingId(null)} className="btn-ghost p-1 text-white/30"><X size={13} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-medium text-white truncate flex-1">{p.name}</p>
                    <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity shrink-0">
                      <button onClick={e => startEdit(p, e)} className="btn-ghost p-1 text-white/30 hover:text-white/70" title="Renomear">
                        <Pencil size={11} />
                      </button>
                      <button onClick={e => handleExport(p, e)} disabled={exportingId === p.id} className="btn-ghost p-1 text-white/30 hover:text-brand-400 disabled:opacity-40" title="Exportar playlist">
                        <Download size={11} />
                      </button>
                      <button onClick={e => handleDelete(p.id, e)} className="btn-ghost p-1 text-white/30 hover:text-red-400" title="Excluir">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                )}
                <p className="text-xs text-white/30 -mt-2">{p.trackCount ?? 0} faixa{(p.trackCount ?? 0) !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
    </div>
  )
}

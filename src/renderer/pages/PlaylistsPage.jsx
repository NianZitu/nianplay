import React, { useState, useEffect } from 'react'
import { Plus, ListMusic, Trash2, Pencil, X, Check, Search, ExternalLink,
         Upload, Download, Copy, GitMerge, Loader2 } from 'lucide-react'

// ─── Modal: nova playlist ─────────────────────────────────────────────────────
function CreateModal({ onClose, onCreate }) {
  const [name,     setName]     = useState('')
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
              <img src={coverUrl} alt="preview" className="w-full h-full object-cover" />
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

// ─── Modal: unir playlists ────────────────────────────────────────────────────
function MergeModal({ playlists, onClose, onMerge }) {
  const [selected, setSelected] = useState(new Set())
  const [name,     setName]     = useState('')
  const [merging,  setMerging]  = useState(false)

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleMerge() {
    if (selected.size < 2 || !name.trim()) return
    setMerging(true)
    await onMerge({ playlistIds: [...selected], name: name.trim() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-800 border border-white/10 rounded-2xl p-6 w-[440px] max-h-[75vh] flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <GitMerge size={15} className="text-brand-400" /> Unir Playlists
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              Selecione 2 ou mais playlists. Músicas duplicadas entram só uma vez.
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1 text-white/40 shrink-0"><X size={16} /></button>
        </div>

        {/* Nome da nova playlist */}
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Nome da nova playlist</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleMerge()}
            placeholder="Nome..."
            className="input-base w-full text-sm"
          />
        </div>

        {/* Lista de seleção */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 -mx-1">
          {playlists.map(p => (
            <label
              key={p.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
                className="w-4 h-4 accent-brand-500 shrink-0"
              />
              <div className="w-9 h-9 rounded-lg overflow-hidden bg-surface-600 shrink-0">
                {p.cover_url
                  ? <img src={p.cover_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-white/20"><ListMusic size={14} /></div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{p.name}</p>
                <p className="text-xs text-white/30">{p.trackCount ?? 0} faixa{(p.trackCount ?? 0) !== 1 ? 's' : ''}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Contador de selecionadas */}
        <p className="text-xs text-white/30 -mt-1">
          {selected.size === 0 ? 'Nenhuma selecionada' : `${selected.size} playlist${selected.size !== 1 ? 's' : ''} selecionada${selected.size !== 1 ? 's' : ''}`}
        </p>

        <div className="flex gap-2 justify-end pt-1 border-t border-white/8">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={handleMerge}
            disabled={selected.size < 2 || !name.trim() || merging}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-40 flex items-center gap-2"
          >
            {merging
              ? <><Loader2 size={13} className="animate-spin" /> Unindo...</>
              : <><GitMerge size={13} /> Unir {selected.size >= 2 ? `(${selected.size})` : ''}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function PlaylistsPage({ onOpenPlaylist }) {
  const [playlists,     setPlaylists]     = useState([])
  const [showCreate,    setShowCreate]    = useState(false)
  const [showMerge,     setShowMerge]     = useState(false)
  const [editingId,     setEditingId]     = useState(null)
  const [editName,      setEditName]      = useState('')
  const [exportingId,   setExportingId]   = useState(null)
  const [duplicatingId, setDuplicatingId] = useState(null)
  const [importing,     setImporting]     = useState(false)
  const [toast,         setToast]         = useState(null)

  const isElectron = !!window.electron

  useEffect(() => { loadPlaylists() }, [])

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

  async function handleDuplicate(p, e) {
    e.stopPropagation()
    if (!isElectron) return
    setDuplicatingId(p.id)
    const res = await window.electron.playlists.duplicate(p.id)
    setDuplicatingId(null)
    if (res?.ok) {
      showToast(`"${p.name}" duplicada com sucesso`)
      loadPlaylists()
    } else {
      showToast(res?.error || 'Erro ao duplicar', false)
    }
  }

  async function handleMerge(opts) {
    if (!isElectron) return
    const res = await window.electron.playlists.merge(opts)
    if (res?.ok) {
      showToast(`Playlists unidas em "${opts.name}" — ${res.playlist.trackCount} faixas`)
      loadPlaylists()
    } else {
      showToast(res?.error || 'Erro ao unir playlists', false)
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
              onClick={() => setShowMerge(true)}
              disabled={playlists.length < 2}
              className="btn-ghost flex items-center gap-1.5 text-sm disabled:opacity-40"
              title="Unir playlists"
            >
              <GitMerge size={14} /> Unir
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
                    <img src={p.cover_url} alt={p.name} className="w-full h-full object-cover" />
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
                      <button
                        onClick={e => startEdit(p, e)}
                        className="btn-ghost p-1 text-white/30 hover:text-white/70"
                        title="Renomear"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={e => handleDuplicate(p, e)}
                        disabled={duplicatingId === p.id}
                        className="btn-ghost p-1 text-white/30 hover:text-brand-400 disabled:opacity-40"
                        title="Duplicar playlist"
                      >
                        {duplicatingId === p.id
                          ? <Loader2 size={11} className="animate-spin" />
                          : <Copy size={11} />
                        }
                      </button>
                      <button
                        onClick={e => handleExport(p, e)}
                        disabled={exportingId === p.id}
                        className="btn-ghost p-1 text-white/30 hover:text-brand-400 disabled:opacity-40"
                        title="Exportar playlist"
                      >
                        <Download size={11} />
                      </button>
                      <button
                        onClick={e => handleDelete(p.id, e)}
                        className="btn-ghost p-1 text-white/30 hover:text-red-400"
                        title="Excluir"
                      >
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

      {showMerge && (
        <MergeModal
          playlists={playlists}
          onClose={() => setShowMerge(false)}
          onMerge={handleMerge}
        />
      )}
    </div>
  )
}

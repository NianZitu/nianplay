import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, ListMusic, Trash2, Pencil, X, Check, Search, ExternalLink,
  Upload, Download, Copy, GitMerge, Loader2, Play, MoreHorizontal,
} from 'lucide-react'

/* ── Modais ─────────────────────────────────────────────────────── */

function CreateModal({ onClose, onCreate }) {
  const [name,     setName]     = useState('')
  const [coverUrl, setCoverUrl] = useState('')

  async function handleChooseCover() {
    if (!window.electron) return
    const p = await window.electron.playlists.chooseCover()
    if (p) setCoverUrl(`file://${p}`)
  }

  async function handleCreate() {
    if (!name.trim()) return
    await onCreate({ name: name.trim(), cover_url: coverUrl })
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box w-96">
        <div className="modal-header">
          <h2 className="text-base font-bold text-white">Nova Playlist</h2>
          <button onClick={onClose} className="btn-ghost p-1 text-white/35"><X size={15} /></button>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div>
            <label className="text-xs text-white/40 mb-1.5 block font-medium">Nome</label>
            <input
              autoFocus type="text" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              placeholder="Nome da playlist..."
              className="input-base w-full"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1.5 block font-medium">Capa (opcional)</label>
            <input
              type="text" value={coverUrl}
              onChange={e => setCoverUrl(e.target.value)}
              placeholder="URL ou caminho do arquivo..."
              className="input-base w-full text-xs mb-2"
            />
            <div className="flex gap-2">
              <button onClick={handleChooseCover} className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5">
                <Search size={11} /> Arquivo local
              </button>
              <button
                onClick={() => window.electron?.playlists.searchImageBrowser(name)}
                disabled={!name.trim()}
                className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-40"
              >
                <ExternalLink size={11} /> Buscar no Google
              </button>
            </div>
            {coverUrl && (
              <div className="mt-3 w-16 h-16 rounded-xl overflow-hidden border border-white/10">
                <img src={coverUrl} alt="preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button onClick={handleCreate} disabled={!name.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-40">Criar</button>
        </div>
      </div>
    </div>
  )
}

function MergeModal({ playlists, onClose, onMerge }) {
  const [selected, setSelected] = useState(new Set())
  const [name,     setName]     = useState('')
  const [merging,  setMerging]  = useState(false)

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
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
    <div className="modal-overlay">
      <div className="modal-box w-[440px]" style={{ maxHeight: '75vh' }}>
        <div className="modal-header">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <GitMerge size={15} className="text-brand-400" /> Unir Playlists
            </h2>
            <p className="text-xs text-white/35 mt-0.5">Músicas duplicadas entram só uma vez.</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1 text-white/35 shrink-0"><X size={15} /></button>
        </div>
        <div className="flex flex-col gap-4 p-5 flex-1 overflow-hidden">
          <div>
            <label className="text-xs text-white/40 mb-1.5 block font-medium">Nome da nova playlist</label>
            <input
              autoFocus value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleMerge()}
              placeholder="Nome..."
              className="input-base w-full"
            />
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 -mx-1">
            {playlists.map(p => (
              <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/4 cursor-pointer select-none">
                <input
                  type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)}
                  className="w-4 h-4 shrink-0 accent-brand-600"
                />
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-surface-600 shrink-0">
                  {p.cover_url
                    ? <img src={p.cover_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-white/20"><ListMusic size={15} /></div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/90 truncate">{p.name}</p>
                  <p className="text-xs text-white/30">{p.trackCount ?? 0} faixas</p>
                </div>
              </label>
            ))}
          </div>
          <p className="text-xs text-white/30 -mt-1">
            {selected.size === 0 ? 'Nenhuma selecionada' : `${selected.size} playlist${selected.size !== 1 ? 's' : ''} selecionada${selected.size !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={handleMerge}
            disabled={selected.size < 2 || !name.trim() || merging}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-40 flex items-center gap-2"
          >
            {merging ? <><Loader2 size={13} className="animate-spin" /> Unindo...</> : <><GitMerge size={13} /> Unir {selected.size >= 2 ? `(${selected.size})` : ''}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Card de playlist ────────────────────────────────────────────── */

function PlaylistCard({ p, onOpen, onEdit, onDuplicate, onExport, onDelete, editingId, editName, setEditName, submitEdit, cancelEdit, duplicatingId, exportingId }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos,  setMenuPos]  = useState({ top: 0, right: 0 })
  const btnRef    = useRef(null)
  const isEditing = editingId === p.id

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function onDown() { setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  function openMenu(e) {
    e.stopPropagation()
    const rect = btnRef.current.getBoundingClientRect()
    setMenuPos({
      top:   rect.bottom + 4,
      right: window.innerWidth - rect.right,
    })
    setMenuOpen(v => !v)
  }

  return (
    <>
      {/* Fixed-position dropdown — rendered outside any overflow-hidden container */}
      {menuOpen && createPortal(
        <div
          className="fixed z-[9999] w-44 bg-surface-700 border border-white/10 rounded-xl shadow-2xl py-1 slide-up"
          style={{ top: menuPos.top, right: menuPos.right }}
          onMouseDown={e => e.stopPropagation()}
        >
          <button onClick={() => { setMenuOpen(false); onEdit(p) }}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors">
            <Pencil size={12} /> Renomear
          </button>
          <button onClick={() => { setMenuOpen(false); onDuplicate(p) }} disabled={duplicatingId === p.id}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40">
            {duplicatingId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />} Duplicar
          </button>
          <button onClick={() => { setMenuOpen(false); onExport(p) }} disabled={exportingId === p.id}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40">
            {exportingId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Exportar
          </button>
          <div className="h-px bg-white/6 my-1" />
          <button onClick={() => { setMenuOpen(false); onDelete(p.id) }}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors">
            <Trash2 size={12} /> Excluir
          </button>
        </div>,
        document.body
      )}

    <div
      onClick={() => !isEditing && onOpen(p)}
      className="group cursor-pointer flex flex-col gap-2.5 rounded-xl p-3 transition-all duration-200
                 hover:bg-white/[0.04]"
    >
      {/* Cover */}
      <div className="relative aspect-square rounded-xl overflow-hidden bg-surface-700 shadow-lg shadow-black/30">
        {p.cover_url ? (
          <img src={p.cover_url} alt={p.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface-700">
            <ListMusic size={40} strokeWidth={0.8} className="text-white/12" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        {/* Play button — bottom right */}
        <button
          onClick={e => { e.stopPropagation(); onOpen(p) }}
          className="absolute bottom-3 right-3 w-11 h-11 rounded-full bg-brand-600 shadow-xl shadow-black/40
                     flex items-center justify-center text-white
                     translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100
                     transition-all duration-200 hover:bg-brand-500 hover:scale-105 active:scale-95"
        >
          <Play size={18} fill="white" className="ml-0.5" />
        </button>

        {/* 3-dot button — top right, fora do overflow mas dentro do cover para o hover funcionar */}
        <button
          ref={btnRef}
          onClick={openMenu}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white/70
                     hover:text-white hover:bg-black/75 flex items-center justify-center transition-all
                     opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal size={13} />
        </button>
      </div>

      {/* Name / edit */}
      {isEditing ? (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <input
            autoFocus value={editName}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitEdit(p)
              if (e.key === 'Escape') cancelEdit()
            }}
            className="input-base text-xs flex-1 py-1.5"
          />
          <button onClick={() => submitEdit(p)} className="btn-ghost p-1.5 text-green-400"><Check size={12} /></button>
          <button onClick={cancelEdit} className="btn-ghost p-1.5 text-white/30"><X size={12} /></button>
        </div>
      ) : (
        <div className="px-0.5">
          <p className="text-sm font-semibold text-white/90 truncate leading-snug">{p.name}</p>
          <p className="text-xs text-white/35 mt-0.5">{p.trackCount ?? 0} faixas</p>
        </div>
      )}
    </div>
    </>
  )
}

/* ── Página principal ────────────────────────────────────────────── */

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

  async function handleDelete(id) {
    if (!isElectron) return
    await window.electron.playlists.delete(id)
    setPlaylists(prev => prev.filter(p => p.id !== id))
  }

  function startEdit(p) {
    setEditingId(p.id)
    setEditName(p.name)
  }

  async function submitEdit(p) {
    if (!editName.trim() || !isElectron) return
    await window.electron.playlists.update({ id: p.id, name: editName.trim(), cover_url: p.cover_url })
    setEditingId(null)
    loadPlaylists()
  }

  async function handleExport(p) {
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

  async function handleDuplicate(p) {
    if (!isElectron) return
    setDuplicatingId(p.id)
    const res = await window.electron.playlists.duplicate(p.id)
    setDuplicatingId(null)
    if (res?.ok) { showToast(`"${p.name}" duplicada`); loadPlaylists() }
    else showToast(res?.error || 'Erro ao duplicar', false)
  }

  async function handleMerge(opts) {
    if (!isElectron) return
    const res = await window.electron.playlists.merge(opts)
    if (res?.ok) { showToast(`Unidas em "${opts.name}" — ${res.playlist.trackCount} faixas`); loadPlaylists() }
    else showToast(res?.error || 'Erro ao unir', false)
  }

  const totalTracks = playlists.reduce((sum, p) => sum + (p.trackCount ?? 0), 0)

  return (
    <div className="h-full overflow-y-auto">

      {/* ── Cabeçalho ── */}
      <div className="sticky top-0 z-10 px-6 pt-6 pb-4 bg-surface-900/95 backdrop-blur-sm border-b border-white/[0.04]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Playlists</h1>
            <p className="text-xs text-white/30 mt-1">
              {playlists.length} coleção{playlists.length !== 1 ? 'ões' : ''} · {totalTracks.toLocaleString('pt-BR')} faixas no total
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleImport} disabled={importing}
              className="btn-ghost flex items-center gap-1.5 text-xs px-3 py-2"
            >
              <Upload size={13} /> {importing ? 'Importando...' : 'Importar'}
            </button>
            <button
              onClick={() => setShowMerge(true)} disabled={playlists.length < 2}
              className="btn-ghost flex items-center gap-1.5 text-xs px-3 py-2 disabled:opacity-35"
            >
              <GitMerge size={13} /> Unir
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
            >
              <Plus size={14} /> Nova Playlist
            </button>
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="px-4 py-5">
        {playlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center gap-4">
            <ListMusic size={56} strokeWidth={0.7} className="text-white/8" />
            <div>
              <p className="text-sm font-semibold text-white/25">Nenhuma playlist ainda</p>
              <p className="text-xs text-white/15 mt-1">Crie sua primeira coleção de músicas</p>
            </div>
            <button onClick={() => setShowCreate(true)} className="btn-primary text-sm mt-2 px-5 py-2.5">
              Criar primeira playlist
            </button>
          </div>
        ) : (
          <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))' }}>
            {playlists.map(p => (
              <PlaylistCard
                key={p.id}
                p={p}
                onOpen={onOpenPlaylist}
                onEdit={startEdit}
                onDuplicate={handleDuplicate}
                onExport={handleExport}
                onDelete={handleDelete}
                editingId={editingId}
                editName={editName}
                setEditName={setEditName}
                submitEdit={submitEdit}
                cancelEdit={() => setEditingId(null)}
                duplicatingId={duplicatingId}
                exportingId={exportingId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl text-sm font-medium
                         shadow-2xl slide-up ${toast.ok ? 'bg-green-700/95 text-white' : 'bg-red-700/95 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      {showMerge  && <MergeModal playlists={playlists} onClose={() => setShowMerge(false)} onMerge={handleMerge} />}
    </div>
  )
}

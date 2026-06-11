import React, { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { DownloadCloud, ListMusic, Loader2, RefreshCw, Search, Users, Plus } from 'lucide-react'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

function coverSrc(src) {
  if (!src) return ''
  if (/^https?:\/\//.test(src) || src.startsWith('file://')) return src
  return `file://${src}`
}

const FRAME_STYLE = {
  classic: { border: '#d97706', glow: '' },
  neon:    { border: '#22d3ee', glow: '0 0 8px rgba(34,211,238,0.5)' },
  sunset:  { border: '#fb7185', glow: '0 0 8px rgba(251,113,133,0.4)' },
  mint:    { border: '#34d399', glow: '0 0 8px rgba(52,211,153,0.4)' },
}

function CommunityCard({ p, onImport, importing, canImport }) {
  const ownerFrame = FRAME_STYLE[p.owner_frame] || FRAME_STYLE.classic
  const count = p.trackCount ?? p.tracks?.length ?? 0

  return (
    <div className="group flex flex-col cursor-default rounded-xl overflow-hidden
                    hover:bg-white/[0.03] transition-all duration-200">

      {/* Cover */}
      <div className="relative aspect-square overflow-hidden bg-surface-700 rounded-xl">
        {p.cover_url ? (
          <img
            src={coverSrc(p.cover_url)} alt={p.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ListMusic size={36} strokeWidth={0.8} className="text-white/12" />
          </div>
        )}

        {/* Track count badge */}
        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded-md px-1.5 py-0.5">
          <span className="text-[10px] text-white/70 font-medium tabular-nums">{count} faixas</span>
        </div>

        {/* Add button on hover */}
        <button
          onClick={() => canImport && onImport(p)}
          disabled={!canImport || importing === p.id}
          className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-brand-600 shadow-xl shadow-black/40
                     flex items-center justify-center text-white
                     translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100
                     transition-all duration-200 hover:bg-brand-500 hover:scale-105 active:scale-95
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {importing === p.id
            ? <Loader2 size={16} className="animate-spin" />
            : <Plus size={18} />
          }
        </button>
      </div>

      {/* Info */}
      <div className="px-1 pt-2.5 pb-3 flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-white/90 truncate leading-snug">{p.name}</p>

        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className="w-4 h-4 rounded-full shrink-0 overflow-hidden flex items-center justify-center bg-surface-600"
            style={{ border: `1.5px solid ${ownerFrame.border}` }}
          >
            {p.owner_avatar
              ? <img src={p.owner_avatar} alt="" className="w-full h-full object-cover" />
              : <Users size={7} className="text-white/30" />
            }
          </div>
          <p className="text-[11px] text-white/35 truncate">{p.owner_name || 'Ouvinte NianPlay'}</p>
        </div>
      </div>
    </div>
  )
}

export default function CommunityPage() {
  const { user } = useAuth() || {}
  const [playlists, setPlaylists] = useState([])
  const [loading,   setLoading]   = useState(false)
  const [queryText, setQueryText] = useState('')
  const [importing, setImporting] = useState(null)
  const [toast,     setToast]     = useState(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => { loadCommunity() }, [])

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function loadCommunity() {
    setLoading(true)
    setLoadError('')
    try {
      const q    = query(collection(db, 'communityPlaylists'), orderBy('updatedAt', 'desc'))
      const snap = await getDocs(q)
      setPlaylists(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      const msg = e.message || 'Erro ao carregar comunidade'
      setLoadError(msg)
      showToast(msg, false)
    } finally {
      setLoading(false)
    }
  }

  async function handleImport(playlist) {
    if (!window.electron) return
    setImporting(playlist.id)
    const res = await window.electron.playlists.importCommunity({
      name: playlist.name,
      cover_url: playlist.cover_url || '',
      groups_enabled: playlist.groups_enabled || false,
      groups: playlist.groups || [],
      tracks: playlist.tracks || [],
    })
    setImporting(null)
    if (res?.ok) showToast(`"${res.playlist.name}" adicionada à sua biblioteca`)
    else showToast(res?.error || 'Erro ao importar playlist', false)
  }

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase()
    if (!q) return playlists
    return playlists.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.owner_name || '').toLowerCase().includes(q)
    )
  }, [playlists, queryText])

  return (
    <div className="h-full overflow-y-auto">

      {/* ── Cabeçalho ── */}
      <div className="sticky top-0 z-10 px-6 pt-6 pb-4 bg-surface-900/95 backdrop-blur-sm border-b border-white/[0.04]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Comunidade</h1>
            <p className="text-xs text-white/30 mt-1">Playlists compartilhadas por ouvintes NianPlay</p>
          </div>
          <button
            onClick={loadCommunity} disabled={loading}
            className="btn-ghost p-2 text-white/40 disabled:opacity-40 shrink-0"
            title="Atualizar"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          </button>
        </div>

        {/* Busca */}
        <div className="relative mt-4">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
          <input
            value={queryText}
            onChange={e => setQueryText(e.target.value)}
            placeholder="Buscar playlist ou criador..."
            className="input-base pl-9 w-full max-w-sm text-sm"
          />
        </div>
      </div>

      <div className="px-4 py-5 flex flex-col gap-5">

        {/* Avisos */}
        {!user && (
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/6 px-4 py-3 text-xs text-amber-200/70 leading-relaxed">
            Entre em uma conta para adicionar playlists da comunidade à sua biblioteca.
          </div>
        )}
        {loadError && (
          <div className="rounded-xl border border-red-500/15 bg-red-500/6 px-4 py-3 text-xs text-red-200/70">
            Comunidade indisponível — verifique sua conexão ou as regras do Firebase.
          </div>
        )}

        {/* Conteúdo */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 size={24} className="animate-spin text-white/20" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
            <Users size={56} strokeWidth={0.7} className="text-white/8" />
            <div>
              <p className="text-sm font-semibold text-white/25">
                {loadError ? 'Comunidade indisponível' : queryText ? 'Nenhum resultado' : 'Nenhuma playlist ainda'}
              </p>
              <p className="text-xs text-white/15 mt-1">
                {loadError ? 'Tente novamente mais tarde' : queryText ? 'Tente outro termo de busca' : 'Sincronize sua biblioteca para aparecer aqui'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {!queryText && filtered.length > 0 && (
              <p className="text-xs text-white/25 font-medium uppercase tracking-wider">
                {filtered.length} playlist{filtered.length !== 1 ? 's' : ''} disponíve{filtered.length !== 1 ? 'is' : 'l'}
              </p>
            )}
            <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))' }}>
              {filtered.map(p => (
                <CommunityCard
                  key={p.id}
                  p={p}
                  onImport={handleImport}
                  importing={importing}
                  canImport={!!user}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl text-sm font-medium
                         shadow-2xl slide-up ${toast.ok ? 'bg-green-700/95 text-white' : 'bg-red-700/95 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

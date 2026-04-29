import React, { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { DownloadCloud, ListMusic, Loader2, RefreshCw, Search, Users } from 'lucide-react'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

function coverSrc(src) {
  if (!src) return ''
  if (/^https?:\/\//.test(src) || src.startsWith('file://')) return src
  return `file://${src}`
}

const FRAME_CLASS = {
  classic: 'border-brand-500/50 bg-brand-600/30',
  neon: 'border-cyan-300 bg-cyan-400/20 shadow-[0_0_12px_rgba(34,211,238,0.35)]',
  sunset: 'border-rose-300 bg-amber-400/20 shadow-[0_0_12px_rgba(251,113,133,0.35)]',
  mint: 'border-emerald-300 bg-emerald-400/20 shadow-[0_0_12px_rgba(52,211,153,0.28)]',
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
      const q = query(collection(db, 'communityPlaylists'), orderBy('updatedAt', 'desc'))
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
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users size={18} className="text-brand-400" /> Comunidade
            </h1>
            <p className="text-xs text-white/40">
              Playlists enviadas por ouvintes ao sincronizar com a nuvem
            </p>
          </div>
          <button onClick={loadCommunity} disabled={loading} className="btn-ghost p-2 text-white/50 disabled:opacity-40">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        </div>

        {!user && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            Entre em uma conta para baixar playlists da comunidade e enviar as suas.
          </div>
        )}

        {loadError && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-200">
            A comunidade ainda não está liberada nas regras do Firebase.
          </div>
        )}

        <div className="relative max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={queryText}
            onChange={e => setQueryText(e.target.value)}
            placeholder="Buscar playlist ou criador..."
            className="input-base pl-9 w-full text-sm"
          />
        </div>

        {toast && (
          <div className={`fixed bottom-24 right-6 z-50 px-4 py-2.5 rounded-xl text-sm shadow-xl ${toast.ok ? 'bg-green-600/90 text-white' : 'bg-red-600/90 text-white'}`}>
            {toast.msg}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24 text-white/30">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-white/20 gap-3">
            <ListMusic size={40} strokeWidth={1.2} />
            <p className="text-sm">{loadError ? 'Comunidade indisponível' : 'Nenhuma playlist encontrada'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map(p => (
              <div key={p.id} className="card p-4 flex flex-col gap-3">
                <div className="aspect-square rounded-lg overflow-hidden bg-surface-700">
                  {p.cover_url ? (
                    <img src={coverSrc(p.cover_url)} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/10">
                      <ListMusic size={32} strokeWidth={1} />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.name}</p>
                  <div className="flex items-center gap-1.5 mt-1 min-w-0">
                    <div className={`w-5 h-5 rounded-full p-0.5 border shrink-0 ${FRAME_CLASS[p.owner_frame] || FRAME_CLASS.classic}`}>
                      <div className="w-full h-full rounded-full overflow-hidden bg-surface-700 flex items-center justify-center">
                        {p.owner_avatar ? (
                          <img src={p.owner_avatar} alt={p.owner_name || 'Criador'} className="w-full h-full object-cover" />
                        ) : (
                          <Users size={9} className="text-white/35" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-white/35 truncate">por {p.owner_name || 'Ouvinte NianPlay'}</p>
                  </div>
                  <p className="text-xs text-white/25 mt-1">{p.trackCount ?? p.tracks?.length ?? 0} faixas</p>
                </div>
                <button
                  onClick={() => handleImport(p)}
                  disabled={!user || importing === p.id}
                  className="btn-primary w-full justify-center text-xs py-2 flex items-center gap-1.5 disabled:opacity-40"
                >
                  {importing === p.id
                    ? <><Loader2 size={13} className="animate-spin" /> Baixando...</>
                    : <><DownloadCloud size={13} /> Adicionar</>
                  }
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

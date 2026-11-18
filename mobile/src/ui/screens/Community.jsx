// Comunidade — playlists shared by NianPlay listeners (Firestore "communityPlaylists", the same
// collection as the desktop's CommunityPage). Gallery + search; a playlist opens a preview with its
// songs and "Adicionar à biblioteca" (playlists.importCommunity → a local copy; songs without a
// file here can then be downloaded from YouTube on Android).
import React, { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { Users, Search, X, RefreshCw, Loader2, Plus, ListMusic, ChevronLeft, Check, Tag, ExternalLink } from 'lucide-react'
import { db as firestore } from '../../../../src/renderer/firebase'
import { useAuth } from '../../../../src/renderer/contexts/AuthContext'
import { PageHeader, EmptyState, formatTime } from '../common'
import { useShell } from '../shell'
import { Avatar } from './Account'
import { DownloadsIcon } from '../downloads'

const FRAME = { classic: '#d97706', neon: '#22d3ee', sunset: '#fb7185', mint: '#34d399' }

// Loaded once per app session; "Atualizar" reloads
let cache = null
async function loadCommunity(force = false) {
  if (cache && !force) return cache
  const snap = await getDocs(query(collection(firestore, 'communityPlaylists'), orderBy('updatedAt', 'desc')))
  cache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  if (import.meta.env.DEV) window.__community = cache
  return cache
}

const trackCount = p => p.trackCount ?? p.tracks?.length ?? 0

function CommunityArt({ p, size = '100%', rounded = 'rounded-xl' }) {
  const [failed, setFailed] = useState(false)
  const src = /^https?:\/\//.test(p.cover_url || '') ? p.cover_url : null
  // No cover of its own: the first song covers that have a link to an image (2×2, like the library)
  const covers = useMemo(() => [...new Set((p.tracks || []).map(t => t.cover_url).filter(u => /^https?:\/\//.test(u || '')))].slice(0, 4), [p])
  const box = { width: size, height: size }
  if (src && !failed) return <img src={src} alt="" onError={() => setFailed(true)} className={`${rounded} object-cover bg-surface-700`} style={box} />
  if (covers.length >= 4) {
    return (
      <div className={`${rounded} grid grid-cols-2 grid-rows-2 overflow-hidden bg-surface-700`} style={box}>
        {covers.map(c => <img key={c} src={c} alt="" loading="lazy" className="w-full h-full object-cover" />)}
      </div>
    )
  }
  return (
    <div className={`${rounded} flex items-center justify-center bg-surface-700 border border-white/[0.06]`} style={box}>
      <ListMusic size={typeof size === 'number' ? Math.round(size * 0.3) : 40} strokeWidth={0.8} className="text-white/15" />
    </div>
  )
}

function Owner({ p, small = false }) {
  const ring = FRAME[p.owner_frame] || FRAME.classic
  const s = small ? 16 : 22
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="rounded-full overflow-hidden bg-surface-600 shrink-0 flex items-center justify-center" style={{ width: s, height: s, border: `1.5px solid ${ring}` }}>
        {p.owner_avatar ? <img src={p.owner_avatar} alt="" className="w-full h-full object-cover" /> : <Users size={s * 0.45} className="text-white/30" />}
      </span>
      <span className={`${small ? 'text-[11px]' : 'text-[13px]'} text-white/40 truncate`}>{p.owner_name || 'Ouvinte NianPlay'}</span>
    </div>
  )
}

export default function Community() {
  const shell = useShell()
  const [list, setList] = useState(cache)
  const [loading, setLoading] = useState(!cache)
  const [error, setError] = useState('')
  const [text, setText] = useState('')

  async function load(force = false) {
    setLoading(true); setError('')
    try { setList(await loadCommunity(force)) }
    catch (e) { setError(e?.message || 'Erro ao carregar a comunidade') }
    setLoading(false)
  }
  useEffect(() => { if (!cache) load() }, [])

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase()
    const all = list || []
    return q ? all.filter(p => (p.name || '').toLowerCase().includes(q) || (p.owner_name || '').toLowerCase().includes(q)) : all
  }, [list, text])

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <PageHeader title="Comunidade" subtitle="Playlists compartilhadas por ouvintes NianPlay"
        right={<>
          <button onClick={() => load(true)} disabled={loading} aria-label="Atualizar"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/60 border border-white/8 bg-white/[0.04] active:bg-white/10 disabled:opacity-40">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
          <DownloadsIcon />
          <button onClick={() => shell.navigate({ type: 'account' })} aria-label="Perfil e ajustes"><Avatar size={36} /></button>
        </>}>
        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Buscar playlist ou criador…" className="m-input !h-11 !pl-10 !pr-10" />
            {text && <button onClick={() => setText('')} aria-label="Limpar busca" className="absolute right-0.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/35"><X size={16} /></button>}
          </div>
        </div>
      </PageHeader>

      {error ? (
        <EmptyState icon={Users} title="Comunidade indisponível" desc={`Confira a internet e tente de novo. (${error})`}>
          <button onClick={() => load(true)} className="m-btn-ghost"><RefreshCw size={16} /> Tentar de novo</button>
        </EmptyState>
      ) : loading && !list ? (
        <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-brand-500/70" /></div>
      ) : !filtered.length ? (
        <EmptyState icon={Users} title={text ? 'Nenhum resultado' : 'Nenhuma playlist ainda'}
          desc={text ? 'Tente outro termo de busca.' : 'Sincronize sua biblioteca no computador para aparecer aqui.'} />
      ) : (
        <>
          <p className="m-label px-4 pt-4 pb-2">{filtered.length} playlist{filtered.length !== 1 ? 's' : ''} {text ? 'encontrada' + (filtered.length !== 1 ? 's' : '') : 'disponíve' + (filtered.length !== 1 ? 'is' : 'l')}</p>
          <div className="px-2 grid grid-cols-2 gap-2">
            {filtered.map(p => (
              <button key={p.id} onClick={() => shell.navigate({ type: 'community', id: p.id })}
                className="text-left p-2 rounded-xl bg-white/[0.025] border border-white/[0.05] active:bg-white/[0.06] transition-colors">
                <div className="relative aspect-square w-full shadow-lg shadow-black/40 rounded-xl">
                  <CommunityArt p={p} />
                  <span className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-sm rounded-md px-1.5 py-0.5 text-[10px] text-white/75 font-medium tabular-nums">
                    {trackCount(p)} faixas
                  </span>
                </div>
                <p className="text-[13px] font-semibold text-white/90 truncate mt-2.5">{p.name}</p>
                <div className="mt-1"><Owner p={p} small /></div>
              </button>
            ))}
          </div>
        </>
      )}
      <div style={{ height: 'calc(env(safe-area-inset-bottom) + 170px)' }} />
    </div>
  )
}

/** Preview of one community playlist (page type 'community'). */
export function CommunityPlaylist({ id }) {
  const shell = useShell()
  const { user } = useAuth() || {}
  const [p, setP] = useState(() => cache?.find(x => x.id === id) || null)
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState(null)   // the local playlist created from it

  useEffect(() => { if (!p) loadCommunity().then(all => setP(all.find(x => x.id === id) || null)).catch(() => {}) }, [id])
  if (!p) return <div className="h-full flex items-center justify-center"><Loader2 size={24} className="animate-spin text-brand-500/70" /></div>

  const tracks = p.tracks || []
  const total = tracks.reduce((s, t) => s + (t.duration || 0), 0)
  const groups = p.groups || []

  async function add() {
    setBusy(true)
    const res = await window.electron.playlists.importCommunity({
      name: p.name,
      cover_url: p.cover_url || '',
      groups_enabled: p.groups_enabled || false,
      groups,
      tracks,
    })
    setBusy(false)
    if (res?.ok) {
      setAdded(res.playlist)
      shell.toast(res.renamedFrom ? `Adicionada como "${res.playlist.name}"` : `"${res.playlist.name}" está na sua biblioteca`)
    } else shell.toast(res?.error || 'Erro ao adicionar a playlist', false)
  }

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="sticky top-0 z-10 bg-surface-900/95 backdrop-blur-md border-b border-white/[0.05] flex items-center gap-2 px-2 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 6px)' }}>
        <button onClick={shell.back} aria-label="Voltar"
          className="h-9 pl-1.5 pr-3 rounded-xl flex items-center gap-0.5 text-[13px] font-medium text-white/70 border border-white/8 bg-white/[0.04] active:scale-95 transition-transform">
          <ChevronLeft size={20} /> Voltar
        </button>
        <p className="flex-1 text-[15px] font-bold text-white truncate text-center pr-[76px]">Comunidade</p>
      </div>

      {/* Hero (same blocks as a library playlist) */}
      <div className="px-4 pt-5 flex items-end gap-4">
        <div className="shrink-0 shadow-2xl shadow-black/60 rounded-2xl"><CommunityArt p={p} size={128} rounded="rounded-2xl" /></div>
        <div className="flex-1 min-w-0 pb-1">
          <p className="m-label mb-1">Playlist da comunidade</p>
          <h1 className="text-[22px] font-black text-white tracking-tight leading-[1.1] line-clamp-3 break-words">{p.name}</h1>
          <p className="text-xs text-white/40 mt-1.5 tabular-nums">
            {tracks.length} faixa{tracks.length !== 1 ? 's' : ''}{total ? ` · ${Math.round(total / 60)} min` : ''}
          </p>
          <div className="mt-1.5"><Owner p={p} /></div>
        </div>
      </div>

      <div className="px-4 mt-5 flex flex-col gap-2">
        {!user && (
          <p className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-200/80 leading-relaxed">
            Entre na sua conta (Perfil) para adicionar playlists da comunidade à sua biblioteca.
          </p>
        )}
        {added ? (
          <button onClick={() => shell.navigate({ type: 'playlist', id: added.id })} className="m-btn-primary">
            <Check size={17} /> Abrir na biblioteca
          </button>
        ) : (
          <button onClick={add} disabled={!user || busy} className="m-btn-primary">
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />} Adicionar à biblioteca
          </button>
        )}
        <p className="text-[12px] text-white/30 leading-relaxed px-1">
          As músicas que você já tem são reaproveitadas; as outras entram sem arquivo{tracks.some(t => t.yt_url) ? ' — dá para baixá-las do YouTube na playlist.' : '.'}
        </p>
      </div>

      {groups.length > 0 && (
        <div className="mx-3 mt-4 rounded-xl bg-surface-800/60 border border-white/6 px-3.5 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Tag size={12} className="text-brand-400" />
            <span className="text-[13px] font-semibold text-brand-300">Grupos de sequência</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {groups.map(g => (
              <span key={g.name} className="inline-flex items-center gap-1.5 h-7 text-[12px] font-medium px-2.5 rounded-full border"
                style={{ borderColor: (g.color || '#d97706') + '40', backgroundColor: (g.color || '#d97706') + '15', color: g.color || '#d97706' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: g.color || '#d97706' }} />{g.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="m-label px-4 pt-5 pb-2">Faixas</p>
      <div className="px-2 flex flex-col gap-1">
        {tracks.map((t, i) => {
          const g = t.group_name ? groups.find(x => x.name === t.group_name) : null
          return (
            <div key={i} className="m-row relative flex items-center gap-3 pl-2.5 pr-3 py-2 overflow-hidden">
              {g && <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full" style={{ backgroundColor: g.color }} />}
              <span className="w-6 -mr-1 text-center text-xs tabular-nums text-white/25 shrink-0">{i + 1}</span>
              <div className="w-11 h-11 rounded-lg overflow-hidden bg-surface-700 shrink-0 flex items-center justify-center">
                {/^https?:\/\//.test(t.cover_url || '') ? <img src={t.cover_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : <ListMusic size={16} className="text-white/15" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-medium text-white/90 truncate">{t.title || 'Desconhecido'}</p>
                <p className="text-[12px] text-white/35 truncate">{t.artist || 'Desconhecido'}{t.duration ? ` · ${formatTime(t.duration)}` : ''}</p>
              </div>
              {t.yt_url && <ExternalLink size={13} className="text-white/20 shrink-0" aria-label="Tem link do YouTube" />}
            </div>
          )
        })}
      </div>
      <div style={{ height: 'calc(env(safe-area-inset-bottom) + 170px)' }} />
    </div>
  )
}

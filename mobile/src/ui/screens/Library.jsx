// Sua Biblioteca — chips (Playlists / Artistas), sort, pinned "Todas as músicas", list rows.
import React, { useMemo, useState } from 'react'
import { Plus, Heart, ArrowUpDown, Pin, X } from 'lucide-react'
import { useLibrary, Cover, isPlayable } from '../common'
import { PlaylistArt } from '../tracks'
import { usePlaylists } from '../hooks'
import { usePlayContext } from '../playContext'
import { useShell } from '../shell'
import { Avatar } from './Account'
import { artistsOf } from './Search'

export default function Library() {
  const shell = useShell()
  const [library] = useLibrary()
  const [playlists] = usePlaylists()
  const { recent } = usePlayContext()
  const [filter, setFilter] = useState(null)          // null | 'playlists' | 'artists'
  const [sort, setSort] = useState('recent')          // 'recent' | 'alpha'

  const onPhone = library.filter(isPlayable).length

  const items = useMemo(() => {
    const lastPlayed = r => recent.find(x => x.type === r.type && (x.id || x.name) === (r.id || r.name))?.at || 0
    const pls = playlists.map(p => ({ kind: 'playlist', key: `p-${p.id}`, id: p.id, name: p.name, sub: `Playlist · ${p.trackCount} música${p.trackCount !== 1 ? 's' : ''}`, playlist: p, at: Math.max(lastPlayed({ type: 'playlist', id: p.id }), p.updated_at || p.created_at || 0) }))
    const arts = artistsOf(library).map(a => ({ kind: 'artist', key: `a-${a.name}`, name: a.name, sub: 'Artista', cover: a.cover, at: lastPlayed({ type: 'artist', name: a.name }) }))
    let list = filter === 'playlists' ? pls : filter === 'artists' ? arts : [...pls, ...arts.filter(a => a.at)]
    list = sort === 'alpha'
      ? list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      : list.sort((a, b) => b.at - a.at || a.name.localeCompare(b.name, 'pt-BR'))
    return list
  }, [playlists, library, recent, filter, sort])

  const chip = (id, label) => (
    <button onClick={() => setFilter(filter === id ? null : id)}
      className={`shrink-0 h-8 px-3.5 rounded-full text-[13px] font-medium border transition-colors
        ${filter === id ? 'bg-brand-500 border-brand-500 text-surface-900' : 'bg-transparent border-white/25 text-white'}`}>
      {label}
    </button>
  )

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="sticky top-0 z-10 bg-surface-900 shadow-[0_8px_16px_-8px_rgba(0,0,0,0.6)]" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        <div className="flex items-center gap-3 px-4">
          <button onClick={() => shell.navigate({ type: 'account' })} aria-label="Perfil e ajustes"><Avatar size={34} /></button>
          <h1 className="flex-1 text-2xl font-black text-white tracking-tight">Sua Biblioteca</h1>
          <button aria-label="Criar playlist" className="p-2 -mr-2 text-white"
            onClick={() => shell.prompt({
              title: 'Dê um nome à sua playlist', confirmLabel: 'Criar',
              onSubmit: async name => {
                const pl = await window.electron.playlists.create({ name })
                if (pl?.error) return pl.error
                shell.notifyLibrary()
                shell.navigate({ type: 'playlist', id: pl.id })
              },
            })}>
            <Plus size={28} />
          </button>
        </div>
        <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
          {filter && (
            <button onClick={() => setFilter(null)} aria-label="Limpar filtro" className="shrink-0 w-8 h-8 rounded-full border border-white/25 flex items-center justify-center text-white">
              <X size={16} />
            </button>
          )}
          {(!filter || filter === 'playlists') && chip('playlists', 'Playlists')}
          {(!filter || filter === 'artists') && chip('artists', 'Artistas')}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pt-1 pb-2">
        <button onClick={() => setSort(sort === 'recent' ? 'alpha' : 'recent')} className="flex items-center gap-1.5 text-[13px] text-white/85">
          <ArrowUpDown size={15} /> {sort === 'recent' ? 'Recentes' : 'Ordem alfabética'}
        </button>
      </div>

      {/* Pinned: Todas as músicas (Spotify's "Músicas Curtidas") */}
      {filter !== 'artists' && (
        <button onClick={() => shell.navigate({ type: 'all' })} className="w-full flex items-center gap-3 px-4 py-2 active:bg-white/5 text-left">
          <div className="w-16 h-16 rounded flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #f59e0b, #78350f)' }}>
            <Heart size={26} className="text-white" fill="white" />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] text-white truncate">Todas as músicas</p>
            <p className="text-[13px] text-white/50 truncate flex items-center gap-1">
              <Pin size={12} className="text-brand-400 rotate-45" fill="currentColor" />
              Playlist · {library.length} músicas{library.length ? ` · ${onPhone} no iPhone` : ''}
            </p>
          </div>
        </button>
      )}

      {items.map(it => (
        <button key={it.key} className="w-full flex items-center gap-3 px-4 py-2 active:bg-white/5 text-left"
          onClick={() => shell.navigate(it.kind === 'playlist' ? { type: 'playlist', id: it.id } : { type: 'artist', name: it.name })}>
          {it.kind === 'playlist' ? <PlaylistArt playlist={it.playlist} size={64} /> : <Cover track={it.cover} size={64} rounded="rounded-full" />}
          <div className="min-w-0">
            <p className="text-[15px] text-white truncate">{it.name}</p>
            <p className="text-[13px] text-white/50 truncate">{it.sub}</p>
          </div>
        </button>
      ))}

      {!items.length && filter && (
        <p className="text-center text-sm text-white/45 py-10">{filter === 'playlists' ? 'Nenhuma playlist ainda.' : 'Nenhum artista ainda.'}</p>
      )}
      <div style={{ height: 'calc(env(safe-area-inset-bottom) + 160px)' }} />
    </div>
  )
}

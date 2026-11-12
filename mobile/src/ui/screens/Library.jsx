// Biblioteca — Spotify's library (filters, sort, pinned "Todas as músicas", list or grid) with the
// desktop blocks: page header with counts and "Nova", amber-underlined tabs, row blocks and the
// Playlists page gallery for the grid view.
import React, { useEffect, useMemo, useState } from 'react'
import { Plus, ArrowUpDown, Pin, LayoutGrid, List as ListIcon, ListMusic, Users } from 'lucide-react'
import { useLibrary, Cover, PageHeader, EmptyState, isPlayable } from '../common'
import { PlaylistArt } from '../tracks'
import { usePlaylists } from '../hooks'
import { usePlayContext } from '../playContext'
import { useShell } from '../shell'
import { Avatar } from './Account'
import { artistsOf } from './Search'
import { AllSongsArt, Card } from './Home'

const FILTERS = [
  { id: null, label: 'Tudo' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'artists', label: 'Artistas' },
]

export default function Library() {
  const shell = useShell()
  const [library] = useLibrary()
  const [playlists] = usePlaylists()
  const { recent } = usePlayContext()
  const [filter, setFilter] = useState(null)          // null | 'playlists' | 'artists'
  const [sort, setSort] = useState('recent')          // 'recent' | 'alpha'
  const [view, setView] = useState('list')            // 'list' | 'grid'

  useEffect(() => { window.electron.settings.get('mobileLibraryView').then(v => { if (v === 'grid') setView('grid') }) }, [])
  const toggleView = () => {
    const next = view === 'list' ? 'grid' : 'list'
    setView(next)
    window.electron.settings.set('mobileLibraryView', next)
  }

  const onPhone = library.filter(isPlayable).length
  const allArtists = useMemo(() => artistsOf(library), [library])

  const items = useMemo(() => {
    const lastPlayed = r => recent.find(x => x.type === r.type && (x.id || x.name) === (r.id || r.name))?.at || 0
    const pls = playlists.map(p => ({ kind: 'playlist', key: `p-${p.id}`, id: p.id, name: p.name, sub: `${p.trackCount} faixa${p.trackCount !== 1 ? 's' : ''}`, playlist: p, at: Math.max(lastPlayed({ type: 'playlist', id: p.id }), p.updated_at || p.created_at || 0) }))
    const arts = allArtists.map(a => ({ kind: 'artist', key: `a-${a.name}`, name: a.name, sub: `${a.count} faixa${a.count !== 1 ? 's' : ''}`, cover: a.cover, at: lastPlayed({ type: 'artist', name: a.name }) }))
    let list = filter === 'playlists' ? pls : filter === 'artists' ? arts : [...pls, ...arts.filter(a => a.at)]
    list = sort === 'alpha'
      ? list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      : list.sort((a, b) => b.at - a.at || a.name.localeCompare(b.name, 'pt-BR'))
    return list
  }, [playlists, allArtists, recent, filter, sort])

  const open = it => shell.navigate(it.kind === 'playlist' ? { type: 'playlist', id: it.id } : { type: 'artist', name: it.name })
  const newPlaylist = () => shell.prompt({
    title: 'Nova playlist', label: 'Nome da playlist', confirmLabel: 'Criar',
    onSubmit: async name => {
      const pl = await window.electron.playlists.create({ name })
      if (pl?.error) return pl.error
      shell.notifyLibrary()
      shell.navigate({ type: 'playlist', id: pl.id })
    },
  })
  const showAll = filter !== 'artists'
  const allMeta = `${library.length.toLocaleString('pt-BR')} faixas${library.length ? ` · ${onPhone.toLocaleString('pt-BR')} no iPhone` : ''}`

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <PageHeader title="Biblioteca"
        subtitle={`${playlists.length} playlist${playlists.length !== 1 ? 's' : ''} · ${allArtists.length} artista${allArtists.length !== 1 ? 's' : ''} · ${library.length.toLocaleString('pt-BR')} faixas`}
        right={<>
          <button onClick={newPlaylist} className="m-chip-primary !px-3" aria-label="Nova playlist"><Plus size={17} /> Nova</button>
          <button onClick={() => shell.navigate({ type: 'account' })} aria-label="Perfil e ajustes"><Avatar size={36} /></button>
        </>}>
        {/* Desktop tabs: amber text + underline on the active one */}
        <div className="flex items-center px-2">
          {FILTERS.map(f => (
            <button key={f.label} onClick={() => setFilter(f.id)}
              className={`relative px-3.5 py-2.5 text-[13px] font-medium transition-colors ${filter === f.id ? 'text-brand-400' : 'text-white/40'}`}>
              {f.label}
              {filter === f.id && <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-brand-500" />}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={toggleView} aria-label={view === 'list' ? 'Ver em grade' : 'Ver em lista'} className="m-icon-btn">
            {view === 'list' ? <LayoutGrid size={17} /> : <ListIcon size={18} />}
          </button>
        </div>
      </PageHeader>

      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <button onClick={() => setSort(sort === 'recent' ? 'alpha' : 'recent')}
          className="h-8 px-3 rounded-lg bg-white/[0.04] border border-white/8 flex items-center gap-1.5 text-[12px] font-medium text-white/60 active:bg-white/10">
          <ArrowUpDown size={13} /> {sort === 'recent' ? 'Recentes' : 'Ordem alfabética'}
        </button>
        <span className="text-[11px] text-white/25 tabular-nums">{items.length + (showAll ? 1 : 0)} itens</span>
      </div>

      {view === 'list' ? (
        <div className="px-2 flex flex-col gap-1">
          {/* Pinned: Todas as músicas (Spotify's "Músicas Curtidas") */}
          {showAll && (
            <button onClick={() => shell.navigate({ type: 'all' })} className="m-row flex items-center gap-3 p-2 text-left active:bg-white/[0.07]">
              <AllSongsArt size={52} rounded="rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-white/90 truncate">Todas as músicas</p>
                <p className="text-[12px] text-white/35 truncate flex items-center gap-1 mt-0.5">
                  <Pin size={11} className="text-brand-500 rotate-45 shrink-0" fill="currentColor" />
                  Playlist · {allMeta}
                </p>
              </div>
            </button>
          )}
          {items.map(it => (
            <button key={it.key} onClick={() => open(it)} className="m-row flex items-center gap-3 p-2 text-left active:bg-white/[0.07]">
              {it.kind === 'playlist' ? <PlaylistArt playlist={it.playlist} size={52} rounded="rounded-lg" /> : <Cover track={it.cover} size={52} rounded="rounded-full" />}
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-white/90 truncate">{it.name}</p>
                <p className="text-[12px] text-white/35 truncate mt-0.5">{it.kind === 'playlist' ? 'Playlist' : 'Artista'} · {it.sub}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-2 grid grid-cols-2 gap-2">
          {showAll && (
            <Card width="100%" onClick={() => shell.navigate({ type: 'all' })}
              art={<div className="aspect-square w-full"><AllSongsArt size="100%" /></div>}
              title="Todas as músicas" meta={allMeta} />
          )}
          {items.map(it => (
            <Card key={it.key} width="100%" onClick={() => open(it)} round={it.kind === 'artist'}
              art={<div className="aspect-square w-full">{it.kind === 'playlist'
                ? <PlaylistArt playlist={it.playlist} size="100%" />
                : <Cover track={it.cover} size="100%" big rounded="rounded-full" />}</div>}
              title={it.name}
              meta={`${it.kind === 'playlist' ? 'Playlist' : 'Artista'} · ${it.sub}`} />
          ))}
        </div>
      )}

      {!items.length && filter && (
        filter === 'playlists'
          ? <EmptyState icon={ListMusic} title="Nenhuma playlist ainda" desc="Crie uma aqui ou baixe as suas da nuvem no Perfil.">
              <button onClick={newPlaylist} className="m-btn-primary"><Plus size={17} /> Nova playlist</button>
            </EmptyState>
          : <EmptyState icon={Users} title="Nenhum artista ainda" desc="Os artistas aparecem conforme as músicas entram na biblioteca." />
      )}
      <div style={{ height: 'calc(env(safe-area-inset-bottom) + 170px)' }} />
    </div>
  )
}

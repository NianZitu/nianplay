// Buscar — Spotify's search flow (big field, browse when empty, songs/artists/playlists results)
// with the desktop look: input-base field with amber focus, gallery cards, labelled sections.
import React, { useMemo, useState } from 'react'
import { Search as SearchIcon, X, SearchX } from 'lucide-react'
import { usePlayer } from '../../../../src/renderer/store/PlayerContext'
import { useLibrary, Cover, PageHeader, SectionTitle, EmptyState, isPlayable } from '../common'
import { TrackRow, TrackMenu, PlaylistArt } from '../tracks'
import { usePlaylists } from '../hooks'
import { setPlayContext } from '../playContext'
import { useShell } from '../shell'
import { Avatar } from './Account'
import { AllSongsArt, Card } from './Home'

export function artistsOf(library) {
  const map = new Map()
  for (const t of library) {
    const name = (t.artist || '').trim()
    if (!name || name.toLowerCase() === 'desconhecido') continue
    const key = name.toLowerCase()
    const a = map.get(key) || { name, count: 0, cover: null }
    a.count++
    if (!a.cover && t.cover_path) a.cover = t
    map.set(key, a)
  }
  return [...map.values()]
}

export default function Search() {
  const shell = useShell()
  const player = usePlayer()
  const [library] = useLibrary()
  const [playlists] = usePlaylists()
  const [query, setQuery] = useState('')
  const [menuTrack, setMenuTrack] = useState(null)
  const artists = useMemo(() => artistsOf(library).sort((a, b) => b.count - a.count), [library])

  const q = query.trim().toLowerCase()
  const results = useMemo(() => {
    if (!q) return null
    const has = s => (s || '').toLowerCase().includes(q)
    return {
      tracks: library.filter(t => has(t.title) || has(t.artist) || has(t.album)).slice(0, 50),
      playlists: playlists.filter(p => has(p.name)),
      artists: artists.filter(a => has(a.name)).slice(0, 8),
    }
  }, [q, library, playlists, artists])

  function playFromResults(track) {
    if (!isPlayable(track)) { shell.toast('Esta música não está neste iPhone.', false); return }
    const queue = results.tracks.filter(isPlayable)
    player.setGroupsEnabled(false)
    player.playTrack(track, queue)
    setPlayContext({ type: 'all', name: 'Todas as músicas' })
  }

  const count = results ? results.tracks.length + results.playlists.length + results.artists.length : 0

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <PageHeader title="Buscar"
        subtitle={results ? `${count} resultado${count !== 1 ? 's' : ''} para "${query.trim()}"` : 'Músicas, artistas e playlists'}
        right={<button onClick={() => shell.navigate({ type: 'account' })} aria-label="Perfil e ajustes"><Avatar size={36} /></button>}>
        <div className="px-4 pb-3">
          <div className="relative">
            <SearchIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="O que você quer ouvir?"
              enterKeyHint="search" className="m-input !pl-11 !pr-11" />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Limpar busca"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/35 active:text-white">
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </PageHeader>

      {!results ? (
        <div className="pb-2">
          {playlists.length > 0 && (
            <section className="mt-5">
              <SectionTitle label="Navegar" title="Suas playlists" />
              <div className="mt-3 px-2 grid grid-cols-2 gap-2">
                <Card width="100%" onClick={() => shell.navigate({ type: 'all' })}
                  art={<div className="aspect-square w-full"><AllSongsArt size="100%" /></div>}
                  title="Todas as músicas" meta={`${library.length.toLocaleString('pt-BR')} faixas`} />
                {playlists.map(p => (
                  <Card key={p.id} width="100%" onClick={() => shell.navigate({ type: 'playlist', id: p.id })}
                    art={<div className="aspect-square w-full"><PlaylistArt playlist={p} size="100%" /></div>}
                    title={p.name} meta={`${p.trackCount} faixa${p.trackCount !== 1 ? 's' : ''}`} />
                ))}
              </div>
            </section>
          )}
          {artists.length > 0 && (
            <section className="mt-7">
              <SectionTitle label="Navegar" title="Artistas" />
              <div className="mt-3 px-2 grid grid-cols-3 gap-2">
                {artists.slice(0, 24).map(a => (
                  <button key={a.name} onClick={() => shell.navigate({ type: 'artist', name: a.name })}
                    className="flex flex-col items-center gap-2 p-2 rounded-xl active:bg-white/5">
                    <div className="w-full aspect-square"><Cover track={a.cover} size="100%" rounded="rounded-full" className="shadow-lg shadow-black/40" /></div>
                    <div className="w-full text-center min-w-0">
                      <p className="text-[12.5px] font-semibold text-white/85 truncate">{a.name}</p>
                      <p className="text-[11px] text-white/30">{a.count} faixa{a.count !== 1 ? 's' : ''}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
          {!playlists.length && !artists.length && (
            <EmptyState icon={SearchIcon} title="Sua biblioteca está vazia" desc="Comece pelo Início: entre na conta e importe suas músicas." />
          )}
        </div>
      ) : (
        <div className="pb-2">
          {results.artists.length > 0 && (
            <Section label="Artistas" count={results.artists.length}>
              <div className="px-2 flex flex-col gap-1">
                {results.artists.map(a => (
                  <button key={a.name} onClick={() => shell.navigate({ type: 'artist', name: a.name })} className="m-row flex items-center gap-3 p-2 text-left active:bg-white/[0.07]">
                    <Cover track={a.cover} size={46} rounded="rounded-full" />
                    <div className="min-w-0"><p className="text-[15px] font-semibold text-white/90 truncate">{a.name}</p><p className="text-[12px] text-white/35">Artista · {a.count} faixa{a.count !== 1 ? 's' : ''}</p></div>
                  </button>
                ))}
              </div>
            </Section>
          )}
          {results.playlists.length > 0 && (
            <Section label="Playlists" count={results.playlists.length}>
              <div className="px-2 flex flex-col gap-1">
                {results.playlists.map(p => (
                  <button key={p.id} onClick={() => shell.navigate({ type: 'playlist', id: p.id })} className="m-row flex items-center gap-3 p-2 text-left active:bg-white/[0.07]">
                    <PlaylistArt playlist={p} size={46} rounded="rounded-lg" />
                    <div className="min-w-0"><p className="text-[15px] font-semibold text-white/90 truncate">{p.name}</p><p className="text-[12px] text-white/35">Playlist · {p.trackCount} faixas</p></div>
                  </button>
                ))}
              </div>
            </Section>
          )}
          {results.tracks.length > 0 && (
            <Section label="Músicas" count={results.tracks.length}>
              {results.tracks.map(t => <TrackRow key={t.id} track={t} onPlay={playFromResults} onMenu={setMenuTrack} />)}
            </Section>
          )}
          {!count && (
            <EmptyState icon={SearchX} title={`Nenhum resultado para "${query.trim()}"`} desc="Confira a ortografia ou tente outras palavras." />
          )}
        </div>
      )}
      <div style={{ height: 'calc(env(safe-area-inset-bottom) + 170px)' }} />
      {menuTrack && <TrackMenu track={menuTrack} onClose={() => setMenuTrack(null)} />}
    </div>
  )
}

function Section({ label, count, children }) {
  return (
    <section className="mt-4">
      <p className="m-label px-4 pb-2">{label} <span className="text-white/20">· {count}</span></p>
      {children}
    </section>
  )
}

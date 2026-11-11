// Buscar — big search bar; "Navegar por tudo" tiles when empty; songs/artists/playlists results.
import React, { useMemo, useState } from 'react'
import { Search as SearchIcon, X } from 'lucide-react'
import { usePlayer } from '../../../../src/renderer/store/PlayerContext'
import { useLibrary, Cover, isPlayable } from '../common'
import { TrackRow, TrackMenu, PlaylistArt } from '../tracks'
import { usePlaylists, colorFromString } from '../hooks'
import { setPlayContext } from '../playContext'
import { useShell } from '../shell'
import { Avatar } from './Account'

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

function Tile({ label, color, onClick }) {
  return (
    <button onClick={onClick} className="h-24 rounded-lg p-3 text-left overflow-hidden relative active:opacity-80" style={{ backgroundColor: color }}>
      <span className="text-[15px] font-bold text-white leading-tight line-clamp-3">{label}</span>
    </button>
  )
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

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="sticky top-0 z-10 bg-surface-900 px-4 pb-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => shell.navigate({ type: 'account' })} aria-label="Perfil e ajustes"><Avatar size={34} /></button>
          <h1 className="text-2xl font-black text-white tracking-tight">Buscar</h1>
        </div>
        <div className="flex items-center gap-2.5 rounded-md bg-white px-3 h-12">
          <SearchIcon size={22} className="text-surface-900 shrink-0" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="O que você quer ouvir?"
            className="flex-1 bg-transparent text-base font-semibold text-surface-900 placeholder-surface-500 outline-none min-w-0" />
          {query && <button onClick={() => setQuery('')} className="text-surface-700 p-1"><X size={20} /></button>}
        </div>
      </div>

      {!results ? (
        <div className="px-4">
          {playlists.length > 0 && (
            <>
              <h2 className="text-base font-bold text-white mt-2 mb-3">Suas playlists</h2>
              <div className="grid grid-cols-2 gap-3">
                <Tile label="Todas as músicas" color="#b45309" onClick={() => shell.navigate({ type: 'all' })} />
                {playlists.map(p => <Tile key={p.id} label={p.name} color={colorFromString(p.name)} onClick={() => shell.navigate({ type: 'playlist', id: p.id })} />)}
              </div>
            </>
          )}
          {artists.length > 0 && (
            <>
              <h2 className="text-base font-bold text-white mt-6 mb-3">Navegar por artista</h2>
              <div className="grid grid-cols-2 gap-3">
                {artists.slice(0, 20).map(a => <Tile key={a.name} label={a.name} color={colorFromString(a.name + '!')} onClick={() => shell.navigate({ type: 'artist', name: a.name })} />)}
              </div>
            </>
          )}
          {!playlists.length && !artists.length && (
            <p className="text-center text-sm text-white/45 py-16">Sua biblioteca está vazia. Comece pelo Início.</p>
          )}
        </div>
      ) : (
        <div>
          {results.artists.length > 0 && (
            <Section title="Artistas">
              {results.artists.map(a => (
                <button key={a.name} onClick={() => shell.navigate({ type: 'artist', name: a.name })} className="w-full flex items-center gap-3 px-4 py-2 active:bg-white/5 text-left">
                  <Cover track={a.cover} size={52} rounded="rounded-full" />
                  <div className="min-w-0"><p className="text-[15px] text-white truncate">{a.name}</p><p className="text-[13px] text-white/50">Artista</p></div>
                </button>
              ))}
            </Section>
          )}
          {results.playlists.length > 0 && (
            <Section title="Playlists">
              {results.playlists.map(p => (
                <button key={p.id} onClick={() => shell.navigate({ type: 'playlist', id: p.id })} className="w-full flex items-center gap-3 px-4 py-2 active:bg-white/5 text-left">
                  <PlaylistArt playlist={p} size={52} />
                  <div className="min-w-0"><p className="text-[15px] text-white truncate">{p.name}</p><p className="text-[13px] text-white/50">Playlist · {p.trackCount} músicas</p></div>
                </button>
              ))}
            </Section>
          )}
          {results.tracks.length > 0 && (
            <Section title="Músicas">
              {results.tracks.map(t => <TrackRow key={t.id} track={t} onPlay={playFromResults} onMenu={setMenuTrack} />)}
            </Section>
          )}
          {!results.tracks.length && !results.playlists.length && !results.artists.length && (
            <div className="text-center px-8 py-16">
              <p className="text-lg font-bold text-white">Nenhum resultado para "{query}"</p>
              <p className="text-sm text-white/50 mt-2">Confira a ortografia ou tente outras palavras.</p>
            </div>
          )}
        </div>
      )}
      <div style={{ height: 'calc(env(safe-area-inset-bottom) + 160px)' }} />
      {menuTrack && <TrackMenu track={menuTrack} onClose={() => setMenuTrack(null)} />}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="mt-3">
      <h2 className="px-4 text-base font-bold text-white mb-1">{title}</h2>
      {children}
    </section>
  )
}

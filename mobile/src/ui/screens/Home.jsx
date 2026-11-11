// Início — Spotify-style home: greeting, 2×3 shortcut grid, horizontal carousels.
import React, { useMemo } from 'react'
import { Heart, Settings } from 'lucide-react'
import { usePlayer } from '../../../../src/renderer/store/PlayerContext'
import { useLibrary, Cover, isPlayable } from '../common'
import { PlaylistArt } from '../tracks'
import { usePlaylists, greeting } from '../hooks'
import { usePlayContext, setPlayContext } from '../playContext'
import { useShell } from '../shell'
import { Avatar } from './Account'

function AllSongsArt({ size }) {
  return (
    <div className="rounded flex items-center justify-center shrink-0" style={{ width: size, height: size, background: 'linear-gradient(135deg, #f59e0b, #78350f)' }}>
      <Heart size={Math.round(size * 0.38)} className="text-white" fill="white" />
    </div>
  )
}

function ContextArt({ ctx, playlists, library, size }) {
  if (ctx.type === 'all') return <AllSongsArt size={size} />
  if (ctx.type === 'playlist') return <PlaylistArt playlist={playlists.find(p => p.id === ctx.id) || { name: ctx.name }} size={size} />
  const t = library.find(x => (x.artist || '').toLowerCase() === (ctx.name || '').toLowerCase() && x.cover_path) ||
    library.find(x => (x.artist || '').toLowerCase() === (ctx.name || '').toLowerCase())
  return <Cover track={t} size={size} rounded="rounded-full" />
}

function Carousel({ title, children }) {
  return (
    <section className="mt-7">
      <h2 className="px-4 text-[22px] font-bold text-white tracking-tight">{title}</h2>
      <div className="mt-3 flex gap-4 overflow-x-auto px-4 scroll-px-4 pb-1 no-scrollbar snap-x">{children}</div>
    </section>
  )
}

export default function Home() {
  const shell = useShell()
  const player = usePlayer()
  const [library] = useLibrary()
  const [playlists] = usePlaylists()
  const { recent } = usePlayContext()

  const openCtx = ctx => shell.navigate(ctx.type === 'all' ? { type: 'all' } : ctx.type === 'playlist' ? { type: 'playlist', id: ctx.id } : { type: 'artist', name: ctx.name })

  // 2×3 grid: Todas as músicas + recently played, then playlists
  const shortcuts = useMemo(() => {
    const items = [{ type: 'all', name: 'Todas as músicas' }]
    for (const r of recent) {
      if (r.type === 'all') continue
      if (r.type === 'playlist' && !playlists.some(p => p.id === r.id)) continue
      items.push(r)
    }
    for (const p of playlists) if (!items.some(i => i.type === 'playlist' && i.id === p.id)) items.push({ type: 'playlist', id: p.id, name: p.name })
    return items.slice(0, 6)
  }, [recent, playlists])

  const recentlyAdded = useMemo(() => [...library].filter(isPlayable).sort((a, b) => (b.created_at || 0) - (a.created_at || 0)).slice(0, 12), [library])
  const validRecent = recent.filter(r => r.type !== 'playlist' || playlists.some(p => p.id === r.id))
  const empty = library.length === 0 && playlists.length === 0

  return (
    <div className="h-full overflow-y-auto overscroll-contain" style={{ background: 'linear-gradient(to bottom, #3a2a10 0%, #0c0b09 240px)' }}>
      <div className="flex items-center gap-3 px-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        <button onClick={() => shell.navigate({ type: 'account' })} aria-label="Perfil e ajustes"><Avatar size={34} /></button>
        <h1 className="flex-1 text-2xl font-black text-white tracking-tight">{greeting()}</h1>
        <button onClick={() => shell.navigate({ type: 'account' })} aria-label="Ajustes" className="p-2 -mr-2 text-white/80"><Settings size={22} /></button>
      </div>

      {empty ? (
        <div className="mx-4 mt-6 rounded-2xl bg-white/8 border border-white/10 p-5 flex flex-col gap-3">
          <p className="text-lg font-bold text-white">Bem-vindo ao NianPlay no iPhone</p>
          <p className="text-sm text-white/60 leading-relaxed">
            Entre na sua conta para trazer suas playlists da nuvem e depois coloque os arquivos de música no iPhone.
          </p>
          <button onClick={() => shell.navigate({ type: 'account' })} className="m-btn-primary">Entrar e baixar da nuvem</button>
          <button onClick={shell.importFiles} className="m-btn-ghost">Importar músicas do app Arquivos</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 px-4 mt-5">
          {shortcuts.map(s => (
            <button key={`${s.type}-${s.id || s.name}`} onClick={() => openCtx(s)}
              className="h-14 flex items-center gap-2.5 rounded bg-white/10 overflow-hidden text-left active:bg-white/20">
              <ContextArt ctx={s} playlists={playlists} library={library} size={56} />
              <span className="text-[13px] font-bold text-white leading-tight line-clamp-2 pr-2">{s.name}</span>
            </button>
          ))}
        </div>
      )}

      {validRecent.length > 0 && (
        <Carousel title="Tocadas recentemente">
          {validRecent.map(r => (
            <button key={`${r.type}-${r.id || r.name}`} onClick={() => openCtx(r)} className="w-[120px] shrink-0 text-left snap-start">
              <ContextArt ctx={r} playlists={playlists} library={library} size={120} />
              <p className="text-[13px] text-white mt-2 line-clamp-2 leading-snug">{r.name}</p>
            </button>
          ))}
        </Carousel>
      )}

      {playlists.length > 0 && (
        <Carousel title="Suas playlists">
          {playlists.map(p => (
            <button key={p.id} onClick={() => shell.navigate({ type: 'playlist', id: p.id })} className="w-[150px] shrink-0 text-left snap-start">
              <PlaylistArt playlist={p} size={150} />
              <p className="text-[13px] text-white font-semibold mt-2 truncate">{p.name}</p>
              <p className="text-[12px] text-white/50">{p.trackCount} música{p.trackCount !== 1 ? 's' : ''}</p>
            </button>
          ))}
        </Carousel>
      )}

      {recentlyAdded.length > 0 && (
        <Carousel title="Adicionadas recentemente">
          {recentlyAdded.map(t => (
            <button key={t.id} className="w-[130px] shrink-0 text-left snap-start"
              onClick={() => { player.setGroupsEnabled(false); player.playTrack(t, recentlyAdded); setPlayContext({ type: 'all', name: 'Todas as músicas' }) }}>
              <Cover track={t} size={130} big rounded="rounded" />
              <p className="text-[13px] text-white mt-2 truncate">{t.title}</p>
              <p className="text-[12px] text-white/50 truncate">{t.artist}</p>
            </button>
          ))}
        </Carousel>
      )}
      <div style={{ height: 'calc(env(safe-area-inset-bottom) + 160px)' }} />
    </div>
  )
}

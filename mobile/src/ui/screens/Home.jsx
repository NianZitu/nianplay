// Início — Spotify's home structure (greeting, 2×3 shortcuts, horizontal shelves) with the desktop
// blocks: sticky page header with counts, shortcut blocks, labelled sections and gallery cards.
import React, { useMemo } from 'react'
import { Heart, Download, LogIn } from 'lucide-react'
import { usePlayer } from '../../../../src/renderer/store/PlayerContext'
import { useLibrary, Cover, VUBars, PageHeader, SectionTitle, Logo, isPlayable } from '../common'
import { PlaylistArt } from '../tracks'
import { usePlaylists, greeting } from '../hooks'
import { usePlayContext, setPlayContext } from '../playContext'
import { useShell } from '../shell'
import { Avatar } from './Account'

export function AllSongsArt({ size, rounded = 'rounded-xl' }) {
  return (
    <div className={`${rounded} flex items-center justify-center shrink-0 border border-white/[0.06]`}
      style={{ width: size, height: size, background: 'linear-gradient(135deg, #d97706, #451a03)' }}>
      <Heart size={typeof size === 'number' ? Math.round(size * 0.36) : 52} className="text-white/90" fill="currentColor" />
    </div>
  )
}

function ContextArt({ ctx, playlists, library, size, rounded = 'rounded-xl' }) {
  if (ctx.type === 'all') return <AllSongsArt size={size} rounded={rounded} />
  if (ctx.type === 'playlist') return <PlaylistArt playlist={playlists.find(p => p.id === ctx.id) || { name: ctx.name }} size={size} rounded={rounded} />
  const t = library.find(x => (x.artist || '').toLowerCase() === (ctx.name || '').toLowerCase() && x.cover_path) ||
    library.find(x => (x.artist || '').toLowerCase() === (ctx.name || '').toLowerCase())
  return <Cover track={t} size={size} rounded="rounded-full" />
}

function Shelf({ label, title, children }) {
  return (
    <section className="mt-7">
      <SectionTitle label={label} title={title} />
      <div className="mt-3 flex gap-2 overflow-x-auto px-3 scroll-px-3 pb-1 no-scrollbar snap-x">{children}</div>
    </section>
  )
}

// Gallery card (desktop PlaylistCard): padded block, square cover with shadow, name + meta
export function Card({ width, art, title, meta, onClick, round = false }) {
  return (
    <button onClick={onClick} style={{ width }}
      className="shrink-0 snap-start text-left p-2 rounded-xl bg-white/[0.025] border border-white/[0.05] active:bg-white/[0.06] transition-colors">
      <div className="shadow-lg shadow-black/40" style={{ borderRadius: round ? 999 : 12 }}>{art}</div>
      <p className={`text-[13px] font-semibold text-white/90 truncate mt-2.5 ${round ? 'text-center' : ''}`}>{title}</p>
      {meta && <p className={`text-[11.5px] text-white/35 truncate mt-0.5 ${round ? 'text-center' : ''}`}>{meta}</p>}
    </button>
  )
}

export default function Home() {
  const shell = useShell()
  const player = usePlayer()
  const [library] = useLibrary()
  const [playlists] = usePlaylists()
  const { recent, current } = usePlayContext()

  const openCtx = ctx => shell.navigate(ctx.type === 'all' ? { type: 'all' } : ctx.type === 'playlist' ? { type: 'playlist', id: ctx.id } : { type: 'artist', name: ctx.name })
  const isCurrent = ctx => current && current.type === ctx.type && (current.id || current.name) === (ctx.id || ctx.name)

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

  const onPhone = useMemo(() => library.filter(isPlayable).length, [library])
  const recentlyAdded = useMemo(() => [...library].filter(isPlayable).sort((a, b) => (b.created_at || 0) - (a.created_at || 0)).slice(0, 12), [library])
  const validRecent = recent.filter(r => r.type !== 'playlist' || playlists.some(p => p.id === r.id))
  const empty = library.length === 0 && playlists.length === 0

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <PageHeader title={greeting()}
        subtitle={empty ? 'NianPlay para iPhone' : `${library.length.toLocaleString('pt-BR')} faixas · ${playlists.length} playlist${playlists.length !== 1 ? 's' : ''} · ${onPhone.toLocaleString('pt-BR')} no iPhone`}
        left={<Logo size={26} />}
        right={<button onClick={() => shell.navigate({ type: 'account' })} aria-label="Perfil e ajustes"><Avatar size={36} /></button>} />

      {empty ? (
        <div className="mx-3 mt-4 panel p-5 flex flex-col gap-3">
          <p className="m-label">Primeiros passos</p>
          <p className="text-lg font-bold text-white -mt-1">Bem-vindo ao NianPlay no iPhone</p>
          <p className="text-sm text-white/45 leading-relaxed">
            Entre na sua conta para trazer suas playlists da nuvem e depois coloque os arquivos de música no iPhone.
          </p>
          <button onClick={() => shell.navigate({ type: 'account' })} className="m-btn-primary mt-1"><LogIn size={17} /> Entrar e baixar da nuvem</button>
          <button onClick={shell.importFiles} className="m-btn-ghost"><Download size={17} /> Importar do app Arquivos</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 px-3 mt-4">
          {shortcuts.map(s => {
            const playing = isCurrent(s)
            return (
              <button key={`${s.type}-${s.id || s.name}`} onClick={() => openCtx(s)}
                className={`h-[58px] flex items-center gap-2.5 p-1.5 pr-2 text-left transition-colors ${playing ? 'm-row-active' : 'm-row active:bg-white/[0.07]'}`}>
                <ContextArt ctx={s} playlists={playlists} library={library} size={44} rounded="rounded-lg" />
                <span className={`flex-1 min-w-0 text-[13px] font-semibold leading-tight line-clamp-2 ${playing ? 'text-brand-300' : 'text-white/85'}`}>{s.name}</span>
                {playing && <VUBars playing={player.isPlaying} bars={3} height={11} />}
              </button>
            )
          })}
        </div>
      )}

      {validRecent.length > 0 && (
        <Shelf label="Histórico" title="Tocadas recentemente">
          {validRecent.map(r => (
            <Card key={`${r.type}-${r.id || r.name}`} width={136} onClick={() => openCtx(r)} round={r.type === 'artist'}
              art={<ContextArt ctx={r} playlists={playlists} library={library} size={120} />}
              title={r.name}
              meta={r.type === 'artist' ? 'Artista' : 'Playlist'} />
          ))}
        </Shelf>
      )}

      {playlists.length > 0 && (
        <Shelf label="Coleções" title="Suas playlists">
          {playlists.map(p => (
            <Card key={p.id} width={156} onClick={() => shell.navigate({ type: 'playlist', id: p.id })}
              art={<PlaylistArt playlist={p} size={140} />}
              title={p.name}
              meta={`${p.trackCount} faixa${p.trackCount !== 1 ? 's' : ''}`} />
          ))}
        </Shelf>
      )}

      {recentlyAdded.length > 0 && (
        <Shelf label="Biblioteca" title="Adicionadas recentemente">
          {recentlyAdded.map(t => (
            <Card key={t.id} width={136}
              onClick={() => { player.setGroupsEnabled(false); player.playTrack(t, recentlyAdded); setPlayContext({ type: 'all', name: 'Todas as músicas' }) }}
              art={<Cover track={t} size={120} big rounded="rounded-xl" />}
              title={t.title}
              meta={t.artist} />
          ))}
        </Shelf>
      )}
      <div style={{ height: 'calc(env(safe-area-inset-bottom) + 170px)' }} />
    </div>
  )
}

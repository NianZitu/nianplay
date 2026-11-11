import React, { useState } from 'react'
import { MoreHorizontal, ListPlus, ListEnd, User, Trash2, MinusCircle, Plus, Check } from 'lucide-react'
import { usePlayer } from '../../../src/renderer/store/PlayerContext'
import { Cover, Sheet, formatTime, isPlayable } from './common'
import { useLongPress, usePlaylists } from './hooks'
import { useShell } from './shell'

export const ROW_HEIGHT = 64

function PlayingBars() {
  return (
    <span className="inline-flex items-end gap-[2px] h-3 mr-1.5 shrink-0">
      {[420, 300, 520].map((d, i) => (
        <span key={i} className="w-[3px] h-3 bg-brand-400 rounded-full"
          style={{ transformOrigin: 'bottom', animation: `vuPulse ${d}ms ease-in-out infinite alternate`, animationDelay: `${i * 90}ms` }} />
      ))}
    </span>
  )
}

// One song in a list (Spotify layout: cover, title, artist, ⋯). Long press = menu.
export function TrackRow({ track, onPlay, onMenu, showCover = true, groupColor = null, index = null }) {
  const { currentTrack, isPlaying } = usePlayer()
  const active = currentTrack?.id === track.id
  const playable = isPlayable(track)
  const press = useLongPress(() => onMenu(track))
  return (
    <div style={{ height: ROW_HEIGHT }} className="relative">
      {groupColor && <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full" style={{ backgroundColor: groupColor }} />}
      <div {...press}
        onClick={() => { if (!press.wasLongPress()) onPlay(track) }}
        className={`h-full flex items-center gap-3 pl-4 pr-1 active:bg-white/5 ${playable ? '' : 'opacity-45'}`}>
        {index !== null && !showCover && (
          <span className="w-5 text-center text-sm text-white/40 tabular-nums shrink-0">{index + 1}</span>
        )}
        {showCover && <Cover track={track} size={48} rounded="rounded" />}
        <div className="flex-1 min-w-0">
          <p className={`text-[15px] leading-tight truncate flex items-center ${active ? 'text-brand-400' : 'text-white'}`}>
            {active && isPlaying && <PlayingBars />}
            <span className="truncate">{track.title}</span>
          </p>
          <p className="text-[13px] text-white/50 truncate mt-1">
            {playable ? track.artist : `${track.artist} · não está neste iPhone`}
          </p>
        </div>
        <button onClick={e => { e.stopPropagation(); onMenu(track) }} aria-label="Mais opções"
          className="p-3 text-white/50 active:text-white shrink-0">
          <MoreHorizontal size={20} />
        </button>
      </div>
    </div>
  )
}

// Spotify-style track menu. `context`: { playlistId } to offer "Remover desta playlist".
export function TrackMenu({ track, context = {}, onClose, onChanged }) {
  const { playNext } = usePlayer()
  const shell = useShell()
  const [adding, setAdding] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const playable = isPlayable(track)

  if (adding) return <AddToPlaylistSheet track={track} onClose={onClose} />

  if (confirmRemove) {
    return (
      <Sheet onClose={onClose}>
        <div className="px-5 pt-2 pb-4 flex flex-col gap-3">
          <p className="text-base font-bold text-white">Remover da biblioteca?</p>
          <p className="text-sm text-white/55 leading-relaxed">
            "{track.title}" sai da biblioteca e das playlists deste iPhone. A nuvem não é alterada.
          </p>
          <button className="m-btn-danger" onClick={async () => {
            await window.electron.library.removeTrack(track.id)
            onClose(); onChanged?.(); shell.toast('Removida da biblioteca')
          }}>Remover</button>
          <button className="m-btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </Sheet>
    )
  }

  const actions = [
    { label: 'Adicionar à playlist', icon: ListPlus, onPress: () => setAdding(true), keep: true },
    playable && { label: 'Tocar a seguir', icon: ListEnd, onPress: () => { playNext(track); shell.toast('Vai tocar a seguir') } },
    track.artist && { label: 'Ver artista', icon: User, onPress: () => shell.navigate({ type: 'artist', name: track.artist }) },
    context.playlistId && { label: 'Remover desta playlist', icon: MinusCircle, onPress: async () => {
      await window.electron.playlists.removeTrack(context.playlistId, track.id)
      onChanged?.(); shell.toast('Removida da playlist')
    } },
    { label: 'Remover da biblioteca', icon: Trash2, destructive: true, onPress: () => setConfirmRemove(true), keep: true },
  ].filter(Boolean)

  return (
    <Sheet onClose={onClose}>
      <div className="flex items-center gap-3 px-5 pt-1 pb-4 border-b border-white/8">
        <Cover track={track} size={52} rounded="rounded" />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-white truncate">{track.title}</p>
          <p className="text-[13px] text-white/50 truncate">{track.artist}{track.duration ? ` · ${formatTime(track.duration)}` : ''}</p>
        </div>
      </div>
      <div className="py-2">
        {actions.map(a => (
          <button key={a.label} onClick={() => { if (!a.keep) onClose(); a.onPress() }}
            className={`w-full flex items-center gap-4 px-5 py-3.5 text-[15px] text-left active:bg-white/5
              ${a.destructive ? 'text-red-400' : 'text-white/90'}`}>
            <a.icon size={22} className={a.destructive ? 'text-red-400' : 'text-white/60'} strokeWidth={1.75} />
            {a.label}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

export function AddToPlaylistSheet({ track, onClose }) {
  const shell = useShell()
  const [playlists, reload] = usePlaylists()
  const [added, setAdded] = useState(new Set())
  return (
    <Sheet title="Adicionar à playlist" onClose={onClose} tall>
      <div className="px-4 pb-4">
        <button onClick={() => shell.prompt({
            title: 'Dê um nome à sua playlist', confirmLabel: 'Criar',
            onSubmit: async name => {
              const pl = await window.electron.playlists.create({ name })
              if (pl?.error) return pl.error
              await window.electron.playlists.addTrack(pl.id, track.id)
              reload(); shell.toast(`Adicionada a ${pl.name}`)
            },
          })}
          className="mx-auto my-3 flex items-center gap-2 rounded-full bg-white text-surface-900 font-bold text-sm px-6 py-3 active:scale-95 transition-transform">
          <Plus size={18} /> Nova playlist
        </button>
        {playlists.map(pl => (
          <button key={pl.id}
            onClick={async () => {
              const ok = await window.electron.playlists.addTrack(pl.id, track.id)
              setAdded(prev => new Set(prev).add(pl.id))
              shell.toast(ok ? `Adicionada a ${pl.name}` : `Já está em ${pl.name}`)
            }}
            className="w-full flex items-center gap-3 py-2 text-left active:bg-white/5 rounded-lg">
            <PlaylistArt playlist={pl} size={52} />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] text-white truncate">{pl.name}</p>
              <p className="text-[13px] text-white/45">{pl.trackCount} música{pl.trackCount !== 1 ? 's' : ''}</p>
            </div>
            {added.has(pl.id) && <Check size={20} className="text-brand-400 mr-2" />}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

// Playlist cover: its own image (remote) or the NianPlay tile in the playlist's color
export function PlaylistArt({ playlist, size = 56, className = '' }) {
  const [failed, setFailed] = useState(false)
  const src = /^https?:\/\//.test(playlist?.cover_url || '') ? playlist.cover_url : null
  if (src && !failed) {
    return <img src={src} alt="" onError={() => setFailed(true)} className={`rounded object-cover shrink-0 ${className}`} style={{ width: size, height: size }} />
  }
  return <PlaylistTile name={playlist?.name} size={size} className={className} />
}

export function PlaylistTile({ name = '', size = 56, className = '' }) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  const hue = h % 360
  return (
    <div className={`rounded shrink-0 flex items-end p-1.5 overflow-hidden ${className}`}
      style={{ width: size, height: size, background: `linear-gradient(135deg, hsl(${hue} 55% 42%), hsl(${(hue + 40) % 360} 50% 22%))` }}>
      {size >= 96 && <span className="text-white/90 font-black leading-none text-lg line-clamp-2">{name}</span>}
    </div>
  )
}

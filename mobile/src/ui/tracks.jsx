import React, { useRef, useState } from 'react'
import { MoreHorizontal, ListPlus, ListEnd, ListStart, User, Trash2, MinusCircle, Plus, Check, Tag, ArrowUp, ArrowDown } from 'lucide-react'
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

const SWIPE_QUEUE = 80   // px to the right that adds the song to the queue

// One song in a list (Spotify layout: cover, title, artist, ⋯).
// Long press = menu. Swipe right = "Adicionar à fila" (Spotify).
export function TrackRow({ track, onPlay, onMenu, showCover = true, groupColor = null, index = null }) {
  const { currentTrack, isPlaying } = usePlayer()
  const shell = useShell()
  const active = currentTrack?.id === track.id
  const playable = isPlayable(track)
  const press = useLongPress(() => onMenu(track))
  const [dx, setDx] = useState(0)
  const gesture = useRef(null)     // { x, y, mode: null | 'swipe' | 'scroll' }
  const swiped = useRef(false)

  const touch = {
    onTouchStart: e => {
      press.onTouchStart(e)
      gesture.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, mode: null }
    },
    onTouchMove: e => {
      press.onTouchMove(e)
      const g = gesture.current
      if (!g) return
      const mx = e.touches[0].clientX - g.x, my = e.touches[0].clientY - g.y
      if (!g.mode && (Math.abs(mx) > 10 || Math.abs(my) > 10)) g.mode = (mx > 0 && Math.abs(mx) > Math.abs(my) * 1.3) ? 'swipe' : 'scroll'
      if (g.mode === 'swipe') {
        const next = Math.max(0, Math.min(mx, 140))
        if (next >= SWIPE_QUEUE && dx < SWIPE_QUEUE) navigator.vibrate?.(8)
        setDx(next)
      }
    },
    onTouchEnd: e => {
      press.onTouchEnd(e)
      if (gesture.current?.mode === 'swipe') {
        swiped.current = true
        if (dx >= SWIPE_QUEUE) shell.addToQueue(track)
      }
      gesture.current = null
      setDx(0)
    },
    onTouchCancel: e => { press.onTouchCancel(e); gesture.current = null; setDx(0) },
  }

  return (
    <div style={{ height: ROW_HEIGHT }} className="relative overflow-hidden">
      {/* Revealed while swiping right */}
      <div className="absolute inset-y-0 left-0 flex items-center pl-5 bg-brand-600" style={{ width: dx, opacity: dx ? 1 : 0 }}>
        <ListEnd size={24} className={`text-surface-900 transition-transform ${dx >= SWIPE_QUEUE ? 'scale-125' : ''}`} />
      </div>
      {groupColor && <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full z-[1]" style={{ backgroundColor: groupColor }} />}
      <div onContextMenu={press.onContextMenu} {...touch}
        onClick={() => {
          if (swiped.current) { swiped.current = false; return }
          if (!press.wasLongPress()) onPlay(track)
        }}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform 180ms ease-out', touchAction: 'pan-y' }}
        className={`relative h-full flex items-center gap-3 pl-4 pr-1 bg-surface-900 active:bg-surface-800 ${playable ? '' : 'opacity-45'}`}>
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

// Pick the "grupo de sequência" of a track in a playlist (or create one, or remove from group)
function GroupPickerSheet({ track, context, onClose, onChanged }) {
  const shell = useShell()
  const groups = context.groups || []
  async function setGroup(groupId) {
    await window.electron.playlists.setTrackGroup(context.playlistId, track.id, groupId)
    onChanged?.(); onClose()
    const g = groups.find(x => x.id === groupId)
    shell.toast(g ? `Adicionada ao grupo ${g.name}` : 'Removida do grupo')
  }
  return (
    <Sheet title="Grupo de sequência" onClose={onClose}>
      <p className="px-5 pb-2 text-[13px] text-white/50 leading-relaxed">
        Músicas do mesmo grupo tocam juntas e em ordem, mesmo no aleatório.
      </p>
      <div className="pb-2">
        {groups.map(g => (
          <button key={g.id} onClick={() => setGroup(g.id)} className="w-full flex items-center gap-3 px-5 py-3 text-left active:bg-white/5">
            <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
            <span className="flex-1 text-[15px] text-white truncate">{g.name}</span>
            {track.group_id === g.id && <Check size={20} className="text-brand-400" />}
          </button>
        ))}
        <button onClick={() => shell.prompt({
            title: 'Nome do novo grupo', confirmLabel: 'Criar',
            onSubmit: async name => {
              const g = await window.electron.playlists.createGroup(context.playlistId, name)
              await window.electron.playlists.setTrackGroup(context.playlistId, track.id, g.id)
              onChanged?.(); onClose(); shell.toast(`Adicionada ao grupo ${g.name}`)
            },
          })}
          className="w-full flex items-center gap-3 px-5 py-3 text-left text-[15px] text-white/90 active:bg-white/5">
          <Plus size={20} className="text-white/60" /> Novo grupo
        </button>
        {track.group_id && (
          <button onClick={() => setGroup(null)} className="w-full flex items-center gap-3 px-5 py-3 text-left text-[15px] text-red-400 active:bg-white/5">
            <MinusCircle size={20} /> Remover do grupo
          </button>
        )}
      </div>
    </Sheet>
  )
}

// Spotify-style track menu. `context`: { playlistId, groups, playlistTracks } inside a playlist.
export function TrackMenu({ track, context = {}, onClose, onChanged }) {
  const { playNext } = usePlayer()
  const shell = useShell()
  const [adding, setAdding] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [choosingGroup, setChoosingGroup] = useState(false)
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

  if (choosingGroup) {
    return <GroupPickerSheet track={track} context={context} onClose={onClose} onChanged={onChanged} />
  }

  // Grupos de sequência (only inside a playlist)
  const groups = context.groups || []
  const group = track.group_id ? groups.find(g => g.id === track.group_id) : null
  const groupTracks = group
    ? (context.playlistTracks || []).filter(t => t.group_id === group.id).sort((a, b) => (a.group_position ?? 0) - (b.group_position ?? 0))
    : []
  const posInGroup = groupTracks.findIndex(t => t.id === track.id)
  async function moveInGroup(delta) {
    const ids = groupTracks.map(t => t.id)
    const to = posInGroup + delta
    ;[ids[posInGroup], ids[to]] = [ids[to], ids[posInGroup]]
    await window.electron.playlists.reorderGroup(context.playlistId, group.id, ids)
    onChanged?.()
  }

  const actions = [
    { label: 'Adicionar à playlist', icon: ListPlus, onPress: () => setAdding(true), keep: true },
    playable && { label: 'Adicionar à fila', icon: ListEnd, onPress: () => shell.addToQueue(track) },
    playable && { label: 'Tocar a seguir', icon: ListStart, onPress: () => { playNext(track); shell.toast('Vai tocar a seguir') } },
    context.playlistId && { label: group ? `Grupo: ${group.name}` : 'Adicionar a um grupo', icon: Tag, onPress: () => setChoosingGroup(true), keep: true },
    group && posInGroup > 0 && { label: 'Subir no grupo', icon: ArrowUp, onPress: () => moveInGroup(-1) },
    group && posInGroup >= 0 && posInGroup < groupTracks.length - 1 && { label: 'Descer no grupo', icon: ArrowDown, onPress: () => moveInGroup(1) },
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

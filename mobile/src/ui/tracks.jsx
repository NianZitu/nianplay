import React, { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, ListPlus, ListEnd, ListStart, User, Trash2, MinusCircle, Plus, Check, Tag, ArrowUp, ArrowDown, ListMusic } from 'lucide-react'
import { usePlayer } from '../../../src/renderer/store/PlayerContext'
import { Cover, Sheet, MenuList, VUBars, formatTime, isPlayable, trackArt } from './common'
import { useLongPress, usePlaylists } from './hooks'
import { useShell } from './shell'

export const ROW_HEIGHT = 64

const SWIPE_QUEUE = 80   // px to the right that adds the song to the queue

// One song in a list — a block like the desktop's playlist rows (optional number, cover, title,
// artist, ⋯; the playing song in amber). Long press = menu. Swipe right = "Adicionar à fila" (Spotify).
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
    <div style={{ height: ROW_HEIGHT }} className="relative px-2 py-[2px]">
      {/* Revealed while swiping right */}
      <div className="absolute inset-y-[2px] left-2 rounded-xl flex items-center pl-4 bg-brand-600"
        style={{ width: Math.max(0, dx + 12), opacity: dx ? 1 : 0 }}>
        <ListEnd size={22} className={`text-white transition-transform ${dx >= SWIPE_QUEUE ? 'scale-125' : ''}`} />
      </div>
      <div onContextMenu={press.onContextMenu} {...touch}
        onClick={() => {
          if (swiped.current) { swiped.current = false; return }
          if (!press.wasLongPress()) onPlay(track)
        }}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform 180ms ease-out', touchAction: 'pan-y' }}
        className={`relative h-full flex items-center gap-3 pl-2.5 pr-0.5 overflow-hidden
          rounded-xl border ${active ? 'bg-[#352108] border-brand-400/20 shadow-sm shadow-black/15' : 'bg-[#121110] border-white/[0.05] active:bg-[#1c1a17]'} ${playable ? '' : 'opacity-45'}`}>
        {groupColor && <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full" style={{ backgroundColor: groupColor }} />}
        {index !== null && (
          <span className={`w-6 -mr-1 text-center text-xs tabular-nums shrink-0 ${active ? 'text-brand-400' : 'text-white/25'}`}>{index + 1}</span>
        )}
        {showCover && (
          <div className="relative shrink-0">
            <Cover track={track} size={44} rounded="rounded-lg" />
            {active && (
              <span className="absolute inset-0 rounded-lg bg-black/45 flex items-center justify-center">
                <VUBars playing={isPlaying} bars={3} height={11} />
              </span>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-[15px] font-medium leading-tight truncate ${active ? 'text-brand-300' : 'text-white/90'}`}>{track.title}</p>
          <p className="text-[12.5px] text-white/40 truncate mt-1">
            {track.artist}
            {!playable && <span className="text-amber-400/70"> · não está neste iPhone</span>}
          </p>
        </div>
        <button onClick={e => { e.stopPropagation(); onMenu(track) }} aria-label="Mais opções"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white/30 active:text-white active:bg-white/8 shrink-0">
          <MoreHorizontal size={19} />
        </button>
      </div>
    </div>
  )
}

// Track header used at the top of the track sheets
function TrackHeader({ track }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-2 pb-3.5 border-b border-white/6">
      <Cover track={track} size={50} rounded="rounded-lg" className="shadow-lg shadow-black/40" />
      <div className="min-w-0">
        <p className="m-label mb-0.5">Faixa</p>
        <p className="text-[15px] font-bold text-white truncate">{track.title}</p>
        <p className="text-[12.5px] text-white/40 truncate">{track.artist}{track.duration ? ` · ${formatTime(track.duration)}` : ''}</p>
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
      <p className="px-5 pt-3 pb-1 text-[13px] text-white/40 leading-relaxed">
        Músicas do mesmo grupo tocam juntas e em ordem, mesmo no aleatório.
      </p>
      <div className="px-3 py-2 flex flex-col gap-1">
        {groups.map(g => (
          <button key={g.id} onClick={() => setGroup(g.id)}
            className={`flex items-center gap-3 px-3 py-3 rounded-xl text-left active:bg-white/5 ${track.group_id === g.id ? 'm-row-active' : 'm-row'}`}>
            <Tag size={16} style={{ color: g.color }} className="shrink-0" />
            <span className="flex-1 text-[15px] font-medium truncate" style={{ color: g.color }}>{g.name}</span>
            {track.group_id === g.id && <Check size={18} className="text-brand-400" />}
          </button>
        ))}
      </div>
      <MenuList onClose={() => {}} actions={[
        { label: 'Novo grupo', icon: Plus, keep: true, onPress: () => shell.prompt({
          title: 'Novo grupo', label: 'Nome do grupo', confirmLabel: 'Criar',
          onSubmit: async name => {
            const g = await window.electron.playlists.createGroup(context.playlistId, name)
            await window.electron.playlists.setTrackGroup(context.playlistId, track.id, g.id)
            onChanged?.(); onClose(); shell.toast(`Adicionada ao grupo ${g.name}`)
          },
        }) },
        track.group_id && { label: 'Remover do grupo', icon: MinusCircle, destructive: true, keep: true, onPress: () => setGroup(null) },
      ]} />
    </Sheet>
  )
}

// Track menu (Spotify's actions, desktop menu look). `context`: { playlistId, groups, playlistTracks } inside a playlist.
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
      <Sheet title="Remover da biblioteca" onClose={onClose}>
        <div className="px-5 pt-4 pb-4 flex flex-col gap-3">
          <p className="text-sm text-white/55 leading-relaxed">
            "{track.title}" sai da biblioteca e das playlists deste iPhone. A nuvem não é alterada.
          </p>
          <div className="flex gap-2 pt-1">
            <button className="m-btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="m-btn-danger" onClick={async () => {
              await window.electron.library.removeTrack(track.id)
              onClose(); onChanged?.(); shell.toast('Removida da biblioteca')
            }}><Trash2 size={16} /> Remover</button>
          </div>
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

  return (
    <Sheet onClose={onClose}>
      <TrackHeader track={track} />
      <MenuList onClose={onClose} actions={[
        playable && { label: 'Adicionar à fila', icon: ListEnd, onPress: () => shell.addToQueue(track) },
        playable && { label: 'Tocar a seguir', icon: ListStart, onPress: () => { playNext(track); shell.toast('Vai tocar a seguir') } },
        { label: 'Adicionar à playlist', icon: ListPlus, onPress: () => setAdding(true), keep: true },
        context.playlistId && { label: group ? `Grupo: ${group.name}` : 'Adicionar a um grupo', icon: Tag, onPress: () => setChoosingGroup(true), keep: true },
        group && posInGroup > 0 && { label: 'Subir no grupo', icon: ArrowUp, onPress: () => moveInGroup(-1) },
        group && posInGroup >= 0 && posInGroup < groupTracks.length - 1 && { label: 'Descer no grupo', icon: ArrowDown, onPress: () => moveInGroup(1) },
        track.artist && { label: 'Ver artista', icon: User, onPress: () => shell.navigate({ type: 'artist', name: track.artist }) },
        context.playlistId && { label: 'Remover desta playlist', icon: MinusCircle, destructive: true, onPress: async () => {
          await window.electron.playlists.removeTrack(context.playlistId, track.id)
          onChanged?.(); shell.toast('Removida da playlist')
        } },
        { label: 'Remover da biblioteca', icon: Trash2, destructive: true, onPress: () => setConfirmRemove(true), keep: true },
      ]} />
    </Sheet>
  )
}

export function AddToPlaylistSheet({ track, onClose }) {
  const shell = useShell()
  const [playlists, reload] = usePlaylists()
  const [added, setAdded] = useState(new Set())
  return (
    <Sheet title="Adicionar à playlist" onClose={onClose} tall>
      <div className="px-3 pt-3 pb-4 flex flex-col gap-1">
        <button onClick={() => shell.prompt({
            title: 'Nova playlist', label: 'Nome da playlist', confirmLabel: 'Criar',
            onSubmit: async name => {
              const pl = await window.electron.playlists.create({ name })
              if (pl?.error) return pl.error
              await window.electron.playlists.addTrack(pl.id, track.id)
              reload(); shell.toast(`Adicionada a ${pl.name}`)
            },
          })}
          className="m-chip-primary self-start ml-2 mb-2">
          <Plus size={16} /> Nova playlist
        </button>
        {playlists.map(pl => (
          <button key={pl.id}
            onClick={async () => {
              const ok = await window.electron.playlists.addTrack(pl.id, track.id)
              setAdded(prev => new Set(prev).add(pl.id))
              shell.toast(ok ? `Adicionada a ${pl.name}` : `Já está em ${pl.name}`)
            }}
            className={`flex items-center gap-3 px-2 py-2 text-left active:bg-white/5 ${added.has(pl.id) ? 'm-row-active' : 'm-row'}`}>
            <PlaylistArt playlist={pl} size={48} />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium text-white/90 truncate">{pl.name}</p>
              <p className="text-[12px] text-white/35">{pl.trackCount} faixa{pl.trackCount !== 1 ? 's' : ''}</p>
            </div>
            {added.has(pl.id) && <Check size={19} className="text-brand-400 mr-2" />}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

// Covers of the first songs of a playlist (for the mosaic), cached per playlist; the cache is
// dropped whenever the library changes (imports, cloud download, edits)
const mosaicCache = new Map()
let mosaicVersion = 0
window.electron?.library?.onChanged?.(() => { mosaicVersion++; mosaicCache.clear() })

function usePlaylistCovers(playlist, enabled) {
  const id = playlist?.id
  const key = `${mosaicVersion}:${playlist?.trackCount ?? ''}:${playlist?.updated_at ?? ''}`
  const cached = mosaicCache.get(id)
  const [covers, setCovers] = useState(cached?.key === key ? cached.srcs : null)
  useEffect(() => {
    if (!enabled || !id) return
    const hit = mosaicCache.get(id)
    if (hit?.key === key) { setCovers(hit.srcs); return }
    let alive = true
    window.electron.playlists.getTracks(id).then(tracks => {
      const srcs = []
      for (const t of tracks || []) {
        const src = trackArt(t)
        if (src && !srcs.includes(src)) srcs.push(src)
        if (srcs.length === 4) break
      }
      mosaicCache.set(id, { key, srcs })
      if (alive) setCovers(srcs)
    }).catch(() => {})
    return () => { alive = false }
  }, [id, key, enabled])
  return covers
}

// Playlist cover: its own image (remote), else a 2×2 mosaic of its songs' covers (Spotify), else
// the first cover, else the desktop's fallback (warm surface + list icon)
export function PlaylistArt({ playlist, size = 56, className = '', rounded = 'rounded-xl' }) {
  const [failed, setFailed] = useState(false)
  const src = /^https?:\/\//.test(playlist?.cover_url || '') ? playlist.cover_url : null
  const covers = usePlaylistCovers(playlist, !src || failed)
  const box = { width: size, height: size }
  if (src && !failed) {
    return <img src={src} alt="" onError={() => setFailed(true)} className={`${rounded} object-cover shrink-0 bg-surface-700 ${className}`} style={box} />
  }
  if (covers?.length >= 4) {
    return (
      <div className={`${rounded} shrink-0 grid grid-cols-2 grid-rows-2 overflow-hidden bg-surface-700 ${className}`} style={box}>
        {covers.map(c => <img key={c} src={c} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />)}
      </div>
    )
  }
  if (covers?.length) {
    return <img src={covers[0]} alt="" loading="lazy" decoding="async" className={`${rounded} object-cover shrink-0 bg-surface-700 ${className}`} style={box} />
  }
  return <PlaylistTile name={playlist?.name} size={size} className={className} rounded={rounded} />
}

export function PlaylistTile({ name = '', size = 56, className = '', rounded = 'rounded-xl' }) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  const hue = h % 360
  return (
    <div className={`${rounded} shrink-0 flex items-center justify-center overflow-hidden border border-white/[0.06] ${className}`}
      style={{ width: size, height: size, background: `radial-gradient(circle at 30% 20%, hsl(${hue} 30% 22%), #1c1916 70%)` }}>
      <ListMusic size={typeof size === 'number' ? Math.round(size * 0.34) : 52} strokeWidth={typeof size !== 'number' || size >= 96 ? 0.8 : 1.2} className="text-white/20" />
    </div>
  )
}

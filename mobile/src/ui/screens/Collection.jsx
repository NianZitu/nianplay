// Spotify-style collection page: a playlist, "Todas as músicas" or an artist.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Play, Pause, Shuffle, MoreHorizontal, PlusCircle, Search, X, Heart, Download, FolderSearch, Eye, EyeOff, HelpCircle, Pencil, Trash2, Plus, Check, Folder, FolderOpen, ChevronDown, Layers, Tag } from 'lucide-react'
import { usePlayer } from '../../../../src/renderer/store/PlayerContext'
import VirtualRows from '../../../../src/renderer/components/VirtualRows'
import { useLibrary, isPlayable, formatTime, Sheet, Cover } from '../common'
import { TrackRow, TrackMenu, PlaylistArt, ROW_HEIGHT } from '../tracks'
import { useDominantColor, usePlaylists } from '../hooks'
import { buildGroupedQueue, shuffleArray } from '../queue'
import { setPlayContext, usePlayContext, forgetContext } from '../playContext'
import { useShell } from '../shell'
import { notifyLibraryChanged } from '../../platform/api'

const totalDuration = tracks => {
  const s = tracks.reduce((sum, t) => sum + (t.duration || 0), 0)
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60)
  return h ? `${h} h ${m} min` : `${m} min`
}

export default function Collection({ page }) {
  const shell = useShell()
  const player = usePlayer()
  const { current } = usePlayContext()
  const [library, reloadLibrary] = useLibrary()
  const [playlists] = usePlaylists()
  const [plTracks, setPlTracks] = useState([])
  const [groups, setGroups] = useState([])
  const [query, setQuery] = useState('')
  const [menuTrack, setMenuTrack] = useState(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [shuffleMode, setShuffleMode] = useState(player.shuffle)
  const [scrollTop, setScrollTop] = useState(0)
  const scrollRef = useRef(null)

  const playlist = page.type === 'playlist' ? playlists.find(p => p.id === page.id) : null
  const showMissing = page.type !== 'all' || shell.showMissing

  async function reloadPlaylist() {
    if (page.type !== 'playlist') return
    const [t, g] = await Promise.all([window.electron.playlists.getTracks(page.id), window.electron.playlists.getGroups(page.id)])
    setPlTracks(t || []); setGroups(g || [])
  }
  useEffect(() => { reloadPlaylist() }, [page.id, library])

  const baseTracks = useMemo(() => {
    if (page.type === 'playlist') return plTracks
    if (page.type === 'artist') return library.filter(t => (t.artist || '').toLowerCase() === page.name.toLowerCase())
    return library
  }, [page, plTracks, library])

  const groupsOn = Boolean(playlist?.groups_enabled && groups.length)
  const groupColor = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g.color])), [groups])

  // Play order of the whole collection (groups kept together, like the desktop)
  const ordered = useMemo(() => groupsOn ? buildGroupedQueue(baseTracks, groups, false) : baseTracks, [baseTracks, groups, groupsOn])
  const playableQueue = useMemo(() => ordered.filter(isPlayable), [ordered])

  const visible = useMemo(() => {
    let list = showMissing ? ordered : ordered.filter(isPlayable)
    const q = query.trim().toLowerCase()
    if (q) list = list.filter(t => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q))
    return list
  }, [ordered, showMissing, query])

  // Groups view (folders closed by default, like the desktop)
  const [openGroups, setOpenGroups] = useState(() => new Set())
  const toggleGroup = id => setOpenGroups(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const rows = useMemo(() => {
    if (!groupsOn || query.trim()) return visible.map(t => ({ kind: 'track', key: t.id, track: t }))
    const pool = showMissing ? baseTracks : baseTracks.filter(isPlayable)
    const byGroup = new Map(groups.map(g => [g.id, []]))
    const loose = []
    for (const t of pool) (t.group_id && byGroup.has(t.group_id) ? byGroup.get(t.group_id) : loose).push(t)
    const out = []
    for (const g of groups) {
      const list = byGroup.get(g.id).sort((a, b) => (a.group_position ?? 0) - (b.group_position ?? 0))
      if (!list.length) continue
      out.push({ kind: 'group', key: `g-${g.id}`, group: g, tracks: list })
      if (openGroups.has(g.id)) list.forEach(t => out.push({ kind: 'track', key: t.id, track: t }))
    }
    if (loose.length) {
      if (out.length) out.push({ kind: 'label', key: 'loose', text: 'Faixas avulsas' })
      loose.forEach(t => out.push({ kind: 'track', key: t.id, track: t }))
    }
    return out
  }, [groupsOn, query, visible, showMissing, baseTracks, groups, openGroups])

  // Same as the desktop's handlePlayGroup: the whole playlist in group order, from this group's first song
  function playGroup(group) {
    const q = buildGroupedQueue(baseTracks, groups, false).filter(isPlayable)
    const first = q.find(t => t.group_id === group.id)
    if (!first) { shell.toast('Nenhuma música deste grupo está neste iPhone.', false); return }
    player.setGroupsEnabled(true)
    player.setShuffle(false)
    player.playTrack(first, q)
    setPlayContext(context)
  }

  const context = page.type === 'playlist'
    ? { type: 'playlist', id: page.id, name: playlist?.name || 'Playlist' }
    : page.type === 'artist' ? { type: 'artist', name: page.name } : { type: 'all', name: 'Todas as músicas' }
  const contextActive = current && current.type === context.type && (current.id || current.name) === (context.id || context.name)
    && playableQueue.some(t => t.id === player.currentTrack?.id)

  function start(track = null) {
    if (!playableQueue.length) {
      shell.toast('Nenhuma música desta lista está neste iPhone. Importe os arquivos em Todas as músicas.', false, 4500)
      return
    }
    player.setGroupsEnabled(groupsOn)
    if (groupsOn) {
      const q = buildGroupedQueue(baseTracks, groups, shuffleMode && !track).filter(isPlayable)
      player.setShuffle(false)
      player.playTrack(track || q[0], q)
    } else {
      player.setShuffle(shuffleMode)
      const first = track || (shuffleMode ? playableQueue[Math.floor(Math.random() * playableQueue.length)] : playableQueue[0])
      player.playTrack(first, playableQueue)
    }
    setPlayContext(context)
  }

  function onPlayRow(track) {
    if (!isPlayable(track)) {
      shell.toast('Esta música não está neste iPhone. Importe o arquivo em Sua Biblioteca → Todas as músicas.', false, 4500)
      return
    }
    start(track)
  }

  function onBigPlay() {
    if (contextActive) player.togglePlay()
    else start()
  }

  function toggleShuffle() {
    const next = !shuffleMode
    setShuffleMode(next)
    if (contextActive && !groupsOn) player.setShuffle(next)
    shell.toast(next ? 'Modo aleatório ativado' : 'Modo aleatório desativado')
  }

  // ── header look ──
  const coverTrack = baseTracks.find(t => t.cover_path) || baseTracks[0]
  const title = page.type === 'playlist' ? (playlist?.name || '') : page.type === 'artist' ? page.name : 'Todas as músicas'
  const color = useDominantColor(page.type === 'all' ? null : headerArtSrc(page, playlist, coverTrack), page.type === 'all' ? '' : title)
  const headerColor = page.type === 'all' ? 'rgb(120 72 8)' : color
  const barOpacity = Math.min(1, Math.max(0, (scrollTop - 220) / 60))

  const onIphone = baseTracks.filter(isPlayable).length
  const meta = page.type === 'artist'
    ? `${baseTracks.length} música${baseTracks.length !== 1 ? 's' : ''}`
    : `${baseTracks.length} música${baseTracks.length !== 1 ? 's' : ''}${baseTracks.length ? ` · ${totalDuration(baseTracks)}` : ''}`

  return (
    <div className="h-full relative">
      {/* Sticky top bar: appears as the hero scrolls away */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 px-2 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 6px)', backgroundColor: `color-mix(in srgb, ${headerColor} ${Math.round(barOpacity * 100)}%, transparent)` }}>
        <button onClick={shell.back} aria-label="Voltar"
          className="w-9 h-9 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
          style={{ backgroundColor: `rgba(0,0,0,${0.35 * (1 - barOpacity)})` }}>
          <ChevronLeft size={24} />
        </button>
        <p className="flex-1 text-base font-bold text-white truncate" style={{ opacity: barOpacity }}>{title}</p>
      </div>

      <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain" onScroll={e => setScrollTop(e.currentTarget.scrollTop)}>
        {/* Hero */}
        <div className="px-5 pb-4" style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 52px)',
          background: `linear-gradient(to bottom, ${headerColor} 0%, color-mix(in srgb, ${headerColor} 45%, #0c0b09) 55%, #0c0b09 100%)`,
        }}>
          {/* Find in list (Spotify's "Encontrar na playlist") */}
          {(page.type !== 'artist') && (
            <div className="flex items-center gap-2 mb-5">
              <div className="flex-1 flex items-center gap-2 rounded-md bg-white/15 px-2.5 h-9">
                <Search size={16} className="text-white/80 shrink-0" />
                <input value={query} onChange={e => setQuery(e.target.value)}
                  placeholder={page.type === 'playlist' ? 'Encontrar na playlist' : 'Encontrar nas músicas'}
                  className="flex-1 bg-transparent text-[15px] text-white placeholder-white/70 outline-none min-w-0" />
                {query && <button onClick={() => setQuery('')} className="text-white/70"><X size={16} /></button>}
              </div>
            </div>
          )}

          <div className="flex justify-center" style={{ opacity: Math.max(0, 1 - scrollTop / 260), transform: `scale(${Math.max(0.75, 1 - scrollTop / 900)})`, transformOrigin: 'bottom' }}>
            {page.type === 'playlist' && <PlaylistArt playlist={playlist || { name: title }} size={220} className="shadow-2xl shadow-black/60" />}
            {page.type === 'all' && (
              <div className="w-[220px] h-[220px] rounded shadow-2xl shadow-black/60 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #78350f)' }}>
                <Heart size={84} className="text-white" fill="white" />
              </div>
            )}
            {page.type === 'artist' && (
              coverTrack ? <Cover track={coverTrack} size={200} big rounded="rounded-full" className="shadow-2xl shadow-black/60" />
                : <div className="w-[200px] h-[200px] rounded-full bg-surface-600" />
            )}
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight mt-5 leading-tight">{title}</h1>
          <p className="text-[13px] text-white/60 mt-1">
            {page.type === 'playlist' ? 'Playlist · ' : page.type === 'artist' ? 'Artista · ' : ''}{meta}
          </p>
          {onIphone < baseTracks.length && (
            <p className="text-[12px] text-brand-300/80 mt-0.5">
              {onIphone} de {baseTracks.length} neste iPhone
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center mt-3">
            <div className="flex items-center gap-1 -ml-2 flex-1">
              {page.type === 'playlist' && (
                <button onClick={() => setAddOpen(true)} aria-label="Adicionar músicas" className="p-2 text-white/70 active:text-white">
                  <PlusCircle size={26} strokeWidth={1.5} />
                </button>
              )}
              {page.type === 'all' && (
                <button onClick={shell.importFiles} aria-label="Importar músicas" className="p-2 text-white/70 active:text-white">
                  <Download size={24} strokeWidth={1.75} />
                </button>
              )}
              {page.type !== 'artist' && (
                <button onClick={() => setMoreOpen(true)} aria-label="Mais opções" className="p-2 text-white/70 active:text-white">
                  <MoreHorizontal size={26} />
                </button>
              )}
            </div>
            <button onClick={toggleShuffle} aria-label="Aleatório"
              className={`p-3 mr-1 relative ${shuffleMode ? 'text-brand-400' : 'text-white/70'}`}>
              <Shuffle size={24} />
              {shuffleMode && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-400" />}
            </button>
            <button onClick={onBigPlay} aria-label={contextActive && player.isPlaying ? 'Pausar' : 'Tocar'}
              className="w-14 h-14 rounded-full bg-brand-500 flex items-center justify-center shadow-lg shadow-black/40 active:scale-95 transition-transform">
              {contextActive && player.isPlaying
                ? <Pause size={26} className="text-surface-900" fill="currentColor" />
                : <Play size={26} className="text-surface-900 ml-1" fill="currentColor" />}
            </button>
          </div>
        </div>

        {/* Tracks — with groups on: one folder row per group (tap = open/close, ▶ = play the group),
            then "Faixas avulsas". Every row has the same height so the list stays virtualized. */}
        {rows.length === 0 ? (
          <EmptyState page={page} hasQuery={!!query} onAdd={() => setAddOpen(true)} />
        ) : (
          <VirtualRows items={rows} rowHeight={ROW_HEIGHT} scrollRef={scrollRef}
            renderRow={row => row.kind === 'group' ? (
              <GroupRow key={row.key} group={row.group} tracks={row.tracks} open={openGroups.has(row.group.id)}
                onToggle={() => toggleGroup(row.group.id)} onPlay={() => playGroup(row.group)} />
            ) : row.kind === 'label' ? (
              <div key={row.key} style={{ height: ROW_HEIGHT }} className="flex items-end px-4 pb-2">
                <p className="text-[13px] font-bold text-white/60 uppercase tracking-wider">{row.text}</p>
              </div>
            ) : (
              <TrackRow key={row.key} track={row.track} onPlay={onPlayRow} onMenu={setMenuTrack}
                groupColor={groupsOn ? groupColor[row.track.group_id] : null} />
            )} />
        )}
        <div style={{ height: 'calc(env(safe-area-inset-bottom) + 150px)' }} />
      </div>

      {menuTrack && (
        <TrackMenu track={menuTrack}
          context={page.type === 'playlist' ? { playlistId: page.id, groups, playlistTracks: plTracks } : {}}
          onClose={() => setMenuTrack(null)} onChanged={() => { reloadPlaylist(); reloadLibrary() }} />
      )}
      {moreOpen && <MoreMenu page={page} playlist={playlist} groups={groups} onClose={() => setMoreOpen(false)}
        onAdd={() => setAddOpen(true)} onGroupsChanged={() => { reloadPlaylist(); notifyLibraryChanged() }} />}
      {addOpen && page.type === 'playlist' && (
        <AddTracksSheet playlistId={page.id} inPlaylist={plTracks} library={library}
          onClose={() => { setAddOpen(false); reloadPlaylist() }} />
      )}
    </div>
  )
}

// A "grupo de sequência" folder in the playlist list
function GroupRow({ group, tracks, open, onToggle, onPlay }) {
  const here = tracks.filter(isPlayable).length
  return (
    <div style={{ height: ROW_HEIGHT }} className="flex items-center gap-3 pl-4 pr-2 active:bg-white/5" onClick={onToggle}>
      <div className="w-12 h-12 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: group.color }}>
        {open ? <FolderOpen size={22} className="text-white" /> : <Folder size={22} className="text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold truncate" style={{ color: group.color }}>{group.name}</p>
        <p className="text-[13px] text-white/50 truncate">
          Grupo · {tracks.length} música{tracks.length !== 1 ? 's' : ''}{here < tracks.length ? ` · ${here} no iPhone` : ''}
        </p>
      </div>
      <ChevronDown size={20} className={`text-white/40 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      <button onClick={e => { e.stopPropagation(); onPlay() }} aria-label={`Tocar o grupo ${group.name}`}
        className="w-10 h-10 rounded-full border border-white/25 flex items-center justify-center text-white shrink-0 active:scale-90 transition-transform">
        <Play size={16} fill="currentColor" className="ml-0.5" />
      </button>
    </div>
  )
}

function headerArtSrc(page, playlist, coverTrack) {
  if (page.type === 'playlist' && /^https?:\/\//.test(playlist?.cover_url || '')) return null   // remote: no CORS for canvas
  const p = coverTrack?.cover_thumb || coverTrack?.cover_path
  return p ? window.nianplayPlatform?.mediaUrl?.(p) || null : null
}

function EmptyState({ page, hasQuery, onAdd }) {
  const shell = useShell()
  if (hasQuery) return <p className="text-center text-sm text-white/45 py-12">Nenhum resultado.</p>
  if (page.type === 'playlist') {
    return (
      <div className="flex flex-col items-center text-center px-8 py-10 gap-4">
        <p className="text-lg font-bold text-white">Vamos adicionar algumas músicas</p>
        <button onClick={onAdd} className="rounded-full bg-white text-surface-900 font-bold text-sm px-6 py-3 active:scale-95 transition-transform">
          Adicionar a esta playlist
        </button>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center text-center px-8 py-10 gap-3">
      <p className="text-lg font-bold text-white">Coloque suas músicas no iPhone</p>
      <p className="text-sm text-white/55 leading-relaxed">Importe arquivos do app Arquivos ou copie sua pasta de músicas pelo computador.</p>
      <button onClick={shell.importFiles} className="m-btn-primary mt-2 w-full">Importar do app Arquivos</button>
      <button onClick={shell.showHelp} className="m-btn-ghost w-full">Como copiar pelo computador</button>
    </div>
  )
}

function MoreMenu({ page, playlist, groups = [], onClose, onAdd, onGroupsChanged }) {
  const shell = useShell()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletingGroup, setDeletingGroup] = useState(false)
  if (deletingGroup) {
    return (
      <Sheet title="Excluir um grupo" onClose={onClose}>
        <p className="px-5 pb-2 text-[13px] text-white/50 leading-relaxed">As músicas continuam na playlist, sem grupo.</p>
        <div className="pb-2">
          {groups.map(g => (
            <button key={g.id} className="w-full flex items-center gap-3 px-5 py-3 text-left active:bg-white/5"
              onClick={async () => {
                await window.electron.playlists.deleteGroup(g.id)
                onGroupsChanged?.(); onClose(); shell.toast(`Grupo ${g.name} excluído`)
              }}>
              <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
              <span className="flex-1 text-[15px] text-white truncate">{g.name}</span>
              <Trash2 size={18} className="text-red-400" />
            </button>
          ))}
        </div>
      </Sheet>
    )
  }
  if (confirmDelete) {
    return (
      <Sheet onClose={onClose}>
        <div className="px-5 pt-2 pb-4 flex flex-col gap-3">
          <p className="text-base font-bold text-white">Excluir "{playlist?.name}"?</p>
          <p className="text-sm text-white/55 leading-relaxed">A playlist sai deste iPhone. As músicas continuam na biblioteca e a nuvem não é alterada.</p>
          <button className="m-btn-danger" onClick={async () => {
            await window.electron.playlists.delete(playlist.id)
            forgetContext({ type: 'playlist', id: playlist.id })
            notifyLibraryChanged()
            onClose(); shell.back(); shell.toast('Playlist excluída')
          }}>Excluir</button>
          <button className="m-btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </Sheet>
    )
  }
  const items = page.type === 'playlist' ? [
    { label: 'Adicionar a esta playlist', icon: Plus, onPress: onAdd },
    { label: 'Editar nome', icon: Pencil, onPress: () => shell.prompt({
      title: 'Editar nome', initial: playlist?.name, confirmLabel: 'Salvar',
      onSubmit: async name => {
        const r = await window.electron.playlists.update({ id: playlist.id, name })
        if (r?.error) return r.error
        notifyLibraryChanged()
      },
    }) },
    { label: playlist?.groups_enabled ? 'Desativar grupos de sequência' : 'Ativar grupos de sequência', icon: Layers,
      onPress: async () => {
        const r = await window.electron.playlists.toggleGroups(playlist.id)
        onGroupsChanged?.()
        shell.toast(r?.groups_enabled ? 'Grupos de sequência ativados' : 'Grupos de sequência desativados')
      } },
    { label: 'Novo grupo', icon: Tag, onPress: () => shell.prompt({
      title: 'Nome do novo grupo', confirmLabel: 'Criar',
      onSubmit: async name => {
        await window.electron.playlists.createGroup(playlist.id, name)
        if (!playlist.groups_enabled) await window.electron.playlists.toggleGroups(playlist.id)
        onGroupsChanged?.()
        shell.toast('Grupo criado — use "⋯" numa música para colocá-la nele')
      },
    }) },
    groups.length > 0 && { label: 'Excluir um grupo', icon: Trash2, keep: true, onPress: () => setDeletingGroup(true) },
    { label: 'Excluir playlist', icon: Trash2, destructive: true, keep: true, onPress: () => setConfirmDelete(true) },
  ].filter(Boolean) : [
    { label: 'Importar do app Arquivos', icon: Download, onPress: shell.importFiles },
    { label: 'Procurar na pasta do NianPlay', icon: FolderSearch, onPress: shell.scanDocs },
    { label: shell.showMissing ? 'Ocultar músicas que não estão no iPhone' : 'Mostrar músicas que não estão no iPhone',
      icon: shell.showMissing ? EyeOff : Eye, onPress: () => shell.setShowMissing(!shell.showMissing) },
    { label: 'Como colocar músicas no iPhone', icon: HelpCircle, onPress: shell.showHelp },
  ]
  return (
    <Sheet onClose={onClose}>
      <div className="py-2">
        {items.map(a => (
          <button key={a.label} onClick={() => { if (!a.keep) onClose(); a.onPress() }}
            className={`w-full flex items-center gap-4 px-5 py-3.5 text-[15px] text-left active:bg-white/5 ${a.destructive ? 'text-red-400' : 'text-white/90'}`}>
            <a.icon size={22} strokeWidth={1.75} className={a.destructive ? 'text-red-400' : 'text-white/60'} />
            {a.label}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

// Spotify's "Adicionar a esta playlist": library with search, ⊕ adds, ✓ already there
function AddTracksSheet({ playlistId, inPlaylist, library, onClose }) {
  const [query, setQuery] = useState('')
  const [added, setAdded] = useState(() => new Set(inPlaylist.map(t => t.id)))
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? library.filter(t => `${t.title} ${t.artist}`.toLowerCase().includes(q)) : library
    return list.slice(0, 150)
  }, [library, query])
  return (
    <Sheet title="Adicionar a esta playlist" onClose={onClose} tall>
      <div className="px-4 pb-2 sticky top-0 bg-surface-800 z-10">
        <div className="flex items-center gap-2 rounded-md bg-white/10 px-3 h-10">
          <Search size={17} className="text-white/60" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar na sua biblioteca"
            className="flex-1 bg-transparent text-base text-white placeholder-white/45 outline-none min-w-0" />
        </div>
      </div>
      <div className="pb-4">
        {results.map(t => {
          const isIn = added.has(t.id)
          return (
            <div key={t.id} className={`flex items-center gap-3 px-4 py-2 ${isPlayable(t) ? '' : 'opacity-45'}`}>
              <Cover track={t} size={48} rounded="rounded" />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] text-white truncate">{t.title}</p>
                <p className="text-[13px] text-white/50 truncate">{t.artist}</p>
              </div>
              <button disabled={isIn} aria-label={isIn ? 'Já está na playlist' : 'Adicionar'}
                onClick={async () => { await window.electron.playlists.addTrack(playlistId, t.id); setAdded(prev => new Set(prev).add(t.id)) }}
                className="p-2 shrink-0">
                {isIn ? <Check size={24} className="text-brand-400" /> : <PlusCircle size={26} strokeWidth={1.5} className="text-white/70" />}
              </button>
            </div>
          )
        })}
        {library.length > results.length && !query && (
          <p className="text-center text-xs text-white/35 py-3">Busque para ver mais músicas</p>
        )}
      </div>
    </Sheet>
  )
}

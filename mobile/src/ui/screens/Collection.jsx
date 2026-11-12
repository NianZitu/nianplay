// A playlist, "Todas as músicas" or an artist. Spotify's flow (back bar that fills in on scroll,
// find in list, swipe to queue, long-press menus) with the desktop PlaylistDetail blocks: hero
// with cover + PLAYLIST label + title + counts, Reproduzir / Aleatório + icon tools, the "Grupos de
// sequência" panel and numbered track rows.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Play, Pause, Shuffle, MoreHorizontal, Search, X, Download, FolderSearch, Eye, EyeOff, HelpCircle, Pencil, Trash2, Plus, Check, Folder, FolderOpen, ChevronDown, Layers, Tag, PlusCircle, DownloadCloud, ListMusic, Music2 } from 'lucide-react'
import { usePlayer } from '../../../../src/renderer/store/PlayerContext'
import VirtualRows from '../../../../src/renderer/components/VirtualRows'
import { useLibrary, isPlayable, Sheet, Cover, MenuList, EmptyState, VUBars } from '../common'
import { TrackRow, TrackMenu, PlaylistArt, ROW_HEIGHT } from '../tracks'
import { useDominantColor, usePlaylists } from '../hooks'
import { buildGroupedQueue } from '../queue'
import { setPlayContext, usePlayContext, forgetContext } from '../playContext'
import { useShell } from '../shell'
import { notifyLibraryChanged } from '../../platform/api'
import { AllSongsArt } from './Home'

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

  const tracksByGroup = useMemo(() => {
    const pool = showMissing ? baseTracks : baseTracks.filter(isPlayable)
    const byGroup = new Map(groups.map(g => [g.id, []]))
    const loose = []
    for (const t of pool) (t.group_id && byGroup.has(t.group_id) ? byGroup.get(t.group_id) : loose).push(t)
    for (const list of byGroup.values()) list.sort((a, b) => (a.group_position ?? 0) - (b.group_position ?? 0))
    return { byGroup, loose }
  }, [baseTracks, groups, showMissing])

  const rows = useMemo(() => {
    if (!groupsOn || query.trim()) return visible.map((t, i) => ({ kind: 'track', key: t.id, track: t, n: page.type === 'playlist' && !query.trim() ? i : null }))
    const out = []
    for (const g of groups) {
      const list = tracksByGroup.byGroup.get(g.id)
      if (!list?.length) continue
      out.push({ kind: 'group', key: `g-${g.id}`, group: g, tracks: list })
      if (openGroups.has(g.id)) list.forEach(t => out.push({ kind: 'track', key: t.id, track: t, n: null }))
    }
    if (tracksByGroup.loose.length) {
      if (out.length) out.push({ kind: 'label', key: 'loose', text: 'Faixas avulsas' })
      tracksByGroup.loose.forEach(t => out.push({ kind: 'track', key: t.id, track: t, n: null }))
    }
    return out
  }, [groupsOn, query, visible, groups, tracksByGroup, openGroups, page.type])

  const context = page.type === 'playlist'
    ? { type: 'playlist', id: page.id, name: playlist?.name || 'Playlist' }
    : page.type === 'artist' ? { type: 'artist', name: page.name } : { type: 'all', name: 'Todas as músicas' }
  const contextActive = current && current.type === context.type && (current.id || current.name) === (context.id || context.name)
    && playableQueue.some(t => t.id === player.currentTrack?.id)

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

  function start(track = null, shuffled = shuffleMode) {
    if (!playableQueue.length) {
      shell.toast('Nenhuma música desta lista está neste iPhone. Importe os arquivos em Todas as músicas.', false, 4500)
      return
    }
    player.setGroupsEnabled(groupsOn)
    if (groupsOn) {
      const q = buildGroupedQueue(baseTracks, groups, shuffled && !track).filter(isPlayable)
      player.setShuffle(false)
      player.playTrack(track || q[0], q)
    } else {
      player.setShuffle(shuffled)
      const first = track || (shuffled ? playableQueue[Math.floor(Math.random() * playableQueue.length)] : playableQueue[0])
      player.playTrack(first, playableQueue)
    }
    setPlayContext(context)
  }

  function onPlayRow(track) {
    if (!isPlayable(track)) {
      shell.toast('Esta música não está neste iPhone. Importe o arquivo em Biblioteca → Todas as músicas.', false, 4500)
      return
    }
    start(track)
  }

  function onMainPlay() {
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
  const glow = page.type === 'all' ? 'rgb(146 64 14)' : color
  const barOpacity = Math.min(1, Math.max(0, (scrollTop - 150) / 50))

  const onIphone = baseTracks.filter(isPlayable).length
  const missing = baseTracks.length - onIphone
  const eyebrow = page.type === 'playlist' ? 'Playlist' : page.type === 'artist' ? 'Artista' : 'Biblioteca'
  const playingHere = contextActive && player.isPlaying

  return (
    <div className="h-full relative">
      {/* Top bar: back button; fills in with the title once the hero scrolls away */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 px-2 pb-2 transition-colors"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 6px)',
          backgroundColor: `rgba(12,11,9,${0.95 * barOpacity})`,
          borderBottom: `1px solid rgba(255,255,255,${0.05 * barOpacity})`,
          backdropFilter: barOpacity > 0.05 ? 'blur(12px)' : undefined,
          WebkitBackdropFilter: barOpacity > 0.05 ? 'blur(12px)' : undefined,
        }}>
        <button onClick={shell.back} aria-label="Voltar"
          className="h-9 pl-1.5 pr-3 rounded-xl flex items-center gap-0.5 text-[13px] font-medium text-white/70 active:scale-95 transition-transform border border-white/8"
          style={{ backgroundColor: `rgba(12,11,9,${0.45 * (1 - barOpacity) + 0.04})` }}>
          <ChevronLeft size={20} /> Voltar
        </button>
        <p className="flex-1 text-[15px] font-bold text-white truncate" style={{ opacity: barOpacity }}>{title}</p>
        {barOpacity > 0.5 && (
          <button onClick={onMainPlay} aria-label={playingHere ? 'Pausar' : 'Reproduzir'}
            className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-600/25 active:scale-90 transition-transform fade-in">
            {playingHere ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
          </button>
        )}
      </div>

      <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain" onScroll={e => setScrollTop(e.currentTarget.scrollTop)}>
        {/* Hero (desktop PlaylistDetail): cover beside label/title/counts, faint cover-colored glow */}
        <div className="border-b border-white/[0.05]" style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 56px)',
          background: `linear-gradient(to bottom, color-mix(in srgb, ${glow} 38%, #0c0b09) 0%, #0c0b09 100%)`,
        }}>
          <div className="flex items-end gap-4 px-4">
            <div className="shrink-0 shadow-2xl shadow-black/60" style={{ borderRadius: page.type === 'artist' ? 999 : 16 }}>
              {page.type === 'playlist' && <PlaylistArt playlist={playlist || { name: title }} size={128} rounded="rounded-2xl" />}
              {page.type === 'all' && <AllSongsArt size={128} rounded="rounded-2xl" />}
              {page.type === 'artist' && <Cover track={coverTrack} size={128} big rounded="rounded-full" />}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <p className="m-label mb-1">{eyebrow}</p>
              <h1 className="text-[24px] font-black text-white tracking-tight leading-[1.1] line-clamp-3 break-words">{title}</h1>
              <p className="text-xs text-white/40 mt-1.5 tabular-nums">
                {baseTracks.length} faixa{baseTracks.length !== 1 ? 's' : ''}{baseTracks.length ? ` · ${totalDuration(baseTracks)}` : ''}
              </p>
              {missing > 0 && (
                <p className="text-[11.5px] text-amber-400/80 mt-1 flex items-center gap-1">
                  <DownloadCloud size={12} className="shrink-0" /> {missing} sem arquivo neste iPhone
                </p>
              )}
            </div>
          </div>

          {/* Action row: primary + ghost, separator, icon tools */}
          <div className="flex items-center gap-1.5 px-4 mt-5 [&>button]:shrink-0">
            <button onClick={onMainPlay} disabled={!baseTracks.length} className="m-chip-primary !shrink !flex-1 justify-center min-w-0">
              {playingHere ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              {playingHere ? 'Pausar' : 'Reproduzir'}
            </button>
            <button onClick={toggleShuffle} aria-pressed={shuffleMode} aria-label="Aleatório"
              className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors
                ${shuffleMode ? 'text-brand-400 bg-brand-600/15 border-brand-500/25' : 'text-white/55 bg-white/[0.04] border-white/8'}`}>
              <Shuffle size={17} strokeWidth={shuffleMode ? 2.2 : 1.75} />
            </button>
            <div className="w-px h-6 bg-white/10 mx-1 shrink-0" />
            {page.type === 'playlist' && (
              <button onClick={() => setAddOpen(true)} aria-label="Adicionar faixas" className="m-icon-btn"><Plus size={20} /></button>
            )}
            {page.type === 'all' && (
              <button onClick={shell.importFiles} aria-label="Importar músicas" className="m-icon-btn"><Download size={19} /></button>
            )}
            {page.type === 'playlist' && (
              <button onClick={() => setMoreOpen('groups')} aria-label="Grupos de sequência"
                className={`m-icon-btn ${playlist?.groups_enabled ? '!text-brand-400 !bg-brand-600/15' : ''}`}><Tag size={18} /></button>
            )}
            {page.type !== 'artist' && (
              <button onClick={() => setMoreOpen(true)} aria-label="Mais opções" className="m-icon-btn"><MoreHorizontal size={20} /></button>
            )}
          </div>

          {/* Find in list */}
          {page.type !== 'artist' && baseTracks.length > 0 && (
            <div className="relative mx-4 mt-4">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder={page.type === 'playlist' ? 'Buscar na playlist…' : 'Buscar nas músicas…'}
                className="m-input !h-11 !pl-10 !pr-10" />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Limpar busca"
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/35"><X size={16} /></button>
              )}
            </div>
          )}
          <div className="h-4" />
        </div>

        {/* Tracks — with groups on: one folder row per group (tap = open/close, ▶ = play the group),
            then "Faixas avulsas". Every row has the same height so the list stays virtualized. */}
        <div className="pt-2">
          {rows.length === 0 ? (
            <CollectionEmpty page={page} hasQuery={!!query} onAdd={() => setAddOpen(true)} />
          ) : (
            <VirtualRows items={rows} rowHeight={ROW_HEIGHT} scrollRef={scrollRef}
              renderRow={row => row.kind === 'group' ? (
                <GroupRow key={row.key} group={row.group} tracks={row.tracks} open={openGroups.has(row.group.id)}
                  current={player.currentTrack} playing={player.isPlaying}
                  onToggle={() => toggleGroup(row.group.id)} onPlay={() => playGroup(row.group)} />
              ) : row.kind === 'label' ? (
                <div key={row.key} style={{ height: ROW_HEIGHT }} className="flex items-end px-4 pb-2">
                  <p className="m-label">{row.text}</p>
                </div>
              ) : (
                <TrackRow key={row.key} track={row.track} onPlay={onPlayRow} onMenu={setMenuTrack} index={row.n}
                  groupColor={groupsOn ? groupColor[row.track.group_id] : null} />
              )} />
          )}
        </div>
        <div style={{ height: 'calc(env(safe-area-inset-bottom) + 160px)' }} />
      </div>

      {menuTrack && (
        <TrackMenu track={menuTrack}
          context={page.type === 'playlist' ? { playlistId: page.id, groups, playlistTracks: plTracks } : {}}
          onClose={() => setMenuTrack(null)} onChanged={() => { reloadPlaylist(); reloadLibrary() }} />
      )}
      {moreOpen && <MoreMenu page={page} playlist={playlist} groups={groups} only={moreOpen === 'groups' ? 'groups' : null}
        onClose={() => setMoreOpen(false)}
        onAdd={() => setAddOpen(true)} onGroupsChanged={() => { reloadPlaylist(); notifyLibraryChanged() }} />}
      {addOpen && page.type === 'playlist' && (
        <AddTracksSheet playlistId={page.id} inPlaylist={plTracks} library={library}
          onClose={() => { setAddOpen(false); reloadPlaylist() }} />
      )}
    </div>
  )
}

// A "grupo de sequência" folder (desktop GroupFolder: colored stripe, folder icon in the group color)
function GroupRow({ group, tracks, open, onToggle, onPlay, current, playing }) {
  const here = tracks.filter(isPlayable).length
  const hasActive = tracks.some(t => t.id === current?.id)
  return (
    <div style={{ height: ROW_HEIGHT }} className="px-2 py-[2px]">
      <div onClick={onToggle}
        className={`relative h-full flex items-center gap-3 pl-3.5 pr-1.5 rounded-xl border overflow-hidden active:bg-white/[0.06]
          ${hasActive ? 'bg-brand-600/20 border-brand-400/20' : 'bg-white/[0.025] border-white/[0.05]'}`}>
        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full" style={{ backgroundColor: group.color }} />
        <span className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: group.color + '1f' }}>
          {open ? <FolderOpen size={20} style={{ color: group.color }} /> : <Folder size={20} style={{ color: group.color }} />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold truncate" style={{ color: group.color }}>{group.name}</p>
          <p className="text-[12px] text-white/35 truncate">
            Grupo · {tracks.length} faixa{tracks.length !== 1 ? 's' : ''}{here < tracks.length ? ` · ${here} no iPhone` : ''}
          </p>
        </div>
        {hasActive && <VUBars playing={playing} bars={3} height={11} />}
        <ChevronDown size={18} className={`text-white/30 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        <button onClick={e => { e.stopPropagation(); onPlay() }} aria-label={`Tocar o grupo ${group.name}`}
          className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/8 flex items-center justify-center text-white/70 shrink-0 active:scale-90 transition-transform">
          <Play size={15} fill="currentColor" className="ml-0.5" />
        </button>
      </div>
    </div>
  )
}

function headerArtSrc(page, playlist, coverTrack) {
  if (page.type === 'playlist' && /^https?:\/\//.test(playlist?.cover_url || '')) return null   // remote: no CORS for canvas
  const p = coverTrack?.cover_thumb || coverTrack?.cover_path
  return p ? window.nianplayPlatform?.mediaUrl?.(p) || null : null
}

function CollectionEmpty({ page, hasQuery, onAdd }) {
  const shell = useShell()
  if (hasQuery) return <EmptyState icon={Search} title="Nenhum resultado" />
  if (page.type === 'playlist') {
    return (
      <EmptyState icon={ListMusic} title="Playlist vazia" desc="Adicione músicas da sua biblioteca.">
        <button onClick={onAdd} className="m-btn-primary"><Plus size={17} /> Adicionar faixas</button>
      </EmptyState>
    )
  }
  return (
    <EmptyState icon={Music2} title="Coloque suas músicas no iPhone"
      desc="Importe arquivos do app Arquivos ou copie sua pasta de músicas pelo computador.">
      <button onClick={shell.importFiles} className="m-btn-primary"><Download size={17} /> Importar do app Arquivos</button>
      <button onClick={shell.showHelp} className="m-btn-ghost"><HelpCircle size={17} /> Como copiar pelo computador</button>
    </EmptyState>
  )
}

function MoreMenu({ page, playlist, groups = [], only = null, onClose, onAdd, onGroupsChanged }) {
  const shell = useShell()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletingGroup, setDeletingGroup] = useState(false)
  if (deletingGroup) {
    return (
      <Sheet title="Excluir um grupo" onClose={onClose}>
        <p className="px-5 pt-3 pb-1 text-[13px] text-white/40 leading-relaxed">As músicas continuam na playlist, sem grupo.</p>
        <div className="px-3 py-2 flex flex-col gap-1">
          {groups.map(g => (
            <button key={g.id} className="m-row flex items-center gap-3 px-3 py-3 text-left active:bg-white/5"
              onClick={async () => {
                await window.electron.playlists.deleteGroup(g.id)
                onGroupsChanged?.(); onClose(); shell.toast(`Grupo ${g.name} excluído`)
              }}>
              <Tag size={16} style={{ color: g.color }} className="shrink-0" />
              <span className="flex-1 text-[15px] font-medium truncate" style={{ color: g.color }}>{g.name}</span>
              <Trash2 size={17} className="text-red-400" />
            </button>
          ))}
        </div>
      </Sheet>
    )
  }
  if (confirmDelete) {
    return (
      <Sheet title={`Excluir "${playlist?.name}"`} onClose={onClose}>
        <div className="px-5 pt-4 pb-4 flex flex-col gap-3">
          <p className="text-sm text-white/55 leading-relaxed">A playlist sai deste iPhone. As músicas continuam na biblioteca e a nuvem não é alterada.</p>
          <div className="flex gap-2 pt-1">
            <button className="m-btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="m-btn-danger" onClick={async () => {
              await window.electron.playlists.delete(playlist.id)
              forgetContext({ type: 'playlist', id: playlist.id })
              notifyLibraryChanged()
              onClose(); shell.back(); shell.toast('Playlist excluída')
            }}><Trash2 size={16} /> Excluir</button>
          </div>
        </div>
      </Sheet>
    )
  }
  const groupItems = page.type === 'playlist' ? [
    { label: playlist?.groups_enabled ? 'Desativar grupos de sequência' : 'Ativar grupos de sequência', icon: Layers,
      onPress: async () => {
        const r = await window.electron.playlists.toggleGroups(playlist.id)
        onGroupsChanged?.()
        shell.toast(r?.groups_enabled ? 'Grupos de sequência ativados' : 'Grupos de sequência desativados')
      } },
    { label: 'Novo grupo', icon: Tag, onPress: () => shell.prompt({
      title: 'Novo grupo', label: 'Nome do grupo', confirmLabel: 'Criar',
      onSubmit: async name => {
        await window.electron.playlists.createGroup(playlist.id, name)
        if (!playlist.groups_enabled) await window.electron.playlists.toggleGroups(playlist.id)
        onGroupsChanged?.()
        shell.toast('Grupo criado — use "⋯" numa música para colocá-la nele')
      },
    }) },
    groups.length > 0 && { label: 'Excluir um grupo', icon: Trash2, destructive: true, keep: true, onPress: () => setDeletingGroup(true) },
  ] : []
  const items = only === 'groups' ? groupItems : page.type === 'playlist' ? [
    { label: 'Adicionar faixas', icon: PlusCircle, onPress: onAdd },
    { label: 'Renomear', icon: Pencil, onPress: () => shell.prompt({
      title: 'Renomear playlist', label: 'Nome da playlist', initial: playlist?.name, confirmLabel: 'Salvar',
      onSubmit: async name => {
        const r = await window.electron.playlists.update({ id: playlist.id, name })
        if (r?.error) return r.error
        notifyLibraryChanged()
      },
    }) },
    ...groupItems,
    { label: 'Excluir playlist', icon: Trash2, destructive: true, keep: true, onPress: () => setConfirmDelete(true) },
  ] : [
    { label: 'Importar do app Arquivos', icon: Download, onPress: shell.importFiles },
    { label: 'Procurar na pasta do NianPlay', icon: FolderSearch, onPress: shell.scanDocs },
    { label: shell.showMissing ? 'Ocultar músicas que não estão no iPhone' : 'Mostrar músicas que não estão no iPhone',
      icon: shell.showMissing ? EyeOff : Eye, onPress: () => shell.setShowMissing(!shell.showMissing) },
    { label: 'Como colocar músicas no iPhone', icon: HelpCircle, onPress: shell.showHelp },
  ]
  return (
    <Sheet title={only === 'groups' ? 'Grupos de sequência' : page.type === 'playlist' ? playlist?.name : 'Todas as músicas'} onClose={onClose}>
      {only === 'groups' && (
        <p className="px-5 pt-3 text-[13px] text-white/40 leading-relaxed">
          Músicas do mesmo grupo tocam juntas e em ordem, mesmo no aleatório. Use "⋯" numa música para colocá-la num grupo.
        </p>
      )}
      <MenuList actions={items} onClose={onClose} />
    </Sheet>
  )
}

// "Adicionar faixas": library with search, ⊕ adds, ✓ already there
function AddTracksSheet({ playlistId, inPlaylist, library, onClose }) {
  const [query, setQuery] = useState('')
  const [added, setAdded] = useState(() => new Set(inPlaylist.map(t => t.id)))
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? library.filter(t => `${t.title} ${t.artist}`.toLowerCase().includes(q)) : library
    return list.slice(0, 150)
  }, [library, query])
  return (
    <Sheet title="Adicionar faixas" onClose={onClose} tall>
      <div className="px-4 pt-3 pb-2 sticky top-0 bg-surface-800 z-10">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar na sua biblioteca…" className="m-input !h-11 !pl-10" />
        </div>
      </div>
      <div className="px-2 pb-4 flex flex-col gap-1">
        {results.map(t => {
          const isIn = added.has(t.id)
          return (
            <div key={t.id} className={`flex items-center gap-3 p-2 ${isIn ? 'm-row-active' : 'm-row'} ${isPlayable(t) ? '' : 'opacity-45'}`}>
              <Cover track={t} size={44} rounded="rounded-lg" />
              <div className="flex-1 min-w-0">
                <p className={`text-[15px] font-medium truncate ${isIn ? 'text-brand-300' : 'text-white/90'}`}>{t.title}</p>
                <p className="text-[12px] text-white/35 truncate">{t.artist}</p>
              </div>
              <button disabled={isIn} aria-label={isIn ? 'Já está na playlist' : 'Adicionar'}
                onClick={async () => { await window.electron.playlists.addTrack(playlistId, t.id); setAdded(prev => new Set(prev).add(t.id)) }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isIn ? 'text-brand-400' : 'text-white/50 bg-white/[0.05] border border-white/8 active:bg-white/10'}`}>
                {isIn ? <Check size={20} /> : <Plus size={20} />}
              </button>
            </div>
          )
        })}
        {library.length > results.length && !query && (
          <p className="text-center text-xs text-white/30 py-3">Busque para ver mais músicas</p>
        )}
      </div>
    </Sheet>
  )
}

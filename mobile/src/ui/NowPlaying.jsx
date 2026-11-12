// Full-screen player. Spotify's behavior (opens from the mini player, pull down to close, big art,
// scrubber) with the desktop StudioPanel layout: art with the title on a bottom gradient + VU
// meter, thin amber progress, amber play button, and "Fila | Letra" tabs underneath.
import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, MoreHorizontal, ListPlus, Shuffle, SkipBack, SkipForward, Play, Pause, List, AlignLeft, Loader2, Music2 } from 'lucide-react'
import { usePlayer, usePlayerProgress } from '../../../src/renderer/store/PlayerContext'
import { Cover, VUBars, formatTime, trackArt } from './common'
import { TrackMenu, AddToPlaylistSheet } from './tracks'
import { usePlayContext } from './playContext'
import { useShell } from './shell'

function Scrubber() {
  const { seek } = usePlayer()
  const { progress, duration } = usePlayerProgress()
  const [drag, setDrag] = useState(null)
  const bar = useRef(null)
  const ratioAt = x => {
    const r = bar.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (x - r.left) / r.width))
  }
  const value = drag ?? (progress || 0)
  return (
    <div>
      <div ref={bar} className="relative h-7 flex items-center touch-none"
        onTouchStart={e => setDrag(ratioAt(e.touches[0].clientX))}
        onTouchMove={e => setDrag(ratioAt(e.touches[0].clientX))}
        onTouchEnd={() => { if (drag !== null) seek(drag); setDrag(null) }}
        onMouseDown={e => { const r = ratioAt(e.clientX); seek(r) }}>
        <div className={`w-full rounded-full bg-white/10 overflow-hidden transition-[height] ${drag !== null ? 'h-[5px]' : 'h-[3px]'}`}>
          <div className="h-full bg-brand-500 rounded-full" style={{ width: `${value * 100}%` }} />
        </div>
        <div className={`absolute w-3 h-3 rounded-full bg-white shadow-lg -translate-x-1/2 transition-transform ${drag !== null ? 'scale-125' : 'scale-100'}`}
          style={{ left: `${value * 100}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-white/30 tabular-nums -mt-1">
        <span>{formatTime(value * (duration || 0))}</span>
        <span>{formatTime(duration || 0)}</span>
      </div>
    </div>
  )
}

function Lyrics({ track }) {
  const { updateQueuedTrack } = usePlayer()
  const [state, setState] = useState('idle')
  useEffect(() => { setState('idle') }, [track?.id])
  async function find() {
    setState('loading')
    const res = await window.electron.lyrics.fetch({ title: track.title, artist: track.artist })
    if (res?.lyrics) {
      await window.electron.library.updateTrack({ id: track.id, lyrics: res.lyrics })
      updateQueuedTrack({ ...track, lyrics: res.lyrics })
      setState('idle')
    } else setState('notfound')
  }
  if (track.lyrics) {
    return <p className="px-5 py-5 text-[16px] text-white/65 whitespace-pre-wrap leading-loose">{track.lyrics}</p>
  }
  return (
    <div className="flex flex-col items-center text-center px-8 py-10 gap-3">
      <AlignLeft size={30} strokeWidth={1} className="text-white/10" />
      <p className="text-sm text-white/35">{state === 'notfound' ? 'Não encontramos a letra desta música.' : 'Sem letra salva para esta música.'}</p>
      <button onClick={find} disabled={state === 'loading'}
        className="h-10 px-5 rounded-xl bg-accent-600 text-white text-sm font-semibold flex items-center gap-2 shadow-md shadow-black/30 active:scale-95 transition-transform disabled:opacity-60">
        {state === 'loading' && <Loader2 size={15} className="animate-spin" />} Buscar letra
      </button>
    </div>
  )
}

function Queue({ onPicked }) {
  const { currentTrack, upcomingItems, playQueueIndex, isPlaying } = usePlayer()
  return (
    <div className="px-2 py-2 flex flex-col gap-1">
      {currentTrack && (
        <div className="m-row-active flex items-center gap-3 px-2.5 py-2">
          <div className="relative">
            <Cover track={currentTrack} size={40} rounded="rounded-md" />
            <span className="absolute inset-0 rounded-md bg-black/45 flex items-center justify-center">
              <VUBars playing={isPlaying} bars={3} height={11} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-brand-300 truncate">{currentTrack.title}</p>
            <p className="text-[12px] text-white/35 truncate">{currentTrack.artist}</p>
          </div>
          <span className="m-label !text-brand-400/70 shrink-0">Agora</span>
        </div>
      )}
      {upcomingItems.length > 0 && <p className="m-label px-3 pt-3 pb-1">A seguir</p>}
      {upcomingItems.slice(0, 80).map(({ track, queueIndex }) => (
        <button key={`${track.id}-${queueIndex}`} onClick={() => { playQueueIndex(queueIndex); onPicked?.() }}
          className="flex items-center gap-3 px-2.5 py-2 rounded-xl text-left active:bg-white/5">
          <Cover track={track} size={40} rounded="rounded-md" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-white/75 truncate">{track.title}</p>
            <p className="text-[12px] text-white/30 truncate">{track.artist}</p>
          </div>
          {track._queued && <span className="badge-brand shrink-0">Fila</span>}
        </button>
      ))}
      {!upcomingItems.length && (
        <div className="flex flex-col items-center py-8 gap-2">
          <List size={26} strokeWidth={1} className="text-white/10" />
          <p className="text-xs text-white/25">Nada na fila depois desta música</p>
        </div>
      )}
    </div>
  )
}

export default function NowPlaying({ onClose }) {
  const { currentTrack, isPlaying, togglePlay, skipNext, skipPrev, shuffle, setShuffle, groupsEnabled } = usePlayer()
  const { current } = usePlayContext()
  const shell = useShell()
  const [sheet, setSheet] = useState(null)   // 'menu' | 'add'
  const [tab, setTab] = useState('queue')
  const [pull, setPull] = useState(0)
  const pullStart = useRef(null)
  const scroller = useRef(null)

  useEffect(() => { if (!currentTrack) onClose() }, [currentTrack, onClose])
  if (!currentTrack) return null
  const art = trackArt(currentTrack, true)

  const source = current?.type === 'playlist' ? ['Tocando da playlist', current.name]
    : current?.type === 'artist' ? ['Tocando do artista', current.name]
    : ['Tocando de', 'Todas as músicas']
  const gainOff = window.nianplayPlatform?.nativePlayer ? window.nianplayPlatform?.lufs === false : window.nianplayPlatform?.webAudio === false

  return (
    <div className="fixed inset-0 z-50 slide-up bg-surface-900"
      style={{ transform: pull ? `translateY(${pull}px)` : undefined, transition: pull ? 'none' : 'transform 200ms' }}>
      {/* Blurred cover glow behind everything (StudioPanel art zone) */}
      {art && (
        <div className="absolute inset-x-0 top-0 h-[65%] overflow-hidden pointer-events-none" aria-hidden="true"
          style={{ WebkitMaskImage: 'linear-gradient(to bottom, #000 35%, transparent)', maskImage: 'linear-gradient(to bottom, #000 35%, transparent)' }}>
          <img src={art} alt="" className="w-full h-full object-cover blur-3xl scale-125 opacity-30" />
        </div>
      )}

      <div ref={scroller} className="relative h-full overflow-y-auto overscroll-contain"
        // Pull down from the top to close (Spotify)
        onTouchStart={e => { pullStart.current = scroller.current.scrollTop <= 0 ? e.touches[0].clientY : null }}
        onTouchMove={e => { if (pullStart.current !== null) setPull(Math.max(0, e.touches[0].clientY - pullStart.current)) }}
        onTouchEnd={() => { if (pull > 120) onClose(); setPull(0); pullStart.current = null }}>
        <div className="px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 6px)' }}>
          {/* Top bar */}
          <div className="flex items-center gap-2">
            <button onClick={onClose} aria-label="Fechar" className="m-icon-btn -ml-2 !text-white/70"><ChevronDown size={26} /></button>
            <div className="flex-1 text-center min-w-0">
              <p className="m-label">{source[0]}</p>
              <p className="text-[13px] font-bold text-white/85 truncate mt-0.5">{source[1]}</p>
            </div>
            <button onClick={() => setSheet('menu')} aria-label="Mais opções" className="m-icon-btn -mr-2 !text-white/70"><MoreHorizontal size={22} /></button>
          </div>

          {/* Art with the title on its bottom gradient */}
          <div className="relative mt-5 w-full aspect-square rounded-2xl overflow-hidden bg-surface-800 border border-white/[0.06] shadow-2xl shadow-black/60">
            {art ? <img src={art} alt="" className="absolute inset-0 w-full h-full object-cover" />
              : <div className="absolute inset-0 flex items-center justify-center"><Music2 size={72} strokeWidth={0.8} className="text-white/8" /></div>}
            <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-20"
              style={{ background: 'linear-gradient(to top, #0c0b09 0%, #0c0b09cc 40%, transparent 100%)' }}>
              <div className="flex items-end gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[21px] font-black text-white tracking-tight leading-tight truncate drop-shadow">{currentTrack.title}</p>
                  <button onClick={() => { onClose(); shell.navigate({ type: 'artist', name: currentTrack.artist }) }}
                    className="text-[14px] text-white/55 truncate block max-w-full text-left mt-0.5">
                    {currentTrack.artist}
                    {currentTrack.album && <span className="text-white/30"> · {currentTrack.album}</span>}
                  </button>
                </div>
                <VUBars playing={isPlaying} height={16} className="mb-1.5" />
              </div>
            </div>
          </div>

          <div className="mt-4"><Scrubber /></div>

          {/* Transport (StudioPanel row) */}
          <div className="mt-2 flex items-center justify-between">
            <button aria-label="Aleatório" disabled={groupsEnabled}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors disabled:opacity-30
                ${shuffle ? 'text-brand-400 bg-brand-600/15' : 'text-white/35'}`}
              onClick={() => { setShuffle(s => !s); shell.toast(!shuffle ? 'Modo aleatório ativado' : 'Modo aleatório desativado') }}>
              <Shuffle size={20} strokeWidth={shuffle ? 2.2 : 1.6} />
            </button>
            <button onClick={skipPrev} aria-label="Anterior" className="w-14 h-14 rounded-xl flex items-center justify-center text-white/70 active:bg-white/5 active:scale-90 transition-transform">
              <SkipBack size={28} strokeWidth={1.5} fill="currentColor" />
            </button>
            <button onClick={togglePlay} aria-label={isPlaying ? 'Pausar' : 'Tocar'}
              className="w-[68px] h-[68px] rounded-full bg-brand-600 flex items-center justify-center text-white shadow-xl shadow-brand-600/25 active:scale-90 transition-transform">
              {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
            </button>
            <button onClick={skipNext} aria-label="Próxima" className="w-14 h-14 rounded-xl flex items-center justify-center text-white/70 active:bg-white/5 active:scale-90 transition-transform">
              <SkipForward size={28} strokeWidth={1.5} fill="currentColor" />
            </button>
            <button onClick={() => setSheet('add')} aria-label="Adicionar à playlist"
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white/35 active:bg-white/5">
              <ListPlus size={21} strokeWidth={1.6} />
            </button>
          </div>

          {currentTrack.gain ? (
            <div className="mt-2 flex justify-center">
              <span className={`${gainOff ? 'badge-muted' : 'badge-accent'} !normal-case !tracking-normal`}>
                LUFS {currentTrack.gain > 0 ? '+' : ''}{currentTrack.gain} dB{gainOff ? ' · desligado' : ''}
              </span>
            </div>
          ) : null}
        </div>

        {/* Fila | Letra (StudioPanel tabs) */}
        <div className="mt-5 mx-3 panel overflow-hidden">
          <div className="flex border-b border-white/[0.05]">
            {[{ id: 'queue', icon: List, label: 'Fila' }, { id: 'lyrics', icon: AlignLeft, label: 'Letra' }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`relative flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] font-medium transition-colors
                  ${tab === t.id ? 'text-brand-400' : 'text-white/30'}`}>
                <t.icon size={14} /> {t.label}
                {tab === t.id && <span className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-brand-500 rounded-full" />}
              </button>
            ))}
          </div>
          {tab === 'queue' ? <Queue onPicked={() => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })} /> : <Lyrics track={currentTrack} />}
        </div>
        <div style={{ height: 'calc(env(safe-area-inset-bottom) + 28px)' }} />
      </div>

      {sheet === 'menu' && <TrackMenu track={currentTrack} onClose={() => setSheet(null)} />}
      {sheet === 'add' && <AddToPlaylistSheet track={currentTrack} onClose={() => setSheet(null)} />}
    </div>
  )
}

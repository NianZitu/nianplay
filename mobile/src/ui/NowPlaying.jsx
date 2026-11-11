// Full-screen player (Spotify): cover-colored gradient, big art, scrubber, controls, lyrics card.
import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, MoreHorizontal, PlusCircle, Shuffle, SkipBack, SkipForward, Play, Pause, ListMusic, Loader2 } from 'lucide-react'
import { usePlayer, usePlayerProgress } from '../../../src/renderer/store/PlayerContext'
import { Cover, Sheet, formatTime, trackArt } from './common'
import { TrackMenu, AddToPlaylistSheet } from './tracks'
import { useDominantColor } from './hooks'
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
    <div className="mt-6">
      <div ref={bar} className="relative h-6 flex items-center touch-none"
        onTouchStart={e => setDrag(ratioAt(e.touches[0].clientX))}
        onTouchMove={e => setDrag(ratioAt(e.touches[0].clientX))}
        onTouchEnd={() => { if (drag !== null) seek(drag); setDrag(null) }}
        onMouseDown={e => { const r = ratioAt(e.clientX); seek(r) }}>
        <div className="w-full h-1 rounded-full bg-white/25 overflow-hidden">
          <div className="h-full bg-white" style={{ width: `${value * 100}%` }} />
        </div>
        <div className={`absolute w-3 h-3 rounded-full bg-white -translate-x-1/2 transition-transform ${drag !== null ? 'scale-150' : ''}`}
          style={{ left: `${value * 100}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-white/60 tabular-nums -mt-0.5">
        <span>{formatTime(value * (duration || 0))}</span>
        <span>-{formatTime(Math.max(0, (1 - value) * (duration || 0)))}</span>
      </div>
    </div>
  )
}

function LyricsCard({ track, color }) {
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
  return (
    <div className="mt-8 rounded-xl p-4" style={{ backgroundColor: `color-mix(in srgb, ${color} 70%, #000)` }}>
      <p className="text-base font-bold text-white mb-3">Letra</p>
      {track.lyrics ? (
        <p className="text-[19px] font-bold text-white/90 leading-relaxed whitespace-pre-wrap">{track.lyrics}</p>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-white/70">{state === 'notfound' ? 'Não encontramos a letra desta música.' : 'Esta música ainda não tem letra salva.'}</p>
          <button onClick={find} disabled={state === 'loading'} className="rounded-full bg-white text-surface-900 text-sm font-bold px-5 py-2.5 flex items-center gap-2 active:scale-95 transition-transform">
            {state === 'loading' && <Loader2 size={16} className="animate-spin" />} Buscar letra
          </button>
        </div>
      )}
    </div>
  )
}

function QueueSheet({ onClose }) {
  const { currentTrack, upcomingItems, playQueueIndex } = usePlayer()
  return (
    <Sheet title="Fila" onClose={onClose} tall>
      <div className="pb-4">
        <p className="px-5 pt-1 pb-2 text-sm font-bold text-white">Tocando agora</p>
        {currentTrack && (
          <div className="flex items-center gap-3 px-5 py-2">
            <Cover track={currentTrack} size={44} rounded="rounded" />
            <div className="min-w-0"><p className="text-[15px] text-brand-400 truncate">{currentTrack.title}</p><p className="text-[13px] text-white/50 truncate">{currentTrack.artist}</p></div>
          </div>
        )}
        {upcomingItems.length > 0 && <p className="px-5 pt-4 pb-2 text-sm font-bold text-white">A seguir</p>}
        {upcomingItems.slice(0, 80).map(({ track, queueIndex }) => (
          <button key={`${track.id}-${queueIndex}`} onClick={() => { playQueueIndex(queueIndex); onClose() }}
            className="w-full flex items-center gap-3 px-5 py-2 text-left active:bg-white/5">
            <Cover track={track} size={44} rounded="rounded" />
            <div className="min-w-0"><p className="text-[15px] text-white truncate">{track.title}</p><p className="text-[13px] text-white/50 truncate">{track.artist}</p></div>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

export default function NowPlaying({ onClose }) {
  const { currentTrack, isPlaying, togglePlay, skipNext, skipPrev, shuffle, setShuffle, groupsEnabled } = usePlayer()
  const { current } = usePlayContext()
  const shell = useShell()
  const color = useDominantColor(trackArt(currentTrack, true), currentTrack?.title || '')
  const [sheet, setSheet] = useState(null)   // 'menu' | 'add' | 'queue'
  const [pull, setPull] = useState(0)
  const pullStart = useRef(null)
  const scroller = useRef(null)

  useEffect(() => { if (!currentTrack) onClose() }, [currentTrack, onClose])
  if (!currentTrack) return null

  const source = current?.type === 'playlist' ? ['TOCANDO DA PLAYLIST', current.name]
    : current?.type === 'artist' ? ['TOCANDO DO ARTISTA', current.name]
    : ['TOCANDO DE', 'Todas as músicas']

  return (
    <div className="fixed inset-0 z-50 slide-up"
      style={{ transform: pull ? `translateY(${pull}px)` : undefined, transition: pull ? 'none' : 'transform 200ms' }}>
      <div ref={scroller} className="h-full overflow-y-auto overscroll-contain"
        style={{ background: `linear-gradient(to bottom, color-mix(in srgb, ${color} 85%, #000) 0%, #0c0b09 75%)` }}
        // Pull down from the top to close (Spotify)
        onTouchStart={e => { pullStart.current = scroller.current.scrollTop <= 0 ? e.touches[0].clientY : null }}
        onTouchMove={e => { if (pullStart.current !== null) setPull(Math.max(0, e.touches[0].clientY - pullStart.current)) }}
        onTouchEnd={() => { if (pull > 120) onClose(); setPull(0); pullStart.current = null }}>
        <div className="px-6 flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)', minHeight: '100%' }}>
          {/* Top bar */}
          <div className="flex items-center gap-2">
            <button onClick={onClose} aria-label="Fechar" className="p-2 -ml-2 text-white"><ChevronDown size={28} /></button>
            <div className="flex-1 text-center min-w-0">
              <p className="text-[10px] tracking-widest text-white/70">{source[0]}</p>
              <p className="text-[13px] font-bold text-white truncate">{source[1]}</p>
            </div>
            <button onClick={() => setSheet('menu')} aria-label="Mais opções" className="p-2 -mr-2 text-white"><MoreHorizontal size={24} /></button>
          </div>

          {/* Art */}
          <div className="mt-8 w-full aspect-square">
            <Cover track={currentTrack} size="100%" big rounded="rounded-lg" className="!w-full !h-full shadow-2xl shadow-black/60" />
          </div>

          {/* Title */}
          <div className="mt-8 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[22px] font-bold text-white truncate leading-tight">{currentTrack.title}</p>
              <button onClick={() => { onClose(); shell.navigate({ type: 'artist', name: currentTrack.artist }) }}
                className="text-base text-white/65 truncate block max-w-full text-left">{currentTrack.artist}</button>
            </div>
            <button onClick={() => setSheet('add')} aria-label="Adicionar à playlist" className="p-1 text-white/80"><PlusCircle size={28} strokeWidth={1.5} /></button>
          </div>

          <Scrubber />

          {/* Controls */}
          <div className="mt-3 flex items-center justify-between">
            <button aria-label="Aleatório" className={`p-2 relative ${shuffle ? 'text-brand-400' : 'text-white/80'} ${groupsEnabled ? 'opacity-40' : ''}`}
              disabled={groupsEnabled}
              onClick={() => { setShuffle(s => !s); shell.toast(!shuffle ? 'Modo aleatório ativado' : 'Modo aleatório desativado') }}>
              <Shuffle size={24} />
              {shuffle && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-400" />}
            </button>
            <button onClick={skipPrev} aria-label="Anterior" className="p-2 text-white active:scale-90 transition-transform"><SkipBack size={36} fill="currentColor" /></button>
            <button onClick={togglePlay} aria-label={isPlaying ? 'Pausar' : 'Tocar'}
              className="w-[68px] h-[68px] rounded-full bg-brand-500 flex items-center justify-center active:scale-95 transition-transform shadow-lg shadow-black/40">
              {isPlaying ? <Pause size={30} className="text-surface-900" fill="currentColor" /> : <Play size={30} className="text-surface-900 ml-1" fill="currentColor" />}
            </button>
            <button onClick={skipNext} aria-label="Próxima" className="p-2 text-white active:scale-90 transition-transform"><SkipForward size={36} fill="currentColor" /></button>
            <button onClick={() => setSheet('queue')} aria-label="Fila" className="p-2 text-white/80"><ListMusic size={24} /></button>
          </div>

          {currentTrack.gain ? (
            <p className="mt-3 text-center text-[11px] text-white/45">
              Volume equalizado {currentTrack.gain > 0 ? '+' : ''}{currentTrack.gain} dB
              {window.nianplayPlatform?.webAudio === false ? ' (desligado nos ajustes)' : ''}
            </p>
          ) : null}

          <LyricsCard track={currentTrack} color={color} />
          <div style={{ height: 'calc(env(safe-area-inset-bottom) + 32px)' }} />
        </div>
      </div>

      {sheet === 'menu' && <TrackMenu track={currentTrack} onClose={() => setSheet(null)} />}
      {sheet === 'add' && <AddToPlaylistSheet track={currentTrack} onClose={() => setSheet(null)} />}
      {sheet === 'queue' && <QueueSheet onClose={() => setSheet(null)} />}
    </div>
  )
}

// Floating mini player above the tab bar (Spotify): cover color, swipe sideways to change song.
import React, { useRef, useState } from 'react'
import { Play, Pause, Home, Search, Library } from 'lucide-react'
import { usePlayer, usePlayerProgress } from '../../../src/renderer/store/PlayerContext'
import { Cover, trackArt } from './common'
import { useDominantColor } from './hooks'

function Progress() {
  const { progress } = usePlayerProgress()
  return (
    <div className="absolute left-2 right-2 bottom-0 h-[2px] rounded-full bg-white/20 overflow-hidden">
      <div className="h-full bg-white" style={{ width: `${(progress || 0) * 100}%` }} />
    </div>
  )
}

export function MiniPlayer({ onOpen }) {
  const { currentTrack, isPlaying, togglePlay, skipNext, skipPrev } = usePlayer()
  const color = useDominantColor(trackArt(currentTrack), currentTrack?.title || '')
  const touch = useRef(null)
  const [dx, setDx] = useState(0)
  if (!currentTrack) return null

  return (
    <div className="px-2 pb-1.5">
      <div
        onClick={() => { if (Math.abs(dx) < 4) onOpen() }}
        onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
        onTouchMove={e => {
          if (!touch.current) return
          const mx = e.touches[0].clientX - touch.current.x
          if (Math.abs(mx) > Math.abs(e.touches[0].clientY - touch.current.y)) setDx(mx)
        }}
        onTouchEnd={() => {
          if (dx < -70) skipNext()
          else if (dx > 70) skipPrev()
          touch.current = null
          setTimeout(() => setDx(0), 0)
        }}
        className="relative h-14 rounded-lg flex items-center gap-2.5 pl-2 pr-1 shadow-lg shadow-black/50 overflow-hidden"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 80%, #000)` }}>
        <div className="flex items-center gap-2.5 flex-1 min-w-0 transition-transform" style={{ transform: `translateX(${dx * 0.4}px)`, transitionDuration: dx ? '0ms' : '200ms' }}>
          <Cover track={currentTrack} size={40} rounded="rounded" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white truncate leading-tight">{currentTrack.title}</p>
            <p className="text-[13px] text-white/70 truncate leading-tight">{currentTrack.artist}</p>
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); togglePlay() }} aria-label={isPlaying ? 'Pausar' : 'Tocar'}
          className="w-11 h-11 flex items-center justify-center text-white shrink-0 active:scale-90 transition-transform">
          {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
        </button>
        <Progress />
      </div>
    </div>
  )
}

const TABS = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'search', label: 'Buscar', icon: Search },
  { id: 'library', label: 'Sua Biblioteca', icon: Library },
]

export function TabBar({ tab, onTab }) {
  return (
    <nav className="flex items-start justify-around pt-2"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 10px)', background: 'linear-gradient(to bottom, rgba(12,11,9,0.85), #0c0b09 45%)' }}>
      {TABS.map(t => {
        const active = tab === t.id
        return (
          <button key={t.id} onClick={() => onTab(t.id)} className="flex-1 flex flex-col items-center gap-1 py-1 active:scale-95 transition-transform">
            <t.icon size={25} strokeWidth={active ? 2.6 : 1.8} className={active ? 'text-white' : 'text-white/55'} />
            <span className={`text-[10px] ${active ? 'text-white font-semibold' : 'text-white/55'}`}>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

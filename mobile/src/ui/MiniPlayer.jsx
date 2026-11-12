// Floating mini player above the tab bar (Spotify's behavior: tap opens the player, swipe sideways
// changes song) with the desktop StudioPanel look: charcoal block, blurred cover glow, VU meter,
// amber play button and a thin amber progress line.
import React, { useRef, useState } from 'react'
import { Play, Pause, Home, Search, Library } from 'lucide-react'
import { usePlayer, usePlayerProgress } from '../../../src/renderer/store/PlayerContext'
import { Cover, VUBars, trackArt } from './common'

function Progress() {
  const { progress } = usePlayerProgress()
  return (
    <div className="absolute left-3 right-3 bottom-0 h-[2px] rounded-full bg-white/[0.06] overflow-hidden">
      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${(progress || 0) * 100}%` }} />
    </div>
  )
}

export function MiniPlayer({ onOpen }) {
  const { currentTrack, isPlaying, togglePlay, skipNext, skipPrev } = usePlayer()
  const touch = useRef(null)
  const [dx, setDx] = useState(0)
  if (!currentTrack) return null
  const art = trackArt(currentTrack)

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
        className="relative h-[62px] rounded-2xl flex items-center gap-3 pl-2 pr-2 bg-surface-800 border border-white/8
                   shadow-xl shadow-black/60 overflow-hidden">
        {/* Cover glow (the StudioPanel's blurred art layer) */}
        {art && <img src={art} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover blur-2xl scale-150 opacity-[0.18] pointer-events-none" />}

        <div className="relative flex items-center gap-3 flex-1 min-w-0 transition-transform"
          style={{ transform: `translateX(${dx * 0.4}px)`, transitionDuration: dx ? '0ms' : '200ms' }}>
          <Cover track={currentTrack} size={44} rounded="rounded-lg" className="shadow-md shadow-black/40" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-white truncate leading-snug">{currentTrack.title}</p>
            <p className="text-[12px] text-white/45 truncate leading-snug mt-0.5">{currentTrack.artist}</p>
          </div>
          <VUBars playing={isPlaying} bars={4} height={12} className="mr-1" />
        </div>
        <button onClick={e => { e.stopPropagation(); togglePlay() }} aria-label={isPlaying ? 'Pausar' : 'Tocar'}
          className="relative w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white shrink-0
                     shadow-lg shadow-brand-600/25 active:scale-90 transition-transform">
          {isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="ml-0.5" />}
        </button>
        <Progress />
      </div>
    </div>
  )
}

const TABS = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'search', label: 'Buscar', icon: Search },
  { id: 'library', label: 'Biblioteca', icon: Library },
]

// Tab bar with the desktop NavRail language: amber pill + indicator on the active tab
export function TabBar({ tab, onTab }) {
  return (
    <nav className="flex items-start justify-around px-3 pt-1.5 bg-surface-900/95 backdrop-blur-md border-t border-white/[0.05]"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 10px)' }}>
      {TABS.map(t => {
        const active = tab === t.id
        return (
          <button key={t.id} onClick={() => onTab(t.id)} aria-current={active ? 'page' : undefined}
            className="relative flex-1 flex flex-col items-center gap-1 pt-1.5 pb-0.5 active:scale-95 transition-transform">
            {active && <span className="absolute top-[-6px] left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-b-full bg-brand-500" />}
            <span className={`w-14 h-8 rounded-xl flex items-center justify-center transition-colors
              ${active ? 'bg-brand-600/20 text-brand-400' : 'text-white/35'}`}>
              <t.icon size={21} strokeWidth={active ? 2.1 : 1.6} />
            </span>
            <span className={`text-[10px] tracking-wide ${active ? 'text-brand-300 font-semibold' : 'text-white/35'}`}>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

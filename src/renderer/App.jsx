import React, { Suspense, lazy, useEffect, useState } from 'react'
import TitleBar           from './components/TitleBar'
import NavRail            from './components/NavRail'
import StudioPanel        from './components/StudioPanel'
import UpdateBanner       from './components/UpdateBanner'
import LibraryPage        from './pages/LibraryPage'
import { PlayerProvider } from './store/PlayerContext'

// Library is the start page and stays in the main bundle; the rest load on first visit
const DownloadsPage      = lazy(() => import('./pages/DownloadsPage'))
const SettingsPage       = lazy(() => import('./pages/SettingsPage'))
const PlaylistsPage      = lazy(() => import('./pages/PlaylistsPage'))
const PlaylistDetailPage = lazy(() => import('./pages/PlaylistDetailPage'))
const CommunityPage      = lazy(() => import('./pages/CommunityPage'))
const UpdateLogsPage     = lazy(() => import('./pages/UpdateLogsPage'))
const NowPlayingModal    = lazy(() => import('./components/NowPlayingModal'))
import { AuthProvider }   from './contexts/AuthContext'
import { mediaSrc }       from './utils/covers'

function WallpaperLayer({ wallpaper }) {
  if (!wallpaper?.src) return null

  // Settings saved before 1.1.25 hold a file:// URL — mediaSrc converts it
  const src = mediaSrc(wallpaper.src)
  const isVideo = wallpaper.type === 'video'
  const mode = wallpaper.mode || 'normal'
  const mediaClass = `absolute inset-0 w-full h-full object-cover ${mode === 'blur' ? 'scale-105 blur-md' : ''} ${mode === 'transparent' ? 'opacity-35' : 'opacity-80'}`
  const overlayClass = mode === 'transparent'
    ? 'bg-surface-900/70'
    : mode === 'blur'
      ? 'bg-surface-900/45'
      : 'bg-surface-900/25'

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {isVideo ? (
        <video src={src} className={mediaClass} autoPlay muted loop playsInline />
      ) : (
        <img src={src} className={mediaClass} alt="" />
      )}
      <div className={`absolute inset-0 ${overlayClass}`} />
    </div>
  )
}

export default function App() {
  const [activePage,     setActivePage]     = useState('library')
  const [openedPlaylist, setOpenedPlaylist] = useState(null)
  const [showNowPlaying, setShowNowPlaying] = useState(false)
  const [wallpaper,      setWallpaper]      = useState(null)

  useEffect(() => {
    let alive = true
    async function loadWallpaper() {
      const next = await window.electron?.settings?.get?.('accountWallpaper').catch(() => null)
      if (alive) setWallpaper(next)
    }

    loadWallpaper()
    const handler = event => setWallpaper(event.detail || null)
    window.addEventListener('nianplay:wallpaper-updated', handler)
    return () => {
      alive = false
      window.removeEventListener('nianplay:wallpaper-updated', handler)
    }
  }, [])

  function handleOpenPlaylist(playlist) {
    setOpenedPlaylist(playlist)
    setActivePage('playlist-detail')
  }

  function handleBackFromPlaylist() {
    setOpenedPlaylist(null)
    setActivePage('playlists')
  }

  function renderPage() {
    switch (activePage) {
      case 'library':        return <LibraryPage />
      case 'downloads':      return <DownloadsPage />
      case 'community':      return <CommunityPage />
      case 'logs':           return <UpdateLogsPage />
      case 'settings':       return <SettingsPage />
      case 'playlists':      return <PlaylistsPage onOpenPlaylist={handleOpenPlaylist} />
      case 'playlist-detail':
        return openedPlaylist
          ? <PlaylistDetailPage playlist={openedPlaylist} onBack={handleBackFromPlaylist} />
          : <PlaylistsPage onOpenPlaylist={handleOpenPlaylist} />
      default:               return <LibraryPage />
    }
  }

  return (
    <AuthProvider>
      <PlayerProvider>
        <div className={`relative flex flex-col h-screen w-screen overflow-hidden bg-surface-900 ${wallpaper?.src ? 'has-wallpaper' : ''}`}>
          <WallpaperLayer wallpaper={wallpaper} />

          <div className="relative z-10 flex flex-col h-full min-h-0">
            <TitleBar />
            <UpdateBanner />

            {/* 3-column studio layout */}
            <div className="flex flex-1 overflow-hidden min-h-0">
              <NavRail activePage={activePage} onNavigate={setActivePage} />

              <main className="flex-1 overflow-hidden min-w-0">
                <Suspense fallback={null}>
                  {renderPage()}
                </Suspense>
              </main>

              <StudioPanel onOpenFullscreen={() => setShowNowPlaying(true)} />
            </div>
          </div>

          {showNowPlaying && (
            <Suspense fallback={null}>
              <NowPlayingModal onClose={() => setShowNowPlaying(false)} />
            </Suspense>
          )}
        </div>
      </PlayerProvider>
    </AuthProvider>
  )
}

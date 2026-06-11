import React, { useEffect, useState } from 'react'
import TitleBar           from './components/TitleBar'
import NavRail            from './components/NavRail'
import StudioPanel        from './components/StudioPanel'
import NowPlayingModal    from './components/NowPlayingModal'
import UpdateBanner       from './components/UpdateBanner'
import LibraryPage        from './pages/LibraryPage'
import DownloadsPage      from './pages/DownloadsPage'
import SettingsPage       from './pages/SettingsPage'
import PlaylistsPage      from './pages/PlaylistsPage'
import PlaylistDetailPage from './pages/PlaylistDetailPage'
import CommunityPage      from './pages/CommunityPage'
import UpdateLogsPage     from './pages/UpdateLogsPage'
import { PlayerProvider } from './store/PlayerContext'
import { AuthProvider }   from './contexts/AuthContext'

function WallpaperLayer({ wallpaper }) {
  if (!wallpaper?.src) return null

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
        <video src={wallpaper.src} className={mediaClass} autoPlay muted loop playsInline />
      ) : (
        <img src={wallpaper.src} className={mediaClass} alt="" />
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
                {renderPage()}
              </main>

              <StudioPanel onOpenFullscreen={() => setShowNowPlaying(true)} />
            </div>
          </div>

          {showNowPlaying && <NowPlayingModal onClose={() => setShowNowPlaying(false)} />}
        </div>
      </PlayerProvider>
    </AuthProvider>
  )
}

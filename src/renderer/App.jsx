import React, { useState } from 'react'
import TitleBar           from './components/TitleBar'
import Sidebar            from './components/Sidebar'
import PlayerBar          from './components/PlayerBar'
import NowPlayingModal    from './components/NowPlayingModal'
import UpdateBanner       from './components/UpdateBanner'
import LibraryPage        from './pages/LibraryPage'
import DownloadsPage      from './pages/DownloadsPage'
import SettingsPage       from './pages/SettingsPage'
import PlaylistsPage      from './pages/PlaylistsPage'
import PlaylistDetailPage from './pages/PlaylistDetailPage'
import { PlayerProvider } from './store/PlayerContext'
import { AuthProvider }   from './contexts/AuthContext'

export default function App() {
  const [activePage,     setActivePage]     = useState('library')
  const [openedPlaylist, setOpenedPlaylist] = useState(null)
  const [showNowPlaying, setShowNowPlaying] = useState(false)

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
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface-900">
          <TitleBar />
          <UpdateBanner />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar activePage={activePage} onNavigate={setActivePage} />
            <main className="flex-1 overflow-hidden">
              {renderPage()}
            </main>
          </div>
          <PlayerBar onOpenNowPlaying={() => setShowNowPlaying(true)} />
          {showNowPlaying && <NowPlayingModal onClose={() => setShowNowPlaying(false)} />}
        </div>
      </PlayerProvider>
    </AuthProvider>
  )
}

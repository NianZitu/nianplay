import React, { useState } from 'react'
import { Library, Download, Settings, Disc3, ListMusic, LogIn, LogOut, User, UploadCloud, DownloadCloud, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import LoginModal from './LoginModal'

const NAV = [
  { id: 'library',   label: 'Biblioteca',    icon: Library },
  { id: 'playlists', label: 'Playlists',      icon: ListMusic },
  { id: 'downloads', label: 'Downloads',     icon: Download },
  { id: 'settings',  label: 'Configurações', icon: Settings },
]

export default function Sidebar({ activePage, onNavigate }) {
  const { user, logout, syncToCloud, syncFromCloud, syncStatus } = useAuth() || {}
  const [showLogin, setShowLogin] = useState(false)
  const [syncMenu,  setSyncMenu]  = useState(false)

  const effectivePage = activePage === 'playlist-detail' ? 'playlists' : activePage
  const isSyncing = syncStatus?.uploading || syncStatus?.downloading

  async function handleLogout() {
    setSyncMenu(false)
    await logout?.()
  }

  return (
    <>
      <aside className="w-56 flex flex-col bg-surface-800 border-r border-white/5 shrink-0">
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = effectivePage === id
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 w-full text-left
                  ${active
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/20'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent'
                  }`}
              >
                <Icon size={17} className={active ? 'text-brand-400' : ''} />
                {label}
              </button>
            )
          })}
        </nav>

        {/* User / login section */}
        <div className="p-3 border-t border-white/5 flex flex-col gap-2">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setSyncMenu(v => !v)}
                className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-full bg-brand-600/40 border border-brand-500/30 flex items-center justify-center shrink-0">
                  <User size={13} className="text-brand-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white/80 text-xs font-medium truncate">
                    {user.displayName || user.email?.split('@')[0]}
                  </div>
                  <div className="text-white/30 text-[10px] truncate">{user.email}</div>
                </div>
                {isSyncing && <Loader2 size={12} className="text-brand-400 animate-spin shrink-0" />}
              </button>

              {syncMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface-700 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                  <button
                    onClick={() => { syncToCloud?.(); setSyncMenu(false) }}
                    disabled={isSyncing}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    <UploadCloud size={13} className="text-brand-400" />
                    Enviar para nuvem
                  </button>
                  <button
                    onClick={() => { syncFromCloud?.(); setSyncMenu(false) }}
                    disabled={isSyncing}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    <DownloadCloud size={13} className="text-brand-400" />
                    Baixar da nuvem
                  </button>
                  <div className="border-t border-white/5" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors"
                  >
                    <LogOut size={13} />
                    Sair da conta
                  </button>
                </div>
              )}

              {syncStatus?.error && (
                <p className="text-red-400 text-[10px] px-2 mt-1 truncate">{syncStatus.error}</p>
              )}
              {syncStatus?.lastSync && !isSyncing && (
                <p className="text-white/25 text-[10px] px-2 mt-0.5">
                  Sincronizado às {new Date(syncStatus.lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 border border-white/5 transition-all text-xs"
            >
              <LogIn size={14} />
              Entrar / Criar conta
            </button>
          )}

          <div className="flex items-center gap-2 text-white/20 px-1">
            <Disc3 size={14} />
            <span className="text-xs">v1.0.0</span>
          </div>
        </div>
      </aside>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {syncMenu && <div className="fixed inset-0 z-40" onClick={() => setSyncMenu(false)} />}
    </>
  )
}

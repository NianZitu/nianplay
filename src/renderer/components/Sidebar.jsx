import React, { useEffect, useState } from 'react'
import {
  Library, Download, Settings, Disc3, ListMusic,
  LogIn, LogOut, User, UploadCloud, DownloadCloud,
  Loader2, Users, History,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import LoginModal from './LoginModal'

const NAV = [
  { id: 'library',   label: 'Biblioteca',    icon: Library },
  { id: 'playlists', label: 'Playlists',      icon: ListMusic },
  { id: 'community', label: 'Comunidade',     icon: Users },
  { id: 'downloads', label: 'Downloads',      icon: Download },
  { id: 'logs',      label: 'Atualizações',   icon: History },
  { id: 'settings',  label: 'Configurações',  icon: Settings },
]

const FRAME_STYLE = {
  classic: { border: '#d97706', glow: '' },
  neon:    { border: '#22d3ee', glow: '0 0 10px rgba(34,211,238,0.5)' },
  sunset:  { border: '#fb7185', glow: '0 0 10px rgba(251,113,133,0.4)' },
  mint:    { border: '#34d399', glow: '0 0 10px rgba(52,211,153,0.4)' },
}

export default function Sidebar({ activePage, onNavigate }) {
  const { user, accountProfile, logout, syncToCloud, syncFromCloud, syncStatus } = useAuth() || {}
  const [showLogin, setShowLogin] = useState(false)
  const [syncMenu,  setSyncMenu]  = useState(false)
  const [version,   setVersion]   = useState('')

  const effectivePage = activePage === 'playlist-detail' ? 'playlists' : activePage
  const isSyncing     = syncStatus?.uploading || syncStatus?.downloading
  const avatar        = accountProfile?.avatarDataUrl || ''
  const displayName   = accountProfile?.displayName || user?.displayName || user?.email?.split('@')[0]
  const frameKey      = accountProfile?.frame || 'classic'
  const frame         = FRAME_STYLE[frameKey] || FRAME_STYLE.classic

  useEffect(() => {
    window.electron?.app?.getVersion?.().then(setVersion).catch(() => {})
  }, [])

  async function handleLogout() {
    setSyncMenu(false)
    await logout?.()
  }

  return (
    <>
      <aside className="relative z-50 w-52 m-2.5 mr-0 rounded-2xl flex flex-col shrink-0 overflow-hidden
                        bg-surface-800/95 border border-white/6 backdrop-blur-md">

        {/* Navegação */}
        <nav className="flex flex-col gap-0.5 p-2.5 flex-1 pt-3">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = effectivePage === id
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                            transition-all duration-150 w-full text-left group
                            ${active
                              ? 'bg-brand-600/18 text-brand-400'
                              : 'text-white/45 hover:text-white/80 hover:bg-white/5'
                            }`}
              >
                <Icon
                  size={16}
                  className={`shrink-0 transition-colors ${active ? 'text-brand-500' : 'text-white/30 group-hover:text-white/60'}`}
                />
                <span className="truncate">{label}</span>
                {active && (
                  <div className="ml-auto w-1 h-4 rounded-full bg-brand-500 shrink-0" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Área do usuário */}
        <div className="p-2.5 border-t border-white/5 flex flex-col gap-1.5">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setSyncMenu(v => !v)}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl
                           hover:bg-white/5 transition-colors text-left"
              >
                {/* Avatar com moldura */}
                <div
                  className="w-8 h-8 rounded-full p-0.5 shrink-0 flex items-center justify-center"
                  style={{
                    border: `2px solid ${frame.border}`,
                    boxShadow: frame.glow,
                  }}
                >
                  <div className="w-full h-full rounded-full bg-surface-600 overflow-hidden flex items-center justify-center">
                    {avatar
                      ? <img src={avatar} alt="Perfil" className="w-full h-full object-cover" />
                      : <User size={12} className="text-brand-400" />
                    }
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-white/80 text-xs font-semibold truncate leading-tight">
                    {displayName}
                  </div>
                  <div className="text-white/25 text-[10px] truncate">{user.email}</div>
                </div>
                {isSyncing && <Loader2 size={11} className="text-brand-500 animate-spin shrink-0" />}
              </button>

              {/* Menu de sincronização */}
              {syncMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-surface-700 border border-white/10
                                rounded-xl shadow-xl overflow-hidden z-[80] slide-up">
                  <button
                    onClick={() => { syncToCloud?.(); setSyncMenu(false) }}
                    disabled={isSyncing}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs text-white/65
                               hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
                  >
                    <UploadCloud size={13} className="text-accent-500" />
                    Enviar para nuvem
                  </button>
                  <button
                    onClick={() => { syncFromCloud?.(); setSyncMenu(false) }}
                    disabled={isSyncing}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs text-white/65
                               hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
                  >
                    <DownloadCloud size={13} className="text-accent-500" />
                    Baixar da nuvem
                  </button>
                  <div className="border-t border-white/6" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs
                               text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors"
                  >
                    <LogOut size={13} />
                    Sair da conta
                  </button>
                </div>
              )}

              {syncStatus?.error && (
                <p className="text-red-400 text-[10px] px-3 mt-0.5 truncate">{syncStatus.error}</p>
              )}
              {syncStatus?.lastSync && !isSyncing && (
                <p className="text-white/20 text-[10px] px-3 mt-0.5">
                  Sincronizado às {new Date(syncStatus.lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl
                         text-white/35 hover:text-white/70 hover:bg-white/5
                         border border-white/6 transition-all text-xs"
            >
              <LogIn size={13} />
              Entrar / Criar conta
            </button>
          )}

          <div className="flex items-center gap-1.5 text-white/18 px-1.5 pb-0.5">
            <Disc3 size={11} />
            <span className="text-[10px] font-medium tracking-wide">v{version || '—'}</span>
          </div>
        </div>
      </aside>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {syncMenu  && <div className="fixed inset-0 z-30" onClick={() => setSyncMenu(false)} />}
    </>
  )
}

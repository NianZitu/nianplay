import React, { useState, useEffect } from 'react'
import {
  Library, Download, Settings, Disc3, ListMusic, Users, History,
  LogIn, User, UploadCloud, DownloadCloud, LogOut, Loader2,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import LoginModal from './LoginModal'

const NAV = [
  { id: 'library',   icon: Library,   label: 'Biblioteca' },
  { id: 'playlists', icon: ListMusic,  label: 'Playlists' },
  { id: 'community', icon: Users,      label: 'Comunidade' },
  { id: 'downloads', icon: Download,   label: 'Downloads' },
  { id: 'logs',      icon: History,    label: 'Atualizações' },
  { id: 'settings',  icon: Settings,   label: 'Configurações' },
]

const FRAME_STYLE = {
  classic: { border: '#d97706', glow: '0 0 8px rgba(217,119,6,0.35)' },
  neon:    { border: '#22d3ee', glow: '0 0 8px rgba(34,211,238,0.5)' },
  sunset:  { border: '#fb7185', glow: '0 0 8px rgba(251,113,133,0.4)' },
  mint:    { border: '#34d399', glow: '0 0 8px rgba(52,211,153,0.4)' },
}

function Tooltip({ children, label }) {
  const [visible, setVisible] = useState(false)
  return (
    <div
      className="relative"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-[300]
                        bg-surface-600 border border-white/10 text-white/85 text-xs
                        px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-xl pointer-events-none">
          {label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-surface-600" />
        </div>
      )}
    </div>
  )
}

export default function NavRail({ activePage, onNavigate }) {
  const { user, accountProfile, logout, syncToCloud, syncFromCloud, syncStatus } = useAuth() || {}
  const [showLogin, setShowLogin]   = useState(false)
  const [syncMenu,  setSyncMenu]    = useState(false)
  const [version,   setVersion]     = useState('')

  const effectivePage = activePage === 'playlist-detail' ? 'playlists' : activePage
  const isSyncing     = syncStatus?.uploading || syncStatus?.downloading
  const avatar        = accountProfile?.avatarDataUrl || ''
  const frameKey      = accountProfile?.frame || 'classic'
  const frame         = FRAME_STYLE[frameKey] || FRAME_STYLE.classic
  const displayName   = accountProfile?.displayName || user?.displayName || user?.email?.split('@')[0]

  useEffect(() => {
    window.electron?.app?.getVersion?.().then(setVersion).catch(() => {})
  }, [])

  return (
    <>
      <aside className="relative z-50 flex flex-col items-center w-14 shrink-0
                        bg-surface-900 border-r border-white/[0.04]">

        {/* Logo */}
        <div className="h-8 flex items-center justify-center shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#d97706" strokeWidth="1.5" fill="none" />
            <circle cx="12" cy="12" r="5"  stroke="#d97706" strokeWidth="1"   fill="none" strokeOpacity="0.45" />
            <circle cx="12" cy="12" r="2"  fill="#d97706" />
          </svg>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-0.5 flex-1 pt-4 w-full px-2">
          {NAV.map(({ id, icon: Icon, label }) => {
            const active = effectivePage === id
            return (
              <Tooltip key={id} label={label}>
                <button
                  onClick={() => onNavigate(id)}
                  className={`relative w-full h-10 rounded-xl flex items-center justify-center transition-all duration-150
                    ${active
                      ? 'bg-brand-600/20 text-brand-400'
                      : 'text-white/22 hover:text-white/60 hover:bg-white/5'}`}
                >
                  <Icon size={17} strokeWidth={active ? 2 : 1.5} />
                  {active && (
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-500 rounded-l-full" />
                  )}
                </button>
              </Tooltip>
            )
          })}
        </nav>

        {/* Version */}
        <div className="pb-1">
          <p className="text-[9px] text-white/12 tabular-nums text-center">{version || '—'}</p>
        </div>

        {/* User */}
        <div className="w-full px-2 pb-3 flex flex-col items-center gap-1">
          <div className="w-full h-px bg-white/[0.04] mb-2" />
          {user ? (
            <Tooltip label={displayName || 'Conta'}>
              <div className="relative">
                <button
                  onClick={() => setSyncMenu(v => !v)}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105"
                  style={{ border: `2px solid ${frame.border}`, boxShadow: frame.glow }}
                >
                  <div className="w-full h-full rounded-full bg-surface-600 overflow-hidden flex items-center justify-center">
                    {avatar
                      ? <img src={avatar} alt="" className="w-full h-full object-cover" />
                      : <User size={13} className="text-brand-400" />
                    }
                  </div>
                  {isSyncing && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-surface-900 rounded-full
                                     flex items-center justify-center border border-surface-900">
                      <Loader2 size={8} className="text-brand-500 animate-spin" />
                    </span>
                  )}
                </button>

                {syncMenu && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48
                                  bg-surface-700 border border-white/10 rounded-xl shadow-2xl
                                  overflow-hidden z-[300] slide-up">
                    <div className="px-3 py-2 border-b border-white/6">
                      <p className="text-white/70 text-xs font-semibold truncate">{displayName}</p>
                      <p className="text-white/25 text-[10px] truncate">{user.email}</p>
                    </div>
                    <button onClick={() => { syncToCloud?.(); setSyncMenu(false) }} disabled={isSyncing}
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-white/60
                                 hover:text-white hover:bg-white/5 disabled:opacity-40 transition-colors">
                      <UploadCloud size={12} className="text-accent-500" /> Enviar para nuvem
                    </button>
                    <button onClick={() => { syncFromCloud?.(); setSyncMenu(false) }} disabled={isSyncing}
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-white/60
                                 hover:text-white hover:bg-white/5 disabled:opacity-40 transition-colors">
                      <DownloadCloud size={12} className="text-accent-500" /> Baixar da nuvem
                    </button>
                    <div className="border-t border-white/6" />
                    <button onClick={async () => { setSyncMenu(false); await logout?.() }}
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-xs
                                 text-red-400 hover:bg-white/5 transition-colors">
                      <LogOut size={12} /> Sair da conta
                    </button>
                  </div>
                )}
              </div>
            </Tooltip>
          ) : (
            <Tooltip label="Entrar / Criar conta">
              <button
                onClick={() => setShowLogin(true)}
                className="w-9 h-9 rounded-xl flex items-center justify-center
                           text-white/20 hover:text-white/60 hover:bg-white/5
                           border border-white/8 transition-all"
              >
                <LogIn size={15} />
              </button>
            </Tooltip>
          )}
        </div>
      </aside>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {syncMenu  && <div className="fixed inset-0 z-40" onClick={() => setSyncMenu(false)} />}
    </>
  )
}

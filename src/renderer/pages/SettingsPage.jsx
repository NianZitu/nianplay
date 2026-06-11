import React, { useState, useEffect } from 'react'
import {
  Save, FolderOpen, Info, Cookie, AlertTriangle, CheckCircle, Youtube,
  RefreshCw, Download, CheckCircle2, Loader2, Camera, UserRound, Sparkles,
  Image as ImageIcon, Video, Ban,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getUpdateLogByVersion } from '../data/updateLogs'

const BROWSERS = [
  { value: 'auto',    label: 'Auto-detectar' },
  { value: 'firefox', label: 'Firefox (recomendado)' },
  { value: 'edge',    label: 'Edge' },
  { value: 'chrome',  label: 'Chrome' },
  { value: 'brave',   label: 'Brave' },
  { value: 'none',    label: 'Nenhum' },
]

const FRAME_OPTIONS = [
  { id: 'classic', label: 'Clássica', border: '#d97706', glow: '' },
  { id: 'neon',    label: 'Neon',     border: '#22d3ee', glow: '0 0 14px rgba(34,211,238,0.4)' },
  { id: 'sunset',  label: 'Sunset',   border: '#fb7185', glow: '0 0 14px rgba(251,113,133,0.35)' },
  { id: 'mint',    label: 'Mint',     border: '#34d399', glow: '0 0 14px rgba(52,211,153,0.3)' },
]

const WALLPAPER_MODES = [
  { id: 'normal',      label: 'Normal' },
  { id: 'blur',        label: 'Borrado' },
  { id: 'transparent', label: 'Transparente' },
]

function parseReleaseNotes(notes) {
  if (!notes) return []
  const raw = Array.isArray(notes)
    ? notes.map(n => n.note || n.version || '').join('\n')
    : String(notes)
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map(line => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 8)
}

function isGenericReleaseNote(line) {
  const t = (line || '').toLowerCase().trim()
  return t === 'nova versao do nianplay.' || t === 'nova versao do nianplay'
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const size   = 256
        const canvas = document.createElement('canvas')
        canvas.width = size; canvas.height = size
        const ctx    = canvas.getContext('2d')
        const scale  = Math.max(size / img.width, size / img.height)
        const w = img.width * scale, h = img.height * scale
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.86))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

function SectionHeader({ icon: Icon, children, color = 'text-brand-500' }) {
  return (
    <div className="flex items-center gap-2 pb-4 border-b border-white/6 mb-1">
      <Icon size={14} className={`shrink-0 ${color}`} />
      <h2 className="text-sm font-bold text-white/85">{children}</h2>
    </div>
  )
}

function Toggle({ value, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        onClick={() => onChange(!value)}
        className={`w-9 h-5 rounded-full transition-colors relative shrink-0
          ${value ? 'bg-brand-600' : 'bg-white/15'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow
          ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-sm text-white/65">{label}</span>
    </label>
  )
}

export default function SettingsPage() {
  const { user, accountProfile, updateAccountProfile } = useAuth() || {}
  const [libraryPath,          setLibraryPath]          = useState('')
  const [downloadPath,         setDownloadPath]         = useState('')
  const [autoScan,             setAutoScan]             = useState(false)
  const [cookieBrowser,        setCookieBrowser]        = useState('auto')
  const [cookiesFile,          setCookiesFile]          = useState('')
  const [youtubeClientId,      setYoutubeClientId]      = useState('')
  const [youtubeClientSecret,  setYoutubeClientSecret]  = useState('')
  const [youtubeRefreshToken,  setYoutubeRefreshToken]  = useState('')
  const [appVersion,           setAppVersion]           = useState('')
  const [updateInfo,           setUpdateInfo]           = useState(null)
  const [updatePhase,          setUpdatePhase]          = useState('idle')
  const [updateMessage,        setUpdateMessage]        = useState('')
  const [updateProgress,       setUpdateProgress]       = useState(0)
  const [profileName,          setProfileName]          = useState('')
  const [profileAvatar,        setProfileAvatar]        = useState('')
  const [profileFrame,         setProfileFrame]         = useState('classic')
  const [wallpaperSrc,         setWallpaperSrc]         = useState('')
  const [wallpaperType,        setWallpaperType]        = useState('')
  const [wallpaperMode,        setWallpaperMode]        = useState('normal')
  const [saved,                setSaved]                = useState(false)

  const isElectron = !!window.electron

  useEffect(() => {
    if (!isElectron) return
    window.electron.settings.getAll().then(all => {
      setLibraryPath(all.libraryPath || '')
      setDownloadPath(all.downloadPath || '')
      setAutoScan(all.autoScan || false)
      setCookieBrowser(all.cookieBrowser || 'auto')
      setCookiesFile(all.cookiesFile || '')
      setYoutubeClientId(all.youtubeClientId || '')
      setYoutubeClientSecret(all.youtubeClientSecret || '')
      setYoutubeRefreshToken(all.youtubeRefreshToken || '')
      setWallpaperSrc(all.accountWallpaper?.src || '')
      setWallpaperType(all.accountWallpaper?.type || '')
      setWallpaperMode(all.accountWallpaper?.mode || 'normal')
    })
    window.electron.app?.getVersion?.().then(setAppVersion).catch(() => {})
  }, [])

  useEffect(() => {
    setProfileName(accountProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || '')
    setProfileAvatar(accountProfile?.avatarDataUrl || '')
    setProfileFrame(accountProfile?.frame || 'classic')
  }, [accountProfile, user])

  useEffect(() => {
    if (!window.electron?.updater) return
    const unsubs = [
      window.electron.updater.onAvailable(info => {
        setUpdateInfo(info)
        setUpdatePhase('available')
        setUpdateMessage(`Nova versão ${info.version} disponível`)
      }),
      window.electron.updater.onProgress(p => {
        setUpdatePhase('downloading')
        setUpdateProgress(p.percent ?? 0)
      }),
      window.electron.updater.onDownloaded(() => {
        setUpdatePhase('downloaded')
        setUpdateMessage('Atualização pronta para instalar')
      }),
      window.electron.updater.onError(msg => {
        setUpdatePhase('error')
        setUpdateMessage(typeof msg === 'string' ? msg : 'Erro ao verificar atualização')
      }),
    ]
    return () => unsubs.forEach(u => u?.())
  }, [])

  async function handleCheckUpdate() {
    if (!window.electron?.updater) return
    setUpdatePhase('checking')
    setUpdateMessage('Verificando atualização...')
    await window.electron.updater.check()
    setTimeout(() => {
      setUpdatePhase(p  => p  === 'checking'                    ? 'idle' : p)
      setUpdateMessage(m => m === 'Verificando atualização...'  ? 'Nenhuma atualização encontrada agora.' : m)
    }, 5000)
  }

  function handleDownloadUpdate() {
    setUpdatePhase('downloading')
    setUpdateProgress(0)
    window.electron.updater.download()
  }

  function handleInstallUpdate() {
    window.electron.updater.install()
  }

  async function handleSave() {
    if (!isElectron) return
    await window.electron.settings.set('libraryPath',          libraryPath)
    await window.electron.settings.set('downloadPath',         downloadPath)
    await window.electron.settings.set('autoScan',             autoScan)
    await window.electron.settings.set('cookieBrowser',        cookieBrowser)
    await window.electron.settings.set('cookiesFile',          cookiesFile)
    await window.electron.settings.set('youtubeClientId',      youtubeClientId.trim())
    await window.electron.settings.set('youtubeClientSecret',  youtubeClientSecret.trim())
    await window.electron.settings.set('youtubeRefreshToken',  youtubeRefreshToken.trim())
    await updateAccountProfile?.({
      displayName:   profileName,
      avatarDataUrl: profileAvatar,
      frame:         profileFrame,
    })
    const wallpaper = wallpaperSrc
      ? { src: wallpaperSrc, type: wallpaperType || 'image', mode: wallpaperMode || 'normal' }
      : null
    await window.electron.appearance?.setWallpaper?.(wallpaper)
    window.dispatchEvent(new CustomEvent('nianplay:wallpaper-updated', { detail: wallpaper }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleAvatarFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await resizeImage(file)
    setProfileAvatar(dataUrl)
    e.target.value = ''
  }

  async function applyWallpaper(next) {
    await window.electron.appearance?.setWallpaper?.(next)
    setWallpaperSrc(next?.src || '')
    setWallpaperType(next?.type || '')
    setWallpaperMode(next?.mode || 'normal')
    window.dispatchEvent(new CustomEvent('nianplay:wallpaper-updated', { detail: next || null }))
  }

  async function chooseWallpaper(kind) {
    if (!isElectron) return
    const picked = await window.electron.appearance?.chooseWallpaper?.(kind)
    if (!picked || picked.error) return
    await applyWallpaper({ ...picked, mode: wallpaperMode || picked.mode || 'normal' })
  }

  async function changeWallpaperMode(mode) {
    setWallpaperMode(mode)
    if (!wallpaperSrc) return
    await applyWallpaper({ src: wallpaperSrc, type: wallpaperType || 'image', mode })
  }

  async function removeWallpaper() { await applyWallpaper(null) }

  async function pickFolder(setter) {
    if (!isElectron) return
    const dir = await window.electron.dialog.openFolder()
    if (dir) setter(dir)
  }

  const showDpapiWarning = cookieBrowser === 'edge' || cookieBrowser === 'chrome'
  const parsedNotes  = parseReleaseNotes(updateInfo?.notes)
  const fallbackLog  = getUpdateLogByVersion(updateInfo?.version)
  const updateNotes  = (!parsedNotes.length || parsedNotes.every(isGenericReleaseNote))
    ? (fallbackLog?.changes || [])
    : parsedNotes

  const currentFrame = FRAME_OPTIONS.find(f => f.id === profileFrame) || FRAME_OPTIONS[0]

  return (
    <div className="h-full overflow-y-auto p-2.5 pl-3">
      <div className="max-w-xl mx-auto flex flex-col gap-4 pb-8">

        {/* Cabeçalho */}
        <div className="pt-3">
          <h1 className="text-base font-bold text-white tracking-tight">Configurações</h1>
          <p className="text-xs text-white/35 mt-0.5">Preferências do NianPlay</p>
        </div>

        {/* ── Perfil ── */}
        <section className="panel p-5 flex flex-col gap-5 rounded-2xl">
          <SectionHeader icon={UserRound}>Perfil</SectionHeader>

          {!user && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2.5 text-xs text-amber-200/80 leading-relaxed">
              Entre em uma conta para sincronizar nome, foto e moldura na nuvem.
            </div>
          )}

          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div
              className="w-20 h-20 rounded-full p-1 shrink-0"
              style={{ border: `3px solid ${currentFrame.border}`, boxShadow: currentFrame.glow }}
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-surface-600 flex items-center justify-center">
                {profileAvatar
                  ? <img src={profileAvatar} alt="Foto de perfil" className="w-full h-full object-cover" />
                  : <UserRound size={26} className="text-white/30" />
                }
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <label className="text-[11px] text-white/35 font-bold uppercase tracking-wider mb-1.5 block">
                Nome público
              </label>
              <input
                type="text"
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                placeholder="Seu nome no NianPlay"
                className="input-base w-full text-sm"
                maxLength={40}
              />
              <div className="flex gap-2 mt-2">
                <label className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-2 cursor-pointer">
                  <Camera size={12} /> Trocar foto
                  <input type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
                </label>
                {profileAvatar && (
                  <button onClick={() => setProfileAvatar('')} className="btn-ghost text-xs px-3 py-1.5 text-white/40">
                    Remover
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Molduras */}
          <div>
            <label className="text-[11px] text-white/35 font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 block">
              <Sparkles size={11} /> Moldura
            </label>
            <div className="grid grid-cols-4 gap-2">
              {FRAME_OPTIONS.map(frame => (
                <button
                  key={frame.id}
                  onClick={() => setProfileFrame(frame.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all
                    ${profileFrame === frame.id
                      ? 'bg-brand-600/15 border-brand-500/40 text-white'
                      : 'border-white/6 text-white/40 hover:text-white/70 hover:bg-white/4'
                    }`}
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0 border-2"
                    style={{ borderColor: frame.border, boxShadow: frame.glow }}
                  />
                  {frame.label}
                </button>
              ))}
            </div>
          </div>

          {/* Wallpaper */}
          <div className="border-t border-white/6 pt-4">
            <label className="text-[11px] text-white/35 font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5 block">
              <ImageIcon size={11} /> Wallpaper
            </label>

            <div className="aspect-video rounded-xl overflow-hidden bg-surface-700 border border-white/6 mb-3">
              {wallpaperSrc ? (
                wallpaperType === 'video'
                  ? <video src={wallpaperSrc} className={`w-full h-full object-cover ${wallpaperMode === 'blur' ? 'blur-sm scale-105' : ''} ${wallpaperMode === 'transparent' ? 'opacity-45' : ''}`} muted loop autoPlay playsInline />
                  : <img   src={wallpaperSrc} className={`w-full h-full object-cover ${wallpaperMode === 'blur' ? 'blur-sm scale-105' : ''} ${wallpaperMode === 'transparent' ? 'opacity-45' : ''}`} alt="Wallpaper" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-white/15 gap-2">
                  <ImageIcon size={26} strokeWidth={1.2} />
                  <span className="text-xs">Nenhum wallpaper selecionado</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              <button onClick={() => chooseWallpaper('image')} className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5">
                <ImageIcon size={12} /> Foto
              </button>
              <button onClick={() => chooseWallpaper('video')} className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5">
                <Video size={12} /> Vídeo
              </button>
              {wallpaperSrc && (
                <button onClick={removeWallpaper} className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 text-white/35">
                  <Ban size={12} /> Remover
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {WALLPAPER_MODES.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => changeWallpaperMode(mode.id)}
                  className={`py-2 rounded-xl border text-xs font-medium transition-all
                    ${wallpaperMode === mode.id
                      ? 'bg-brand-600/15 border-brand-500/40 text-white'
                      : 'border-white/6 text-white/40 hover:text-white/70 hover:bg-white/4'
                    }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Biblioteca ── */}
        <section className="panel p-5 flex flex-col gap-4 rounded-2xl">
          <SectionHeader icon={FolderOpen}>Biblioteca</SectionHeader>

          <div>
            <label className="text-[11px] text-white/35 font-bold uppercase tracking-wider mb-1.5 block">
              Pasta da biblioteca
            </label>
            <div className="flex gap-2">
              <input
                type="text" value={libraryPath}
                onChange={e => setLibraryPath(e.target.value)}
                placeholder="Selecione a pasta padrão das suas músicas"
                className="input-base flex-1 text-sm"
              />
              <button onClick={() => pickFolder(setLibraryPath)} className="btn-ghost p-2">
                <FolderOpen size={15} />
              </button>
            </div>
          </div>

          <Toggle
            value={autoScan}
            onChange={setAutoScan}
            label="Escanear automaticamente ao iniciar"
          />
        </section>

        {/* ── Downloads ── */}
        <section className="panel p-5 flex flex-col gap-4 rounded-2xl">
          <SectionHeader icon={Download}>Downloads</SectionHeader>

          <div>
            <label className="text-[11px] text-white/35 font-bold uppercase tracking-wider mb-1.5 block">
              Pasta padrão de download
            </label>
            <div className="flex gap-2">
              <input
                type="text" value={downloadPath}
                onChange={e => setDownloadPath(e.target.value)}
                placeholder="Padrão: pasta Downloads do sistema"
                className="input-base flex-1 text-sm"
              />
              <button onClick={() => pickFolder(setDownloadPath)} className="btn-ghost p-2">
                <FolderOpen size={15} />
              </button>
            </div>
          </div>

          {/* Cookies */}
          <div className="flex flex-col gap-3">
            <label className="text-[11px] text-white/35 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Cookie size={11} /> Autenticação YouTube (anti-bot)
            </label>

            {/* Opção 1: cookies.txt */}
            <div className="bg-surface-700/40 rounded-xl p-3.5 flex flex-col gap-2 border border-white/5">
              <p className="text-xs text-white/65 font-semibold flex items-center gap-1.5">
                Opção 1 — Arquivo cookies.txt
                <span className="badge badge-brand">Recomendado</span>
              </p>
              <p className="text-xs text-white/30 leading-relaxed">
                Exporte seus cookies do YouTube com a extensão
                <span className="text-brand-400 mx-1">"Get cookies.txt LOCALLY"</span>
                e cole o caminho do arquivo abaixo.
              </p>
              <input
                type="text"
                value={cookiesFile}
                onChange={e => setCookiesFile(e.target.value.trim().replace(/^["']|["']$/g, ''))}
                placeholder={`Ex: C:\\Users\\seu-nome\\Downloads\\youtube.com_cookies.txt`}
                className="input-base text-xs"
              />
              {cookiesFile && (
                <p className="text-xs text-green-400 flex items-center gap-1.5">
                  <CheckCircle size={11} /> Arquivo configurado — terá prioridade sobre o browser
                </p>
              )}
            </div>

            {/* Opção 2: browser */}
            <div className="bg-surface-700/40 rounded-xl p-3.5 flex flex-col gap-2.5 border border-white/5">
              <p className="text-xs text-white/65 font-semibold">Opção 2 — Cookies do browser</p>
              <div className="flex flex-wrap gap-2">
                {BROWSERS.map(b => (
                  <button
                    key={b.value}
                    onClick={() => setCookieBrowser(b.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border
                      ${cookieBrowser === b.value
                        ? 'bg-brand-600/20 border-brand-500/40 text-brand-300'
                        : 'border-white/6 text-white/40 hover:text-white/70 hover:bg-white/4'
                      }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              {showDpapiWarning && (
                <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2.5">
                  <AlertTriangle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300 leading-relaxed">
                    <strong>Chrome e Edge 127+</strong> usam criptografia DPAPI que bloqueia o yt-dlp.
                    Se aparecer erro "Failed to decrypt", use <strong>Firefox</strong> ou o arquivo cookies.txt.
                  </p>
                </div>
              )}

              {cookieBrowser === 'none' && (
                <p className="text-xs text-amber-400/75 leading-relaxed">
                  Sem cookies, o YouTube pode bloquear downloads com "Sign in to confirm you're not a bot".
                </p>
              )}

              {cookieBrowser === 'firefox' && (
                <p className="text-xs text-green-400/80 flex items-center gap-1.5">
                  <CheckCircle size={11} /> Firefox é compatível com yt-dlp sem restrições DPAPI.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── YouTube OAuth ── */}
        <section className="panel p-5 flex flex-col gap-4 rounded-2xl">
          <SectionHeader icon={Youtube} color="text-red-400">Exportar playlists para YouTube</SectionHeader>

          <div className="bg-surface-700/40 rounded-xl p-3 border border-white/5 text-xs text-white/30 leading-relaxed">
            Use credenciais OAuth do Google com escopo <span className="text-white/55">youtube.force-ssl</span>.
            O NianPlay cria uma playlist no seu canal e adiciona os vídeos usando os links salvos nos metadados das músicas.
          </div>

          <div>
            <label className="text-[11px] text-white/35 font-bold uppercase tracking-wider mb-1.5 block">Client ID</label>
            <input type="text" value={youtubeClientId} onChange={e => setYoutubeClientId(e.target.value)}
              placeholder="Client ID do OAuth" className="input-base w-full text-xs" />
          </div>
          <div>
            <label className="text-[11px] text-white/35 font-bold uppercase tracking-wider mb-1.5 block">Client Secret</label>
            <input type="password" value={youtubeClientSecret} onChange={e => setYoutubeClientSecret(e.target.value)}
              placeholder="Client Secret" className="input-base w-full text-xs" />
          </div>
          <div>
            <label className="text-[11px] text-white/35 font-bold uppercase tracking-wider mb-1.5 block">Refresh Token</label>
            <input type="password" value={youtubeRefreshToken} onChange={e => setYoutubeRefreshToken(e.target.value)}
              placeholder="Refresh Token autorizado no YouTube" className="input-base w-full text-xs" />
          </div>
        </section>

        {/* ── Atualizações ── */}
        <section className="panel p-5 flex flex-col gap-4 rounded-2xl">
          <SectionHeader icon={RefreshCw}>Atualizações</SectionHeader>

          {updateMessage && (
            <p className={`text-xs ${
              updatePhase === 'error'      ? 'text-red-400'
              : updatePhase === 'downloaded' ? 'text-green-400'
              : 'text-white/40'
            }`}>
              {updateMessage}
            </p>
          )}

          {updateNotes.length > 0 && (
            <div className="rounded-xl border border-white/8 bg-surface-700/30 px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-white/25 font-bold mb-2">
                O que mudou na versão {updateInfo?.version}
              </p>
              <ul className="space-y-1.5">
                {updateNotes.map((note, i) => (
                  <li key={i} className="text-xs text-white/55 flex gap-2">
                    <span className="text-brand-500 shrink-0">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {updatePhase === 'downloading' && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${updateProgress}%` }} />
              </div>
              <span className="text-xs text-white/35 tabular-nums">{Math.round(updateProgress)}%</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCheckUpdate}
              disabled={updatePhase === 'checking' || updatePhase === 'downloading'}
              className="btn-ghost text-sm px-3 py-2 flex items-center gap-2 disabled:opacity-40"
            >
              {updatePhase === 'checking'
                ? <Loader2 size={13} className="animate-spin" />
                : <RefreshCw size={13} />
              }
              Verificar agora
            </button>
            {updatePhase === 'available' && (
              <button onClick={handleDownloadUpdate} className="btn-primary text-sm px-3 py-2 flex items-center gap-2">
                <Download size={13} /> Baixar atualização
              </button>
            )}
            {updatePhase === 'downloaded' && (
              <button onClick={handleInstallUpdate} className="btn-primary text-sm px-3 py-2 flex items-center gap-2">
                <CheckCircle2 size={13} /> Instalar e reiniciar
              </button>
            )}
          </div>
        </section>

        {/* ── Sobre ── */}
        <section className="panel p-5 flex flex-col gap-2 rounded-2xl">
          <SectionHeader icon={Info}>Sobre</SectionHeader>
          <div className="text-xs text-white/30 space-y-1.5 leading-relaxed">
            <p>NianPlay v{appVersion || '...'}</p>
            <p>Electron · React · Tailwind CSS</p>
            <p>Powered by yt-dlp &amp; ffmpeg</p>
          </div>
        </section>

        {/* Salvar */}
        <div className="flex justify-end pb-2">
          <button onClick={handleSave} className="btn-primary flex items-center gap-2">
            <Save size={14} />
            {saved ? 'Salvo ✓' : 'Salvar configurações'}
          </button>
        </div>
      </div>
    </div>
  )
}

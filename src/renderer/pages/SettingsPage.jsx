import React, { useState, useEffect } from 'react'
import { Save, FolderOpen, Info, Cookie, AlertTriangle, CheckCircle, Youtube, RefreshCw, Download, CheckCircle2, Loader2, Camera, UserRound, Sparkles } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const BROWSERS = [
  { value: 'auto',    label: 'Auto-detectar' },
  { value: 'firefox', label: 'Firefox ✓ recomendado' },
  { value: 'edge',    label: 'Edge' },
  { value: 'chrome',  label: 'Chrome' },
  { value: 'brave',   label: 'Brave' },
  { value: 'none',    label: 'Nenhum' },
]

const FRAME_OPTIONS = [
  { id: 'classic', label: 'Classica', className: 'border-brand-500/50 bg-brand-600/30' },
  { id: 'neon', label: 'Neon', className: 'border-cyan-300 bg-cyan-400/20 shadow-[0_0_16px_rgba(34,211,238,0.35)]' },
  { id: 'sunset', label: 'Sunset', className: 'border-rose-300 bg-amber-400/20 shadow-[0_0_16px_rgba(251,113,133,0.35)]' },
  { id: 'mint', label: 'Mint', className: 'border-emerald-300 bg-emerald-400/20 shadow-[0_0_16px_rgba(52,211,153,0.28)]' },
]

function frameClass(frame) {
  return FRAME_OPTIONS.find(f => f.id === frame)?.className || FRAME_OPTIONS[0].className
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const size = 256
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        const scale = Math.max(size / img.width, size / img.height)
        const width = img.width * scale
        const height = img.height * scale
        ctx.drawImage(img, (size - width) / 2, (size - height) / 2, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.86))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export default function SettingsPage() {
  const { user, accountProfile, updateAccountProfile } = useAuth() || {}
  const [libraryPath,   setLibraryPath]   = useState('')
  const [downloadPath,  setDownloadPath]  = useState('')
  const [autoScan,      setAutoScan]      = useState(false)
  const [cookieBrowser, setCookieBrowser] = useState('auto')
  const [cookiesFile,   setCookiesFile]   = useState('')
  const [youtubeClientId,     setYoutubeClientId]     = useState('')
  const [youtubeClientSecret, setYoutubeClientSecret] = useState('')
  const [youtubeRefreshToken, setYoutubeRefreshToken] = useState('')
  const [appVersion,          setAppVersion]          = useState('')
  const [updateInfo,          setUpdateInfo]          = useState(null)
  const [updatePhase,         setUpdatePhase]         = useState('idle')
  const [updateMessage,       setUpdateMessage]       = useState('')
  const [updateProgress,      setUpdateProgress]      = useState(0)
  const [profileName,         setProfileName]         = useState('')
  const [profileAvatar,       setProfileAvatar]       = useState('')
  const [profileFrame,        setProfileFrame]        = useState('classic')
  const [saved,         setSaved]         = useState(false)

  const isElectron = !!window.electron

  useEffect(() => {
    if (!isElectron) return
    window.electron.settings.getAll().then(all => {
      setLibraryPath(all.libraryPath    || '')
      setDownloadPath(all.downloadPath  || '')
      setAutoScan(all.autoScan          || false)
      setCookieBrowser(all.cookieBrowser || 'auto')
      setCookiesFile(all.cookiesFile    || '')
      setYoutubeClientId(all.youtubeClientId || '')
      setYoutubeClientSecret(all.youtubeClientSecret || '')
      setYoutubeRefreshToken(all.youtubeRefreshToken || '')
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
      window.electron.updater.onDownloaded(info => {
        setUpdatePhase('downloaded')
        setUpdateMessage(`Atualização pronta para instalar`)
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
      setUpdatePhase(phase => phase === 'checking' ? 'idle' : phase)
      setUpdateMessage(msg => msg === 'Verificando atualização...' ? 'Nenhuma atualização encontrada agora.' : msg)
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
    await window.electron.settings.set('libraryPath',   libraryPath)
    await window.electron.settings.set('downloadPath',  downloadPath)
    await window.electron.settings.set('autoScan',      autoScan)
    await window.electron.settings.set('cookieBrowser', cookieBrowser)
    await window.electron.settings.set('cookiesFile',   cookiesFile)
    await window.electron.settings.set('youtubeClientId', youtubeClientId.trim())
    await window.electron.settings.set('youtubeClientSecret', youtubeClientSecret.trim())
    await window.electron.settings.set('youtubeRefreshToken', youtubeRefreshToken.trim())
    await updateAccountProfile?.({
      displayName: profileName,
      avatarDataUrl: profileAvatar,
      frame: profileFrame,
    })
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

  async function pickFolder(setter) {
    if (!isElectron) return
    const dir = await window.electron.dialog.openFolder()
    if (dir) setter(dir)
  }

  async function pickCookiesFile() {
    if (!isElectron) return
    // Use IPC to open a file dialog for .txt files
    const { dialog, BrowserWindow } = window.electron
    // Fallback: use folder dialog note — we'll just use input
  }

  const showDpapiWarning = cookieBrowser === 'edge' || cookieBrowser === 'chrome'

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-xl mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Configurações</h1>
          <p className="text-xs text-white/40">Preferências do NianPlay</p>
        </div>

        {/* Account */}
        <section className="card p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
            <UserRound size={15} className="text-brand-400" /> Conta
          </h2>

          {!user && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Entre em uma conta para sincronizar nome, foto e moldura na nuvem.
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className={`w-20 h-20 rounded-full p-1 border-2 ${frameClass(profileFrame)}`}>
              <div className="w-full h-full rounded-full overflow-hidden bg-surface-700 flex items-center justify-center">
                {profileAvatar ? (
                  <img src={profileAvatar} alt="Foto de perfil" className="w-full h-full object-cover" />
                ) : (
                  <UserRound size={28} className="text-white/35" />
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <label className="text-xs text-white/40 mb-1.5 block">Nome publico</label>
              <input
                type="text"
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                placeholder="Seu nome no NianPlay"
                className="input-base w-full text-sm"
                maxLength={40}
              />
              <div className="flex gap-2 mt-2">
                <label className="btn-ghost text-xs px-3 py-2 flex items-center gap-2 cursor-pointer">
                  <Camera size={13} />
                  Trocar foto
                  <input type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
                </label>
                {profileAvatar && (
                  <button onClick={() => setProfileAvatar('')} className="btn-ghost text-xs px-3 py-2">
                    Remover
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-white/40 mb-2 flex items-center gap-1.5">
              <Sparkles size={12} /> Moldura
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FRAME_OPTIONS.map(frame => (
                <button
                  key={frame.id}
                  onClick={() => setProfileFrame(frame.id)}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                    profileFrame === frame.id
                      ? 'border-brand-500/60 bg-brand-600/20 text-white'
                      : 'border-white/10 bg-white/[0.02] text-white/50 hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  <span className={`inline-block w-3 h-3 rounded-full border mr-2 align-[-2px] ${frame.className}`} />
                  {frame.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Library */}
        <section className="card p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-white/80">Biblioteca</h2>
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Pasta da Biblioteca</label>
            <div className="flex gap-2">
              <input type="text" value={libraryPath} onChange={e => setLibraryPath(e.target.value)}
                placeholder="Selecione a pasta padrão das suas músicas" className="input-base flex-1 text-sm" />
              <button onClick={() => pickFolder(setLibraryPath)} className="btn-ghost p-2"><FolderOpen size={16} /></button>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => setAutoScan(v => !v)}
              className={`w-10 h-5 rounded-full transition-colors relative ${autoScan ? 'bg-brand-600' : 'bg-white/20'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow ${autoScan ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-white/70">Escanear automaticamente ao iniciar</span>
          </label>
        </section>

        {/* Downloads */}
        <section className="card p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-white/80">Downloads</h2>

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Pasta padrão de download</label>
            <div className="flex gap-2">
              <input type="text" value={downloadPath} onChange={e => setDownloadPath(e.target.value)}
                placeholder="Padrão: Downloads do sistema" className="input-base flex-1 text-sm" />
              <button onClick={() => pickFolder(setDownloadPath)} className="btn-ghost p-2"><FolderOpen size={16} /></button>
            </div>
          </div>

          {/* Cookie section */}
          <div className="flex flex-col gap-3">
            <label className="text-xs text-white/40 flex items-center gap-1.5">
              <Cookie size={11} /> Autenticação YouTube (anti-bot)
            </label>

            {/* cookies.txt priority */}
            <div className="bg-surface-700/50 rounded-lg p-3 flex flex-col gap-2 border border-white/5">
              <p className="text-xs text-white/60 font-medium">Opção 1 — Arquivo cookies.txt <span className="text-brand-400">(mais confiável)</span></p>
              <p className="text-xs text-white/30">
                Exporte seus cookies do YouTube com a extensão
                <a className="text-brand-400 mx-1 cursor-pointer"
                  onClick={() => window.electron && window.open?.('https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc')}>
                  "Get cookies.txt LOCALLY"
                </a>
                e cole o caminho do arquivo abaixo.
              </p>
              <input
                type="text"
                value={cookiesFile}
                onChange={e => setCookiesFile(e.target.value.trim().replace(/^["']|["']$/g, ''))}
                placeholder={`Ex: C:\\Users\\nianj\\Downloads\\youtube.com_cookies.txt`}
                className="input-base text-xs"
              />
              {cookiesFile && (
                <p className="text-xs text-green-400 flex items-center gap-1">
                  <CheckCircle size={11} /> Arquivo configurado — terá prioridade sobre o browser
                </p>
              )}
            </div>

            {/* Browser fallback */}
            <div className="bg-surface-700/50 rounded-lg p-3 flex flex-col gap-2 border border-white/5">
              <p className="text-xs text-white/60 font-medium">Opção 2 — Cookies do browser</p>
              <div className="flex flex-wrap gap-2">
                {BROWSERS.map(b => (
                  <button key={b.value} onClick={() => setCookieBrowser(b.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
                      ${cookieBrowser === b.value
                        ? 'bg-brand-600/30 border-brand-500/50 text-brand-300'
                        : 'border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5'}`}>
                    {b.label}
                  </button>
                ))}
              </div>

              {showDpapiWarning && (
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mt-1">
                  <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300">
                    <strong>Chrome e Edge 127+</strong> usam criptografia DPAPI que bloqueia o yt-dlp.
                    Se aparecer erro "Failed to decrypt", use <strong>Firefox</strong> ou o arquivo cookies.txt.
                  </p>
                </div>
              )}

              {cookieBrowser === 'none' && (
                <p className="text-xs text-amber-400/80">
                  ⚠️ Sem cookies, o YouTube bloqueia downloads com "Sign in to confirm you're not a bot".
                </p>
              )}

              {cookieBrowser === 'firefox' && (
                <p className="text-xs text-green-400/80 flex items-center gap-1">
                  <CheckCircle size={11} /> Firefox é compatível com yt-dlp sem restrições DPAPI.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* YouTube */}
        <section className="card p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
            <Youtube size={15} className="text-red-400" /> Exportar playlists para YouTube
          </h2>

          <div className="bg-surface-700/50 rounded-lg p-3 border border-white/5 text-xs text-white/35 leading-relaxed">
            Use credenciais OAuth do Google com escopo <span className="text-white/60">youtube.force-ssl</span>.
            O NianPlay cria uma playlist no seu canal e adiciona os vídeos usando os links salvos nos metadados das músicas.
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Client ID</label>
            <input
              type="text"
              value={youtubeClientId}
              onChange={e => setYoutubeClientId(e.target.value)}
              placeholder="Client ID do OAuth"
              className="input-base w-full text-xs"
            />
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Client Secret</label>
            <input
              type="password"
              value={youtubeClientSecret}
              onChange={e => setYoutubeClientSecret(e.target.value)}
              placeholder="Client Secret"
              className="input-base w-full text-xs"
            />
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Refresh Token</label>
            <input
              type="password"
              value={youtubeRefreshToken}
              onChange={e => setYoutubeRefreshToken(e.target.value)}
              placeholder="Refresh Token autorizado no YouTube"
              className="input-base w-full text-xs"
            />
          </div>
        </section>

        {/* About */}
        <section className="card p-5 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
            <Info size={14} className="text-brand-400" /> Sobre
          </h2>
          <div className="text-xs text-white/40 space-y-1">
            <p>NianPlay v{appVersion || '...'}</p>
            <p>Electron · React · Tailwind CSS</p>
            <p>Powered by yt-dlp & ffmpeg</p>
          </div>
        </section>

        {/* Updates */}
        <section className="card p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
            <RefreshCw size={14} className="text-brand-400" /> Atualizações
          </h2>

          {updateMessage && (
            <p className={`text-xs ${updatePhase === 'error' ? 'text-red-400' : updatePhase === 'downloaded' ? 'text-green-400' : 'text-white/45'}`}>
              {updateMessage}
            </p>
          )}

          {updatePhase === 'downloading' && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${updateProgress}%` }} />
              </div>
              <span className="text-xs text-white/40">{Math.round(updateProgress)}%</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={handleCheckUpdate} disabled={updatePhase === 'checking' || updatePhase === 'downloading'} className="btn-ghost text-sm px-3 py-2 flex items-center gap-2 disabled:opacity-40">
              {updatePhase === 'checking' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Verificar agora
            </button>
            {updatePhase === 'available' && (
              <button onClick={handleDownloadUpdate} className="btn-primary text-sm px-3 py-2 flex items-center gap-2">
                <Download size={14} /> Baixar atualização
              </button>
            )}
            {updatePhase === 'downloaded' && (
              <button onClick={handleInstallUpdate} className="btn-primary text-sm px-3 py-2 flex items-center gap-2">
                <CheckCircle2 size={14} /> Instalar e reiniciar
              </button>
            )}
          </div>
        </section>

        <button onClick={handleSave} className="btn-primary flex items-center gap-2 self-end">
          <Save size={14} />
          {saved ? 'Salvo! ✓' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

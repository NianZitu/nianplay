import React, { useState, useEffect } from 'react'
import { Save, FolderOpen, Info, Cookie, AlertTriangle, CheckCircle } from 'lucide-react'

const BROWSERS = [
  { value: 'auto',    label: 'Auto-detectar' },
  { value: 'firefox', label: 'Firefox ✓ recomendado' },
  { value: 'edge',    label: 'Edge' },
  { value: 'chrome',  label: 'Chrome' },
  { value: 'brave',   label: 'Brave' },
  { value: 'none',    label: 'Nenhum' },
]

export default function SettingsPage() {
  const [libraryPath,   setLibraryPath]   = useState('')
  const [downloadPath,  setDownloadPath]  = useState('')
  const [autoScan,      setAutoScan]      = useState(false)
  const [cookieBrowser, setCookieBrowser] = useState('auto')
  const [cookiesFile,   setCookiesFile]   = useState('')
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
    })
  }, [])

  async function handleSave() {
    if (!isElectron) return
    await window.electron.settings.set('libraryPath',   libraryPath)
    await window.electron.settings.set('downloadPath',  downloadPath)
    await window.electron.settings.set('autoScan',      autoScan)
    await window.electron.settings.set('cookieBrowser', cookieBrowser)
    await window.electron.settings.set('cookiesFile',   cookiesFile)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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

        {/* About */}
        <section className="card p-5 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
            <Info size={14} className="text-brand-400" /> Sobre
          </h2>
          <div className="text-xs text-white/40 space-y-1">
            <p>NianPlay v1.0.0</p>
            <p>Electron · React · Tailwind CSS</p>
            <p>Powered by yt-dlp & ffmpeg</p>
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

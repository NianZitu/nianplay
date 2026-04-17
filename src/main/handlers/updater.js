// ─── Auto-update checker ──────────────────────────────────────────────────────
// Checks GitHub releases for a newer version and notifies the renderer.
//
// CONFIGURAÇÃO: Preencha GITHUB_OWNER e GITHUB_REPO com o seu repositório.
// Quando lançar uma nova versão, crie uma release no GitHub com a tag vX.Y.Z
// (ex: v1.0.1) e anexe o instalador. O app comparará automaticamente.
// ─────────────────────────────────────────────────────────────────────────────
const GITHUB_OWNER = 'NianZitu'
const GITHUB_REPO  = 'nianplay'

module.exports = function registerUpdaterHandlers(ipcMain, mainWindow) {
  const { app, net, shell } = require('electron')
  const currentVersion = app.getVersion()

  function isNewer(latest, current) {
    const parse = v => v.replace(/^v/, '').split('.').map(Number)
    const [la, lb, lc] = parse(latest)
    const [ca, cb, cc] = parse(current)
    return la > ca || (la === ca && lb > cb) || (la === ca && lb === cb && lc > cc)
  }

  function netGet(url) {
    return new Promise((resolve, reject) => {
      const req = net.request({ url, method: 'GET' })
      req.setHeader('User-Agent',  'NianPlay-App/' + currentVersion)
      req.setHeader('Accept',      'application/vnd.github.v3+json')
      let body = ''
      req.on('response', res => {
        res.on('data',  c   => { body += c.toString() })
        res.on('end',   ()  => resolve({ status: res.statusCode, body }))
        res.on('error', reject)
      })
      req.on('error', reject)
      req.end()
    })
  }

  async function checkForUpdates() {
    // Skip if placeholder not configured
    if (GITHUB_OWNER === 'SEU_USUARIO_GITHUB') {
      console.log('[Updater] GitHub owner not configured — skipping update check')
      return
    }

    try {
      const res = await netGet(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`)
      if (res.status !== 200) return

      const release     = JSON.parse(res.body)
      const latestTag   = release.tag_name || ''
      const latestVer   = latestTag.replace(/^v/, '')

      if (!latestVer || !isNewer(latestVer, currentVersion)) {
        console.log(`[Updater] Up to date (${currentVersion})`)
        return
      }

      console.log(`[Updater] New version available: ${latestVer} (current: ${currentVersion})`)

      // Find the installer asset (.exe) for Windows
      const exeAsset = (release.assets || []).find(a =>
        a.name.endsWith('.exe') && a.name.toLowerCase().includes('setup')
      )

      mainWindow.webContents.send('update:available', {
        version:     latestVer,
        notes:       release.body || '',
        downloadUrl: exeAsset?.browser_download_url || release.html_url,
        releasePage: release.html_url,
      })
    } catch (e) {
      console.log('[Updater] Check failed:', e.message)
    }
  }

  // Check 5s after startup (non-blocking, silent fail)
  setTimeout(() => checkForUpdates().catch(() => {}), 5000)

  // Manual check from renderer
  ipcMain.handle('update:check', () => checkForUpdates())

  // Open download URL in system browser
  ipcMain.on('update:openDownload', (_, url) => {
    if (url && url.startsWith('https://')) shell.openExternal(url)
  })
}

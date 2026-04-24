// ─── In-app Auto-updater ──────────────────────────────────────────────────────
// Uses electron-updater to check, download and install updates from GitHub
// Releases without the user ever leaving the app.
// ─────────────────────────────────────────────────────────────────────────────

module.exports = function registerUpdaterHandlers(ipcMain, mainWindow) {
  let autoUpdater
  try {
    autoUpdater = require('electron-updater').autoUpdater
  } catch (e) {
    console.warn('[Updater] electron-updater not available:', e.message)
    ipcMain.handle('update:check',    () => null)
    ipcMain.handle('update:download', () => null)
    ipcMain.handle('update:install',  () => null)
    return
  }

  function send(channel, payload) {
    try {
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send(channel, payload)
    } catch {}
  }

  // Don't auto-download — let the user decide when to download
  autoUpdater.autoDownload         = false
  autoUpdater.autoInstallOnAppQuit = false

  // ── Events ──────────────────────────────────────────────────────────────────
  autoUpdater.on('update-available', info => {
    console.log('[Updater] Update available:', info.version)
    send('update:available', { version: info.version, notes: info.releaseNotes || '' })
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] Already up to date')
  })

  autoUpdater.on('download-progress', progress => {
    send('update:progress', {
      percent:        Math.round(progress.percent),
      transferred:    progress.transferred,
      total:          progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    })
  })

  autoUpdater.on('update-downloaded', info => {
    console.log('[Updater] Downloaded:', info.version)
    send('update:downloaded', { version: info.version })
  })

  autoUpdater.on('error', err => {
    console.error('[Updater] Error:', err.message)
    send('update:error', err.message)
  })

  // ── IPC handlers ────────────────────────────────────────────────────────────
  ipcMain.handle('update:check', async () => {
    try { await autoUpdater.checkForUpdates() } catch (e) {
      console.warn('[Updater] Check failed:', e.message)
    }
  })

  ipcMain.handle('update:download', async () => {
    try { await autoUpdater.downloadUpdate() } catch (e) {
      send('update:error', e.message)
    }
  })

  ipcMain.handle('update:install', () => {
    // isSilent=false shows NSIS wizard so user sees install progress
    // isForceRunAfter=true restarts the app automatically after install
    autoUpdater.quitAndInstall(false, true)
  })

  // ── Auto-check 5 s after startup ────────────────────────────────────────────
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(e =>
      console.warn('[Updater] Startup check failed:', e.message)
    )
  }, 5000)
}

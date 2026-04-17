const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs   = require('path')
const isDev = process.env.NODE_ENV === 'development'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0d0d14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      webviewTag: true,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

async function ensureYtDlp() {
  const YTDlpWrap = require('yt-dlp-wrap').default
  const binPath   = require('./ytdlp-path')
  const fs        = require('fs')

  if (!fs.existsSync(binPath)) {
    console.log('[yt-dlp] Not found, downloading...')
    try {
      await YTDlpWrap.downloadFromGithub(binPath)
      console.log('[yt-dlp] Downloaded to', binPath)
    } catch (err) {
      console.error('[yt-dlp] Download failed:', err.message)
    }
    return
  }

  // Binary exists — try to update it in the background so formats stay current
  console.log('[yt-dlp] Found, checking for updates...')
  try {
    const { spawn } = require('child_process')
    const proc = spawn(binPath, ['-U'], { windowsHide: true })
    proc.stdout.on('data', d => console.log('[yt-dlp update]', d.toString().trim()))
    proc.stderr.on('data', d => console.log('[yt-dlp update]', d.toString().trim()))
    proc.on('close', code => console.log('[yt-dlp] Update exited with code', code))
  } catch (err) {
    console.error('[yt-dlp] Update check failed:', err.message)
  }
}

app.whenReady().then(async () => {
  createWindow()

  require('./db').initDB()
  require('./handlers/library')(ipcMain)
  require('./handlers/downloader')(ipcMain, mainWindow)
  require('./handlers/settings')(ipcMain)
  require('./handlers/window')(ipcMain, mainWindow)
  require('./handlers/playlists')(ipcMain)
  require('./handlers/spotify')(ipcMain)
  require('./handlers/ytSearch')(ipcMain)
  require('./handlers/lufs')(ipcMain, mainWindow)
  require('./handlers/lyrics')(ipcMain)
  require('./handlers/updater')(ipcMain, mainWindow)

  // Download yt-dlp in background (non-blocking)
  ensureYtDlp().catch(console.error)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

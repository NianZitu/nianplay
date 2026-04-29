const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs   = require('fs')
const http = require('http')
const isDev = process.env.NODE_ENV === 'development'

let mainWindow
let staticServer

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
}

function startStaticServer() {
  if (staticServer) {
    const address = staticServer.address()
    return Promise.resolve(`http://localhost:${address.port}`)
  }

  const distDir = path.join(__dirname, '../../dist')
  staticServer = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
    const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '')
    let filePath = path.join(distDir, safePath === '/' ? 'index.html' : safePath)

    if (!filePath.startsWith(distDir)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html')
    }

    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' })
    fs.createReadStream(filePath).pipe(res)
  })

  return new Promise((resolve, reject) => {
    staticServer.once('error', reject)
    staticServer.listen(0, 'localhost', () => {
      const address = staticServer.address()
      resolve(`http://localhost:${address.port}`)
    })
  })
}

async function createWindow() {
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
    const appUrl = await startStaticServer()
    mainWindow.loadURL(appUrl)
  }

  mainWindow.on('closed', () => { mainWindow = null })

  // Allow Firebase OAuth popup (Google sign-in) to open as a real window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.startsWith('https://accounts.google.com') ||
      url.includes('firebaseapp.com/__/auth/')
    ) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 500, height: 640,
          webPreferences: { nodeIntegration: false, contextIsolation: false },
        },
      }
    }
    return { action: 'deny' }
  })
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
  await createWindow()

  ipcMain.handle('app:getVersion', () => app.getVersion())

  require('./db').initDB()
  require('./handlers/library')(ipcMain)
  require('./handlers/downloader')(ipcMain, mainWindow)
  require('./handlers/settings')(ipcMain)
  require('./handlers/window')(ipcMain, mainWindow)
  require('./handlers/playlists')(ipcMain)
  require('./handlers/spotify')(ipcMain)
  require('./handlers/youtube')(ipcMain)
  require('./handlers/ytSearch')(ipcMain)
  require('./handlers/lufs')(ipcMain, mainWindow)
  require('./handlers/lyrics')(ipcMain)
  require('./handlers/appearance')(ipcMain)
  require('./handlers/updater')(ipcMain, mainWindow)

  // Download yt-dlp in background (non-blocking)
  ensureYtDlp().catch(console.error)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (staticServer) {
    staticServer.close()
    staticServer = null
  }
  if (process.platform !== 'darwin') app.quit()
})

const path   = require('path')
const fs     = require('fs')
const { spawn } = require('child_process')
const { v4: uuidv4 } = require('uuid')
const { getDB } = require('../db')

const activeJobs = new Map()

module.exports = function registerDownloaderHandlers(ipcMain, mainWindow) {
  function sendProgress(data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('downloader:progress', data)
    }
  }

  ipcMain.handle('downloader:ytdlpStatus', () => {
    const ytDlpBin = require('../ytdlp-path')
    return { ready: fs.existsSync(ytDlpBin), path: ytDlpBin }
  })

  ipcMain.handle('downloader:start', async (_, opts) => {
    const ytDlpBin = require('../ytdlp-path')
    if (!fs.existsSync(ytDlpBin)) {
      return { error: 'yt-dlp ainda está sendo baixado. Aguarde e tente novamente.' }
    }

    const id = uuidv4()
    const db = getDB()
    const downloads = db.downloads.read()
    downloads.unshift({ id, url: opts.url, status: 'queued', format: opts.format, title: '', created_at: Date.now() })
    db.downloads.write(downloads)

    sendProgress({ id, status: 'queued', percent: 0 })
    // Fire and forget — updates come via sendProgress
    runDownload(id, opts, sendProgress).catch(err => {
      console.error('[Downloader] Unhandled:', err)
    })
    return { id }
  })

  // Like start, but also links the finished file to a library track
  ipcMain.handle('downloader:startForTrack', async (_, opts) => {
    const ytDlpBin = require('../ytdlp-path')
    if (!fs.existsSync(ytDlpBin)) {
      return { error: 'yt-dlp ainda está sendo baixado. Aguarde e tente novamente.' }
    }

    const id = uuidv4()
    const db = getDB()
    const downloads = db.downloads.read()
    downloads.unshift({ id, url: opts.url, status: 'queued', format: opts.format, title: opts.trackTitle || '', created_at: Date.now() })
    db.downloads.write(downloads)

    sendProgress({ id, status: 'queued', percent: 0, trackId: opts.trackId })

    runDownload(id, opts, (data) => {
      sendProgress({ ...data, trackId: opts.trackId })
    }).then(() => {
      // After successful download, try to link the file to the library track
      if (opts.trackId) {
        linkDownloadedFile(opts.trackId, opts, id)
      }
    }).catch(err => {
      console.error('[Downloader] Unhandled:', err)
    })

    return { id }
  })

  ipcMain.handle('downloader:cancel', (_, id) => {
    const proc = activeJobs.get(id)
    if (proc) {
      killProcess(proc)
      activeJobs.delete(id)
      _updateDownload(id, { status: 'cancelled' })
      sendProgress({ id, status: 'cancelled' })
    } else {
      // Job might still be queued before spawn — just mark it cancelled in DB
      _updateDownload(id, { status: 'cancelled' })
      sendProgress({ id, status: 'cancelled' })
    }
    return true
  })

  ipcMain.handle('downloader:getQueue', () => {
    return getDB().downloads.read().slice(0, 100)
  })
}

// On Windows, proc.kill() only kills the top-level process.
// taskkill /F /T kills the entire process tree (yt-dlp + ffmpeg children).
function killProcess(proc) {
  try {
    if (process.platform === 'win32' && proc.pid) {
      spawn('taskkill', ['/F', '/T', '/PID', String(proc.pid)], { windowsHide: true })
    } else {
      proc.kill('SIGTERM')
    }
  } catch (e) {
    console.error('[Downloader] killProcess error:', e.message)
  }
}

// After a download finishes, find the file and link it to the library track
async function linkDownloadedFile(trackId, opts, downloadId) {
  try {
    const { app } = require('electron')
    const AUDIO_EXT = new Set(['.mp3', '.flac', '.wav', '.aac', '.ogg', '.m4a', '.opus', '.wma'])
    const outDir = opts.outputDir || app.getPath('downloads')
    const titleHint = (opts.trackTitle || '').toLowerCase().replace(/[^\w\s]/g, '').trim()

    // Find audio files modified in last 5 minutes in the output dir
    const recent = Date.now() - 5 * 60 * 1000
    let candidates = []
    try {
      candidates = fs.readdirSync(outDir)
        .filter(f => AUDIO_EXT.has(path.extname(f).toLowerCase()))
        .map(f => ({ name: f, full: path.join(outDir, f), mtime: fs.statSync(path.join(outDir, f)).mtimeMs }))
        .filter(f => f.mtime >= recent)
        .sort((a, b) => b.mtime - a.mtime)
    } catch {}

    if (!candidates.length) return

    // Score by name similarity to titleHint
    function sim(a, b) {
      a = a.toLowerCase().replace(/[^\w\s]/g, ''); b = b.toLowerCase().replace(/[^\w\s]/g, '')
      if (!a || !b) return 0
      const aW = new Set(a.split(/\s+/).filter(Boolean))
      const bW = b.split(/\s+/).filter(Boolean)
      return bW.filter(w => aW.has(w)).length / Math.max(aW.size, bW.length)
    }

    const best = titleHint
      ? candidates.sort((a, b) => sim(titleHint, path.basename(b.name, path.extname(b.name))) - sim(titleHint, path.basename(a.name, path.extname(a.name))))[0]
      : candidates[0]

    if (!best) return

    const db = getDB()
    const tracks = db.tracks.read()
    const idx = tracks.findIndex(t => t.id === trackId)
    if (idx === -1) return

    // Extract embedded cover if present
    let cover_path = tracks[idx].cover_path
    if (!cover_path) {
      try {
        const { parseFile } = await import('music-metadata')
        const meta = await parseFile(best.full, { skipCovers: false })
        if (meta.common.picture?.length) {
          const pic = meta.common.picture[0]
          const coverDir = path.join(path.dirname(best.full), '.nianplay-covers')
          if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir, { recursive: true })
          const ext = pic.format.includes('png') ? 'png' : 'jpg'
          cover_path = path.join(coverDir, `${path.basename(best.full, path.extname(best.full))}.${ext}`)
          if (!fs.existsSync(cover_path)) fs.writeFileSync(cover_path, pic.data)
        }
      } catch {}
    }

    const isYtUrl = url => url && (url.includes('youtube.com') || url.includes('youtu.be'))
    tracks[idx] = {
      ...tracks[idx],
      file_path:  best.full,
      cover_path: cover_path || tracks[idx].cover_path,
      yt_url:     tracks[idx].yt_url || (isYtUrl(opts.url) ? opts.url : tracks[idx].yt_url),
      updated_at: Date.now(),
    }
    db.tracks.write(tracks)
    console.log('[Downloader] Linked', best.full, '→ track', trackId)
  } catch (err) {
    console.error('[Downloader] linkDownloadedFile error:', err.message)
  }
}

function _updateDownload(id, patch) {
  try {
    const db = getDB()
    const downloads = db.downloads.read()
    const idx = downloads.findIndex(d => d.id === id)
    if (idx !== -1) {
      downloads[idx] = { ...downloads[idx], ...patch }
      db.downloads.write(downloads)
    }
  } catch (e) {
    console.error('[Downloader] _updateDownload error:', e.message)
  }
}

// Returns cookie args for yt-dlp based on user settings.
// Firefox is preferred — Chrome/Edge 127+ use DPAPI app-bound encryption
// that yt-dlp (an external process) cannot decrypt.
function getCookieArgs() {
  try {
    const settings = getDB().settings.read()

    // cookies.txt file takes priority over browser
    // Strip surrounding quotes the user may have accidentally typed
    const rawFile = (settings.cookiesFile || '').trim().replace(/^["']|["']$/g, '')
    if (rawFile && fs.existsSync(rawFile)) {
      console.log('[Downloader] Using cookies.txt:', rawFile)
      return ['--cookies', rawFile]
    } else if (rawFile) {
      console.warn('[Downloader] cookies.txt not found at:', rawFile)
    }

    const browser = settings.cookieBrowser || 'auto'
    if (browser === 'none') return []

    if (browser !== 'auto') {
      console.log('[Downloader] Using cookies from browser:', browser)
      return ['--cookies-from-browser', browser]
    }
  } catch {}

  // Auto-detect: Firefox ONLY — Chrome/Edge 127+ use DPAPI app-bound encryption
  // that yt-dlp cannot decrypt. Never auto-select them to avoid DPAPI errors.
  const firefoxPaths = [
    'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
    'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
  ]
  if (firefoxPaths.some(p => fs.existsSync(p))) {
    console.log('[Downloader] Auto-detected Firefox for cookies')
    return ['--cookies-from-browser', 'firefox']
  }

  // Firefox not found — proceed without cookies (works for most public videos)
  console.log('[Downloader] No compatible browser found, proceeding without cookies')
  return []
}

// In packaged apps, ffmpeg-static lives inside app.asar but binaries
// must be executed from app.asar.unpacked (asar archives can't run executables).
function getFFmpegPath() {
  const { app } = require('electron')
  let p = require('ffmpeg-static')
  if (app.isPackaged) p = p.replace('app.asar', 'app.asar.unpacked')
  return p
}

async function runDownload(id, opts, sendProgress) {
  const ffmpegPath = getFFmpegPath()
  const { app }   = require('electron')
  const ytDlpBin  = require('../ytdlp-path')
  const { url, format, audioFormat = 'mp3', quality = '1080p', outputDir } = opts

  const safeOutputDir = outputDir || app.getPath('downloads')
  if (!fs.existsSync(safeOutputDir)) fs.mkdirSync(safeOutputDir, { recursive: true })

  // %(title,id)s: use video ID as fallback if title is empty/NA
  // --restrict-filenames: replace special chars (/, :, #, etc.) with underscores
  const outputTemplate = path.join(safeOutputDir, '%(title,id)s.%(ext)s')
  const isPlaylist = url.includes('list=') || url.includes('/playlist')

  const cookieArgs = getCookieArgs()

  const formatMap = {
    '4K':    'bestvideo[height<=2160]+bestaudio/best',
    '1080p': 'bestvideo[height<=1080]+bestaudio/best',
    '720p':  'bestvideo[height<=720]+bestaudio/best',
    '480p':  'bestvideo[height<=480]+bestaudio/best',
    '360p':  'bestvideo[height<=360]+bestaudio/best',
  }

  let args
  if (format === 'audio') {
    args = [
      url,
      '-f', 'bestaudio/best',
      '--extract-audio',
      '--audio-format', audioFormat,
      '--audio-quality', '0',
      '--embed-thumbnail',          // embed YouTube thumbnail as cover art
      '--convert-thumbnails', 'jpg',
      '--ffmpeg-location', ffmpegPath,
      '-o', outputTemplate,
      '--restrict-filenames',       // replace special chars with underscores
      '--newline',
      '--progress',
      '--no-warnings',
      isPlaylist ? '--yes-playlist' : '--no-playlist',
      ...cookieArgs,
    ]
  } else {
    args = [
      url,
      '-f', formatMap[quality] || 'bestvideo+bestaudio/best',
      '--merge-output-format', 'mp4',
      '--ffmpeg-location', ffmpegPath,
      '-o', outputTemplate,
      '--newline',
      '--progress',
      isPlaylist ? '--yes-playlist' : '--no-playlist',
      ...cookieArgs,
    ]
  }

  _updateDownload(id, { status: 'downloading' })
  sendProgress({ id, status: 'downloading', percent: 0 })

  return new Promise((resolve, reject) => {
    console.log('[Downloader] Spawning:', ytDlpBin, args.slice(0, 4).join(' '), '...')

    const proc = spawn(ytDlpBin, args, { windowsHide: true })
    activeJobs.set(id, proc)

    let stderr = ''

    // Parse yt-dlp stdout line by line
    let buf = ''
    proc.stdout.on('data', (chunk) => {
      buf += chunk.toString()
      const lines = buf.split('\n')
      buf = lines.pop() // keep incomplete line

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        console.log('[yt-dlp]', trimmed)

        // Progress line: [download]  45.3% of  3.45MiB at  1.23MiB/s ETA 00:02
        const progressMatch = trimmed.match(/\[download\]\s+([\d.]+)%\s+of\s+([\S]+)\s+at\s+([\S]+)\s+ETA\s+([\S]+)/)
        if (progressMatch) {
          const percent = parseFloat(progressMatch[1])
          sendProgress({
            id,
            status: 'downloading',
            percent,
            size:  progressMatch[2],
            speed: progressMatch[3],
            eta:   progressMatch[4],
          })
          continue
        }

        // Destination / title detection
        const destMatch = trimmed.match(/Destination:\s+(.+)/)
        if (destMatch) {
          _updateDownload(id, { title: path.basename(destMatch[1].trim()) })
          sendProgress({ id, status: 'downloading', title: path.basename(destMatch[1].trim()) })
        }
      }
    })

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
      console.error('[yt-dlp stderr]', chunk.toString().trim())
    })

    proc.on('error', (err) => {
      activeJobs.delete(id)
      const msg = `Falha ao iniciar yt-dlp: ${err.message}`
      _updateDownload(id, { status: 'error', error: msg })
      sendProgress({ id, status: 'error', error: msg })
      reject(err)
    })

    proc.on('close', (code) => {
      activeJobs.delete(id)
      if (code === 0) {
        _updateDownload(id, { status: 'done' })
        sendProgress({ id, status: 'done', percent: 100 })
        resolve()
      } else {
        const msg = stderr
          ? stderr.trim().split('\n').pop()   // last line of stderr
          : `yt-dlp saiu com código ${code}`
        _updateDownload(id, { status: 'error', error: msg })
        sendProgress({ id, status: 'error', error: msg })
        resolve() // resolve so caller doesn't unhandled-reject
      }
    })
  })
}

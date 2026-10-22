const path   = require('path')
const fs     = require('fs')
const { spawn } = require('child_process')
const { v4: uuidv4 } = require('uuid')
const { getDB } = require('../db')
const { canonicalUrl } = require('../mediaUrl')
const { pathKey } = require('../urlRepair')

const activeJobs = new Map()

// Markers of the lines yt-dlp prints for us (see reportArgs in runDownload)
const MARK_FILE  = 'NIANPLAY_FILE'
const MARK_TITLE = 'NIANPLAY_TITLE'

// A finished file that is already a library track gets the link it was downloaded from
function linkFilesToLibrary(files) {
  if (!files?.length) return
  try {
    const db = getDB()
    const byPath = new Map(files.map(f => [pathKey(f.path), f.url]))
    const tracks = db.tracks.read()
    let changed = 0
    tracks.forEach((t, i) => {
      const url = t.file_path && byPath.get(pathKey(t.file_path))
      if (url && t.yt_url !== url) { tracks[i] = { ...t, yt_url: url, updated_at: Date.now() }; changed++ }
    })
    if (changed) db.tracks.write(tracks)
  } catch (err) {
    console.error('[Downloader] linkFilesToLibrary error:', err.message)
  }
}

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
    }).then((result) => {
      // Only a successful download is linked to the track (a failed one used to link
      // whatever audio file had been modified most recently in the folder)
      if (opts.trackId && result?.ok) {
        linkDownloadedFile(opts.trackId, opts, result.files)
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

// After a successful download, link the exact file yt-dlp reported to the library track.
// (This used to pick the newest audio file in the folder with a similar name — with several
// downloads running at once that linked files, and links, to the wrong tracks.)
async function linkDownloadedFile(trackId, opts, files) {
  try {
    const file = (files || []).find(f => f.path && fs.existsSync(f.path))
    if (!file) {
      console.warn('[Downloader] No file reported by yt-dlp for track', trackId, '— not linking')
      return
    }
    const best = { full: file.path }

    const current = getDB().tracks.read().find(t => t.id === trackId)
    if (!current) return

    // Extract embedded cover if present
    let cover_path = current.cover_path
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

    // Re-read after the async cover extraction: the library may have changed meanwhile
    const db = getDB()
    const tracks = db.tracks.read()
    const idx = tracks.findIndex(t => t.id === trackId)
    if (idx === -1) return
    tracks[idx] = {
      ...tracks[idx],
      file_path:  best.full,
      cover_path: cover_path || tracks[idx].cover_path,
      // The link the file was actually downloaded from (canonical form)
      yt_url:     file.url || canonicalUrl(opts.url) || tracks[idx].yt_url,
      updated_at: Date.now(),
    }
    db.tracks.write(tracks)
    require('../thumbnails').scheduleThumbnails()
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

  // yt-dlp reports, for every downloaded video, the link it came from and the FINAL file path
  // (after conversion/merge). This is how each file is tied to its link — never by name.
  // --print implies quiet mode, so the title for the UI comes from a second print line;
  // --progress keeps the progress lines. --encoding utf-8 keeps accented file names intact.
  const reportArgs = [
    '--print', `before_dl:${MARK_TITLE}\t%(title)s`,
    '--print', `after_move:${MARK_FILE}\t%(webpage_url)s\t%(filepath)s`,
    '--no-simulate',
    '--encoding', 'utf-8',
  ]

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
      '--windows-filenames',        // strip only chars invalid on Windows, keeps spaces
      '--newline',
      '--progress',
      '--no-warnings',
      isPlaylist ? '--yes-playlist' : '--no-playlist',
      ...reportArgs,
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
      ...reportArgs,
      ...cookieArgs,
    ]
  }

  _updateDownload(id, { status: 'downloading' })
  sendProgress({ id, status: 'downloading', percent: 0 })

  return new Promise((resolve, reject) => {
    console.log('[Downloader] Spawning:', ytDlpBin, args.slice(0, 4).join(' '), '...')

    const proc = spawn(ytDlpBin, args, {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    })
    activeJobs.set(id, proc)

    let stderr = ''
    const files = []   // [{ url, path }] — one per finished video

    // Parse yt-dlp stdout line by line (setEncoding keeps multi-byte chars split across chunks intact)
    proc.stdout.setEncoding('utf8')
    let buf = ''
    proc.stdout.on('data', (chunk) => {
      buf += chunk
      const lines = buf.split('\n')
      buf = lines.pop() // keep incomplete line

      for (const line of lines) {
        const trimmed = line.replace(/\r$/, '')
        if (!trimmed.trim()) continue
        console.log('[yt-dlp]', trimmed)

        if (trimmed.startsWith(MARK_FILE + '\t')) {
          const [, webpageUrl, filePath] = trimmed.split('\t')
          if (filePath) {
            files.push({ url: canonicalUrl(webpageUrl || url), path: filePath })
            _updateDownload(id, { title: path.basename(filePath), files })
            sendProgress({ id, status: 'downloading', title: path.basename(filePath) })
          }
          continue
        }
        if (trimmed.startsWith(MARK_TITLE + '\t')) {
          const title = trimmed.slice(MARK_TITLE.length + 1)
          if (title) sendProgress({ id, status: 'downloading', title })
          continue
        }

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
        _updateDownload(id, { status: 'done', files })
        // Files that are already in the library get their link now (e.g. re-downloads);
        // new files get it when the folder is scanned (see urlRepair.js)
        linkFilesToLibrary(files)
        sendProgress({ id, status: 'done', percent: 100 })
        resolve({ ok: true, files })
      } else {
        const msg = stderr
          ? stderr.trim().split('\n').pop()   // last line of stderr
          : `yt-dlp saiu com código ${code}`
        _updateDownload(id, { status: 'error', error: msg })
        sendProgress({ id, status: 'error', error: msg })
        resolve({ ok: false, files }) // resolve so caller doesn't unhandled-reject
      }
    })
  })
}

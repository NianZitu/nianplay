const path = require('path')
const fs   = require('fs')
const { v4: uuidv4 } = require('uuid')
const { getDB } = require('../db')

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.aac', '.ogg', '.m4a', '.opus', '.wma'])

async function scanDirectory(dirPath) {
  const { parseFile } = await import('music-metadata')
  const db = getDB()

  const existingTracks = db.tracks.read()
  const existingPaths  = new Set(existingTracks.map(t => t.file_path))

  const audioFiles = []
  function walk(dir) {
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        audioFiles.push(full)
      }
    }
  }
  walk(dirPath)

  const newTracks = []
  for (const filePath of audioFiles) {
    if (existingPaths.has(filePath)) continue
    try {
      const meta = await parseFile(filePath, { skipCovers: false, duration: true })
      const { common, format } = meta

      let cover_path = null
      if (common.picture && common.picture.length > 0) {
        const pic      = common.picture[0]
        const coverDir = path.join(path.dirname(filePath), '.nianplay-covers')
        if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir, { recursive: true })
        const ext  = pic.format.includes('png') ? 'png' : 'jpg'
        cover_path = path.join(coverDir, `${path.basename(filePath, path.extname(filePath))}.${ext}`)
        if (!fs.existsSync(cover_path)) fs.writeFileSync(cover_path, pic.data)
      }

      newTracks.push({
        id:         uuidv4(),
        title:      common.title  || path.basename(filePath, path.extname(filePath)),
        artist:     common.artist || 'Desconhecido',
        album:      common.album  || '',
        duration:   format.duration || 0,
        file_path:  filePath,
        cover_path,
        genre:      (common.genre && common.genre[0]) || '',
        year:       common.year || null,
        gain:       0.0,
        lyrics:     '',
        yt_url:     '',
        created_at: Date.now(),
        updated_at: Date.now(),
      })
    } catch (err) {
      console.warn('[Library] Could not parse:', filePath, err.message)
    }
  }

  if (newTracks.length > 0) {
    db.tracks.write([...existingTracks, ...newTracks])
  }

  return { total: audioFiles.length, added: newTracks.length }
}

module.exports = function registerLibraryHandlers(ipcMain) {
  ipcMain.handle('library:scan', async (_, folderPath) => {
    if (!folderPath || !fs.existsSync(folderPath)) return { error: 'Invalid folder' }
    return await scanDirectory(folderPath)
  })

  ipcMain.handle('library:getTracks', () => {
    const tracks = getDB().tracks.read()
    return tracks.sort((a, b) => {
      const aKey = `${a.artist}${a.album}${a.title}`
      const bKey = `${b.artist}${b.album}${b.title}`
      return aKey.localeCompare(bKey)
    })
  })

  ipcMain.handle('library:getTrack', (_, id) => {
    return getDB().tracks.read().find(t => t.id === id) || null
  })

  ipcMain.handle('library:updateTrack', (_, updated) => {
    const tracks = getDB().tracks.read()
    const idx = tracks.findIndex(t => t.id === updated.id)
    if (idx === -1) return false
    tracks[idx] = { ...tracks[idx], ...updated, updated_at: Date.now() }
    getDB().tracks.write(tracks)
    return true
  })

  ipcMain.handle('library:removeTrack', (_, id) => {
    const db = getDB()
    const tracks = db.tracks.read()
    const filtered = tracks.filter(t => t.id !== id)
    if (filtered.length === tracks.length) return false
    db.tracks.write(filtered)
    // Also remove from playlistTracks
    const pt = db.playlistTracks.read().filter(r => r.track_id !== id)
    db.playlistTracks.write(pt)
    return true
  })

  // Import a virtual track from cloud (no file_path) — used by cloud sync
  ipcMain.handle('library:importVirtualTrack', (_, track) => {
    const db = getDB()
    const tracks = db.tracks.read()
    const norm = s => (s || '').toLowerCase().trim()
    const exists = tracks.some(t =>
      norm(t.title) === norm(track.title) && norm(t.artist) === norm(track.artist)
    )
    if (exists) return { skipped: true }
    const newTrack = {
      id:        Date.now() + Math.floor(Math.random() * 1000),
      title:     track.title    || '',
      artist:    track.artist   || '',
      album:     track.album    || '',
      duration:  track.duration || 0,
      file_path: '',
      yt_url:    track.yt_url   || '',
      cover_url: track.cover_url || '',
      lyrics:    track.lyrics   || '',
      gain:      track.gain     || 0,
      added_at:  Date.now(),
    }
    db.tracks.write([...tracks, newTrack])
    return { id: newTrack.id }
  })

  ipcMain.handle('library:clearAll', () => {
    const db = getDB()
    db.tracks.write([])
    db.playlistTracks.write([])
    return true
  })

  ipcMain.handle('library:chooseFolder', async () => {
    const { dialog, BrowserWindow } = require('electron')
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  // Export entire library metadata to JSON
  ipcMain.handle('library:exportAll', async () => {
    const { dialog, BrowserWindow } = require('electron')
    const win = BrowserWindow.getFocusedWindow()
    const tracks = getDB().tracks.read()
    const exportData = {
      version:    1,
      type:       'nianplay-library',
      exportedAt: Date.now(),
      tracks:     tracks.map(t => ({
        title:    t.title,
        artist:   t.artist,
        album:    t.album,
        duration: t.duration,
        genre:    t.genre,
        year:     t.year,
        yt_url:   t.yt_url,
        lyrics:   t.lyrics,
        gain:     t.gain,
        file_path: t.file_path,
      })),
    }

    const result = await dialog.showSaveDialog(win, {
      defaultPath: `nianplay-library-${new Date().toISOString().slice(0,10)}.nianlibrary`,
      filters: [{ name: 'NianPlay Library', extensions: ['nianlibrary'] }, { name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return { canceled: true }

    fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf8')
    return { ok: true, trackCount: tracks.length }
  })

  // Import library metadata from JSON (merges, does not duplicate)
  ipcMain.handle('library:importAll', async () => {
    const { dialog, BrowserWindow } = require('electron')
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'NianPlay Library', extensions: ['nianlibrary', 'json'] }],
    })
    if (result.canceled || !result.filePaths.length) return { canceled: true }

    let data
    try {
      data = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'))
    } catch {
      return { error: 'Arquivo inválido ou corrompido' }
    }

    if (data.type !== 'nianplay-library' || !Array.isArray(data.tracks)) {
      return { error: 'Formato não reconhecido' }
    }

    const db = getDB()
    const existing = db.tracks.read()
    const existingKeys = new Set(existing.map(t => `${t.title?.toLowerCase()}|||${t.artist?.toLowerCase()}`))
    const existingPaths = new Set(existing.map(t => t.file_path).filter(Boolean))

    let added = 0, merged = 0

    for (const imp of data.tracks) {
      const key = `${imp.title?.toLowerCase()}|||${imp.artist?.toLowerCase()}`
      const byPath = imp.file_path && existingPaths.has(imp.file_path)
      const byKey  = existingKeys.has(key)

      if (byPath || byKey) {
        // Merge missing metadata
        const idx = existing.findIndex(t =>
          (imp.file_path && t.file_path === imp.file_path) ||
          (t.title?.toLowerCase() === imp.title?.toLowerCase() && t.artist?.toLowerCase() === imp.artist?.toLowerCase())
        )
        if (idx !== -1) {
          let changed = false
          if (!existing[idx].yt_url  && imp.yt_url)  { existing[idx].yt_url  = imp.yt_url;  changed = true }
          if (!existing[idx].lyrics  && imp.lyrics)  { existing[idx].lyrics  = imp.lyrics;  changed = true }
          if (changed) { existing[idx].updated_at = Date.now(); merged++ }
        }
        continue
      }

      existing.push({
        id:         uuidv4(),
        title:      imp.title    || 'Desconhecido',
        artist:     imp.artist   || 'Desconhecido',
        album:      imp.album    || '',
        duration:   imp.duration || 0,
        file_path:  imp.file_path || '',
        cover_path: null,
        genre:      imp.genre    || '',
        year:       imp.year     || null,
        gain:       imp.gain     || 0,
        lyrics:     imp.lyrics   || '',
        yt_url:     imp.yt_url   || '',
        created_at: Date.now(),
        updated_at: Date.now(),
      })
      existingKeys.add(key)
      added++
    }

    db.tracks.write(existing)
    return { ok: true, added, merged }
  })
}

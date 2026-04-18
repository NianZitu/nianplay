/**
 * Lightweight JSON-based storage for NianPlay.
 * Zero native compilation — works in any Electron version.
 * Each "table" is a JSON file in userData.
 */
const path = require('path')
const fs   = require('fs')

class JSONStore {
  constructor(filePath, defaultValue) {
    this.filePath     = filePath
    this.defaultValue = defaultValue
  }

  read() {
    try {
      if (!fs.existsSync(this.filePath)) return structuredClone(this.defaultValue)
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8'))
    } catch {
      return structuredClone(this.defaultValue)
    }
  }

  write(data) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8')
  }
}

let _db = null

function initDB() {
  const { app } = require('electron')
  const dataDir = app.getPath('userData')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

  _db = {
    tracks:          new JSONStore(path.join(dataDir, 'tracks.json'),           []),
    settings:        new JSONStore(path.join(dataDir, 'settings.json'),         {}),
    downloads:       new JSONStore(path.join(dataDir, 'downloads.json'),        []),
    playlists:       new JSONStore(path.join(dataDir, 'playlists.json'),        []),
    playlistTracks:  new JSONStore(path.join(dataDir, 'playlist_tracks.json'),  []),
    playlistGroups:  new JSONStore(path.join(dataDir, 'playlist_groups.json'),  []),
  }

  console.log('[DB] Initialized at', dataDir)
  return _db
}

function getDB() {
  if (!_db) throw new Error('DB not initialized. Call initDB() first.')
  return _db
}

module.exports = { initDB, getDB }

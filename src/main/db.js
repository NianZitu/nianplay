/**
 * Lightweight JSON-based storage for NianPlay.
 * Zero native compilation — works in any Electron version.
 * Each "table" is a JSON file in userData.
 *
 * Performance: each store is parsed once and kept in memory. read() returns the
 * cached value (handlers mutate it and call write()), and write() schedules a
 * debounced, asynchronous, atomic flush to disk instead of blocking the main
 * process with writeFileSync on every IPC call. flushAllSync() runs on quit.
 */
const path = require('path')
const fs   = require('fs')

const FLUSH_DELAY_MS = 400

class JSONStore {
  constructor(filePath, defaultValue) {
    this.filePath     = filePath
    this.defaultValue = defaultValue
    this._data        = undefined
    this._timer       = null
    this._writing     = false
    this._dirty       = false
    this._closed      = false
    this._failures    = 0
  }

  read() {
    if (this._data === undefined) this._data = this._load()
    return this._data
  }

  write(data) {
    this._data  = data
    this._dirty = true
    clearTimeout(this._timer)
    this._timer = setTimeout(() => this._flush(), FLUSH_DELAY_MS)
  }

  _load() {
    try {
      if (!fs.existsSync(this.filePath)) return structuredClone(this.defaultValue)
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8'))
    } catch (err) {
      console.error('[DB] Could not read', this.filePath, err.message)
      return structuredClone(this.defaultValue)
    }
  }

  async _flush() {
    this._timer = null
    if (!this._dirty) return
    // One write in flight per file; changes made meanwhile trigger another flush
    if (this._writing) { this._timer = setTimeout(() => this._flush(), FLUSH_DELAY_MS); return }
    this._writing = true
    this._dirty   = false
    const json = JSON.stringify(this._data)
    const tmp  = `${this.filePath}.tmp`
    try {
      await fs.promises.writeFile(tmp, json, 'utf8')
      // flushSync() already wrote the final state on quit — don't replace it with this older copy
      if (this._closed) { fs.promises.unlink(tmp).catch(() => {}); return }
      await fs.promises.rename(tmp, this.filePath)
    } catch (err) {
      if (this._closed) return
      // rename can fail on Windows if the file is briefly locked (antivirus, indexer)
      try {
        await fs.promises.writeFile(this.filePath, json, 'utf8')
      } catch (err2) {
        this._failures++
        console.error('[DB] Write failed', this.filePath, err2.message)
        this._dirty = true
      }
    } finally {
      this._writing = false
    }
    if (!this._dirty) { this._failures = 0; return }
    // Retry pending changes; back off (up to 30 s) while the disk keeps failing
    if (!this._timer) {
      const delay = Math.min(30000, FLUSH_DELAY_MS * 2 ** this._failures)
      this._timer = setTimeout(() => this._flush(), delay)
    }
  }

  flushSync() {
    clearTimeout(this._timer)
    this._timer = null
    const pending = this._dirty || this._writing
    this._closed = true
    if (!pending) return
    this._dirty = false
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this._data), 'utf8')
    } catch (err) {
      console.error('[DB] Final write failed', this.filePath, err.message)
    }
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
    // Player session lives apart from settings: it changes often and the queue is large
    playerSession:   new JSONStore(path.join(dataDir, 'player_session.json'),   {}),
  }

  console.log('[DB] Initialized at', dataDir)
  return _db
}

function getDB() {
  if (!_db) throw new Error('DB not initialized. Call initDB() first.')
  return _db
}

function flushAllSync() {
  if (!_db) return
  for (const store of Object.values(_db)) store.flushSync()
}

module.exports = { initDB, getDB, flushAllSync }

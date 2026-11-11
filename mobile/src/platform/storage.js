// JSON "tables" for the iPhone app — same model as the desktop's src/main/db.js: each table is
// loaded once into memory, read() returns the cached value (callers mutate it and call write()),
// and writes are flushed to disk in the background (debounced). iOS may kill a backgrounded app
// at any moment, so flushAll() also runs when the app goes to the background (see platform.js).
//
// Files live in the app's private Library directory (not visible in the Files app, included in
// iPhone backups): Library/nianplay/<table>.json

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'

const DIR = 'nianplay'
const FLUSH_DELAY_MS = 400

class JSONStore {
  constructor(name, defaultValue) {
    this.path = `${DIR}/${name}.json`
    this.defaultValue = defaultValue
    this._data = undefined
    this._timer = null
    this._dirty = false
    this._writing = null
  }

  async load() {
    try {
      const res = await Filesystem.readFile({ path: this.path, directory: Directory.Library, encoding: Encoding.UTF8 })
      this._data = JSON.parse(typeof res.data === 'string' ? res.data : await res.data.text())
    } catch {
      this._data = structuredClone(this.defaultValue)   // first run or unreadable file
    }
  }

  read() {
    if (this._data === undefined) this._data = structuredClone(this.defaultValue)
    return this._data
  }

  write(data) {
    this._data = data
    this._dirty = true
    clearTimeout(this._timer)
    this._timer = setTimeout(() => this.flush(), FLUSH_DELAY_MS)
  }

  async flush() {
    clearTimeout(this._timer)
    this._timer = null
    if (this._writing) await this._writing
    if (!this._dirty) return
    this._dirty = false
    const json = JSON.stringify(this._data)
    this._writing = Filesystem.writeFile({
      path: this.path, directory: Directory.Library, encoding: Encoding.UTF8, data: json, recursive: true,
    }).catch(err => {
      console.error('[storage] write failed', this.path, err)
      this._dirty = true
    }).finally(() => { this._writing = null })
    await this._writing
  }
}

export const db = {
  tracks:         new JSONStore('tracks', []),
  playlists:      new JSONStore('playlists', []),
  playlistTracks: new JSONStore('playlist_tracks', []),
  playlistGroups: new JSONStore('playlist_groups', []),
  settings:       new JSONStore('settings', {}),
  playerSession:  new JSONStore('player_session', {}),
}

export async function loadAll() {
  await Promise.all(Object.values(db).map(s => s.load()))
}

export async function flushAll() {
  await Promise.all(Object.values(db).map(s => s.flush()))
}

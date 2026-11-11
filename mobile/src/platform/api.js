// window.electron for the iPhone app.
//
// The shared renderer code (PlayerContext, AuthContext's cloud sync) talks to the desktop's main
// process through window.electron.*. This is the same API, implemented on top of storage.js, with
// the same behaviour as the desktop handlers (src/main/handlers/library.js and playlists.js) for
// the calls the phone uses. Desktop-only features (yt-dlp downloads, LUFS measuring, Spotify,
// YouTube export, folder dialogs, window controls, updater) are not part of the phone app.

import { App } from '@capacitor/app'
import { CapacitorHttp } from '@capacitor/core'
import { Filesystem } from '@capacitor/filesystem'
import { db } from './storage'
import { splitStored, isNative } from './paths'
import { canonicalUrl, urlKey } from '../../../src/renderer/utils/mediaUrl'
import {
  findByName, uniqueName, duplicateNameError, findTrackMatch, normalizeCutSegments, uuid,
} from './rules'

const GROUP_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#db2777']
const now = () => Date.now()
const listeners = { thumbs: new Set(), library: new Set() }

export function notifyLibraryChanged() {
  for (const cb of listeners.library) { try { cb() } catch {} }
}

// ── Library ──────────────────────────────────────────────────────────────────
const library = {
  getTracks: async () => [...db.tracks.read()].sort((a, b) =>
    `${a.artist}${a.album}${a.title}`.localeCompare(`${b.artist}${b.album}${b.title}`)),

  getTrack: async id => db.tracks.read().find(t => t.id === id) || null,

  updateTrack: async updated => {
    const tracks = db.tracks.read()
    const idx = tracks.findIndex(t => t.id === updated.id)
    if (idx === -1) return false
    tracks[idx] = {
      ...tracks[idx],
      ...updated,
      ...('yt_url' in updated ? { yt_url: canonicalUrl(updated.yt_url) } : {}),
      cut_segments: normalizeCutSegments(updated.cut_segments ?? tracks[idx].cut_segments),
      updated_at: now(),
    }
    db.tracks.write(tracks)
    return true
  },

  // Removes the track from the library and its playlists. A copy imported into the app is
  // deleted too (it only exists for this track); files in the user's Documents folder are kept.
  removeTrack: async id => {
    const tracks = db.tracks.read()
    const track = tracks.find(t => t.id === id)
    if (!track) return false
    db.tracks.write(tracks.filter(t => t.id !== id))
    db.playlistTracks.write(db.playlistTracks.read().filter(r => r.track_id !== id))
    for (const p of [track.file_path, track.cover_path, track.cover_thumb]) {
      if (p?.startsWith('nian-lib://') && isNative()) {
        const s = splitStored(p)
        Filesystem.deleteFile({ path: s.path, directory: s.directory }).catch(() => {})
      }
    }
    notifyLibraryChanged()
    return true
  },

  // Same as the desktop's library:importVirtualTrack — used by "Baixar da nuvem"
  importVirtualTrack: async track => {
    const tracks = db.tracks.read()
    const key = urlKey(track.yt_url)
    if (key) {
      const byUrl = tracks.find(t => urlKey(t.yt_url) === key)
      if (byUrl) {
        let changed = false
        if (!byUrl.lyrics && track.lyrics) { byUrl.lyrics = track.lyrics; changed = true }
        if (!byUrl.gain && track.gain)     { byUrl.gain = track.gain; changed = true }
        if (!byUrl.album && track.album)   { byUrl.album = track.album; changed = true }
        if ((!byUrl.cut_segments || byUrl.cut_segments.length === 0) && track.cut_segments?.length) {
          byUrl.cut_segments = normalizeCutSegments(track.cut_segments); changed = true
        }
        if (changed) { byUrl.updated_at = now(); db.tracks.write(tracks) }
        return { skipped: true, id: byUrl.id }
      }
    }
    const byMeta = findTrackMatch(tracks, track)
    if (byMeta) {
      let changed = false
      if (!byMeta.yt_url && track.yt_url) { byMeta.yt_url = canonicalUrl(track.yt_url); changed = true }
      if (!byMeta.lyrics && track.lyrics) { byMeta.lyrics = track.lyrics; changed = true }
      if (!byMeta.gain && track.gain)     { byMeta.gain = track.gain; changed = true }
      if ((!byMeta.cut_segments || byMeta.cut_segments.length === 0) && track.cut_segments?.length) {
        byMeta.cut_segments = normalizeCutSegments(track.cut_segments); changed = true
      }
      if (changed) { byMeta.updated_at = now(); db.tracks.write(tracks) }
      return { skipped: true, id: byMeta.id }
    }
    const newTrack = {
      id: uuid(),
      title: track.title || '',
      artist: track.artist || '',
      album: track.album || '',
      duration: track.duration || 0,
      file_path: '',
      yt_url: canonicalUrl(track.yt_url),
      cover_url: track.cover_url || '',
      lyrics: track.lyrics || '',
      gain: track.gain || 0,
      cut_segments: normalizeCutSegments(track.cut_segments),
      created_at: now(),
      updated_at: now(),
    }
    db.tracks.write([...tracks, newTrack])
    return { id: newTrack.id }
  },

  onThumbsUpdated: () => () => {},
  onChanged: cb => { listeners.library.add(cb); return () => listeners.library.delete(cb) },
}

// ── Playlists ────────────────────────────────────────────────────────────────
const playlists = {
  getAll: async () => {
    const counts = new Map()
    for (const r of db.playlistTracks.read()) counts.set(r.playlist_id, (counts.get(r.playlist_id) || 0) + 1)
    return db.playlists.read()
      .map(p => ({ ...p, trackCount: counts.get(p.id) || 0 }))
      .sort((a, b) => b.created_at - a.created_at)
  },

  create: async ({ name, cover_url }) => {
    const list = db.playlists.read()
    const clean = (name || '').trim().replace(/\s+/g, ' ')
    if (!clean) return { error: 'Dê um nome para a playlist.' }
    if (findByName(list, clean)) return { error: duplicateNameError(clean) }
    const playlist = { id: uuid(), name: clean, cover_url: cover_url || '', created_at: now(), updated_at: now() }
    list.unshift(playlist)
    db.playlists.write(list)
    return playlist
  },

  update: async ({ id, name, cover_url }) => {
    const list = db.playlists.read()
    const idx = list.findIndex(p => p.id === id)
    if (idx === -1) return false
    const clean = (name ?? list[idx].name ?? '').trim().replace(/\s+/g, ' ')
    if (!clean) return { error: 'Dê um nome para a playlist.' }
    if (findByName(list, clean, id)) return { error: duplicateNameError(clean) }
    list[idx] = { ...list[idx], name: clean, cover_url: cover_url ?? list[idx].cover_url, updated_at: now() }
    db.playlists.write(list)
    return list[idx]
  },

  delete: async id => {
    db.playlists.write(db.playlists.read().filter(p => p.id !== id))
    db.playlistTracks.write(db.playlistTracks.read().filter(r => r.playlist_id !== id))
    db.playlistGroups.write(db.playlistGroups.read().filter(g => g.playlist_id !== id))
    return true
  },

  getTracks: async playlistId => {
    const rows = db.playlistTracks.read().filter(r => r.playlist_id === playlistId).sort((a, b) => a.position - b.position)
    const byId = new Map(db.tracks.read().map(t => [t.id, t]))
    return rows.map(r => {
      const t = byId.get(r.track_id)
      return t ? { ...t, position: r.position ?? 0, group_id: r.group_id || null, group_position: r.group_position ?? 0 } : null
    }).filter(Boolean)
  },

  addTrack: async (playlistId, trackId) => {
    const rows = db.playlistTracks.read()
    if (rows.find(r => r.playlist_id === playlistId && r.track_id === trackId)) return false
    const maxPos = rows.filter(r => r.playlist_id === playlistId).reduce((m, r) => Math.max(m, r.position), -1)
    rows.push({ id: uuid(), playlist_id: playlistId, track_id: trackId, position: maxPos + 1 })
    db.playlistTracks.write(rows)
    return true
  },

  removeTrack: async (playlistId, trackId) => {
    db.playlistTracks.write(db.playlistTracks.read().filter(r => !(r.playlist_id === playlistId && r.track_id === trackId)))
    return true
  },

  getGroups: async playlistId => db.playlistGroups.read().filter(g => g.playlist_id === playlistId),

  createGroup: async (playlistId, name) => {
    const groups = db.playlistGroups.read()
    const used = groups.filter(g => g.playlist_id === playlistId).map(g => g.color)
    const group = { id: uuid(), playlist_id: playlistId, name, color: GROUP_COLORS.find(c => !used.includes(c)) || GROUP_COLORS[0], created_at: now() }
    groups.push(group)
    db.playlistGroups.write(groups)
    return group
  },

  setTrackGroup: async (playlistId, trackId, groupId, position) => {
    const rows = db.playlistTracks.read()
    const row = rows.find(r => r.playlist_id === playlistId && r.track_id === trackId)
    if (!row) return false
    if (!groupId) { row.group_id = null; row.group_position = 0 }
    else {
      row.group_id = groupId
      row.group_position = position ?? (rows.filter(r => r.playlist_id === playlistId && r.group_id === groupId)
        .reduce((m, r) => Math.max(m, r.group_position ?? -1), -1) + 1)
    }
    db.playlistTracks.write(rows)
    return true
  },

  // Same as the desktop's playlists:deleteGroup — the tracks stay in the playlist, ungrouped
  deleteGroup: async groupId => {
    db.playlistGroups.write(db.playlistGroups.read().filter(g => g.id !== groupId))
    const rows = db.playlistTracks.read()
    rows.forEach(r => { if (r.group_id === groupId) { r.group_id = null; r.group_position = 0 } })
    db.playlistTracks.write(rows)
    return true
  },

  reorderGroup: async (playlistId, groupId, orderedTrackIds) => {
    const rows = db.playlistTracks.read()
    orderedTrackIds.forEach((trackId, i) => {
      const row = rows.find(r => r.playlist_id === playlistId && r.group_id === groupId && r.track_id === trackId)
      if (row) row.group_position = i
    })
    db.playlistTracks.write(rows)
    return true
  },

  toggleGroups: async id => {
    const list = db.playlists.read()
    const p = list.find(x => x.id === id)
    if (!p) return false
    p.groups_enabled = !p.groups_enabled
    p.updated_at = now()
    db.playlists.write(list)
    return p
  },
}

// ── Settings / player session ───────────────────────────────────────────────
const settings = {
  get: async key => db.settings.read()[key] ?? null,
  set: async (key, value) => { const all = db.settings.read(); all[key] = value; db.settings.write(all); return true },
  getAll: async () => db.settings.read(),
}

const player = {
  getSession: async () => db.playerSession.read(),
  saveState: async state => { db.playerSession.write({ ...db.playerSession.read(), state }); return true },
  saveQueue: async queue => { db.playerSession.write({ ...db.playerSession.read(), queue: Array.isArray(queue) ? queue : [] }); return true },
}

// lyrics.ovh — on the phone through the native HTTP layer (CapacitorHttp), so CORS doesn't apply.
// (Only here: enabling CapacitorHttp globally would also replace XMLHttpRequest, which Firestore uses.)
const lyrics = {
  fetch: async ({ title, artist }) => {
    if (!title) return { error: 'Título não informado' }
    try {
      const t = encodeURIComponent(title.trim())
      const a = encodeURIComponent((artist || '').trim()) || 'unknown'
      const url = `https://api.lyrics.ovh/v1/${a}/${t}`
      let status, data
      if (isNative()) {
        const res = await CapacitorHttp.get({ url, responseType: 'json', connectTimeout: 8000, readTimeout: 8000 })
        status = res.status; data = typeof res.data === 'string' ? JSON.parse(res.data || '{}') : res.data
      } else {
        const res = await fetch(url)
        status = res.status; data = res.ok ? await res.json() : null
      }
      if (status < 200 || status >= 300) return { error: status === 404 ? 'Letra não encontrada' : `HTTP ${status}` }
      return data?.lyrics ? { lyrics: data.lyrics.trim() } : { error: 'Letra não encontrada' }
    } catch (err) {
      return { error: err.message }
    }
  },
}

const app = {
  getVersion: async () => {
    if (!isNative()) return 'web'
    try { return (await App.getInfo()).version } catch { return '' }
  },
  openYoutube: async url => { window.open(canonicalUrl(url), '_blank'); return true },
}

export function installElectronApi() {
  window.electron = { app, library, playlists, settings, player, lyrics }
}

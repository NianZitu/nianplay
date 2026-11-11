// Rules shared with the desktop, ported as ES modules. Keep them identical to:
//   playlist names  → src/main/playlistNames.js
//   track matching  → src/main/trackMatch.js (findTrackMatch)
//   cut segments    → normalizeCutSegments in src/main/handlers/library.js

import { normalizePlaylistName } from '../../../src/renderer/firebase'
import { urlKey } from '../../../src/renderer/utils/mediaUrl'

export { normalizePlaylistName }

export function findByName(playlists, name, exceptId = null) {
  const key = normalizePlaylistName(name)
  if (!key) return null
  return playlists.find(p => p.id !== exceptId && normalizePlaylistName(p.name) === key) || null
}

export function uniqueName(playlists, base, exceptId = null) {
  const clean = (base || '').trim().replace(/\s+/g, ' ') || 'Playlist'
  if (!findByName(playlists, clean, exceptId)) return clean
  const stem = clean.replace(/\s\(\d+\)$/, '')
  for (let n = 2; n < 10000; n++) {
    const candidate = `${stem} (${n})`
    if (!findByName(playlists, candidate, exceptId)) return candidate
  }
  return `${stem} (${Date.now()})`
}

export const duplicateNameError = name =>
  `Já existe uma playlist chamada "${(name || '').trim()}". Escolha outro nome — playlists com o mesmo nome se misturariam na nuvem.`

const norm = s => (s || '').toLowerCase().trim()

// Link first; otherwise only when title + artist (+ duration or album) identify exactly one track
export function findTrackMatch(tracks, track) {
  const key = urlKey(track.yt_url)
  if (key) {
    const byUrl = tracks.find(t => urlKey(t.yt_url) === key)
    if (byUrl) return byUrl
  }
  const title = norm(track.title)
  const artist = norm(track.artist)
  const album = norm(track.album)
  const duration = Math.round(track.duration || 0)
  let matches = tracks.filter(t =>
    norm(t.title) === title && norm(t.artist) === artist &&
    Math.abs(Math.round(t.duration || 0) - duration) <= 2)
  if (matches.length === 1) return matches[0]
  matches = tracks.filter(t => norm(t.title) === title && norm(t.artist) === artist && norm(t.album) === album)
  if (matches.length === 1) return matches[0]
  matches = tracks.filter(t => norm(t.title) === title && norm(t.artist) === artist)
  return matches.length === 1 ? matches[0] : null
}

export function normalizeCutSegments(cuts) {
  return (Array.isArray(cuts) ? cuts : [])
    .map(cut => ({ start: Number(cut.start) || 0, end: Number(cut.end) || 0, label: cut.label || '' }))
    .filter(cut => cut.end > cut.start)
    .sort((a, b) => a.start - b.start)
}

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    }))

// NianPlay cloud playlists.
//
// Every playlist the user sends to the cloud is published in the Firestore collection
// "communityPlaylists" (the app's "Comunidade" page), readable without login. Each document has
// the tracks in playlist order with yt_url, gain (LUFS), cut_segments, group_name/group_position,
// plus the groups list. The app's "Copiar link do bot" button gives "nianplay://playlist/<id>".
const config = require('../config')
const { canonicalUrl, youtubeVideoId } = require('./mediaUrl')

const BASE = () => `https://firestore.googleapis.com/v1/projects/${config.firebaseProjectId}/databases/(default)/documents`
const CACHE_MS = 60_000
let listCache = { at: 0, items: [] }

// Firestore REST typed value → plain JS
function decode(v) {
  if (!v || typeof v !== 'object') return v
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('nullValue' in v) return null
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode)
  if ('mapValue' in v) return decodeFields(v.mapValue.fields)
  return null
}
const decodeFields = fields => Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, decode(v)]))

function fromDoc(doc) {
  const f = decodeFields(doc.fields)
  return {
    id: doc.name.split('/').pop(),
    name: f.name || 'Playlist sem nome',
    owner: f.owner_name || '',
    coverUrl: /^https?:\/\//.test(f.cover_url || '') ? f.cover_url : '',
    updatedAt: f.updatedAt ? Date.parse(f.updatedAt) : 0,
    groups: Array.isArray(f.groups) ? f.groups : [],
    tracks: Array.isArray(f.tracks) ? f.tracks : [],
  }
}

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error?.message || `Nuvem do NianPlay respondeu ${res.status}`)
  return data
}

// All published playlists (cached 60s), most recently updated first
async function listPlaylists({ fresh = false } = {}) {
  if (!fresh && Date.now() - listCache.at < CACHE_MS) return listCache.items
  const items = []
  let pageToken = ''
  do {
    const url = `${BASE()}/communityPlaylists?pageSize=300&key=${config.firebaseApiKey}` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')
    const data = await getJson(url)
    for (const doc of data.documents || []) items.push(fromDoc(doc))
    pageToken = data.nextPageToken || ''
  } while (pageToken)
  items.sort((a, b) => b.updatedAt - a.updatedAt)
  listCache = { at: Date.now(), items }
  return items
}

async function getPlaylist(id) {
  const data = await getJson(`${BASE()}/communityPlaylists/${encodeURIComponent(id)}?key=${config.firebaseApiKey}`)
  return fromDoc(data)
}

// "nianplay://playlist/p_abc123", a link containing it, or the bare id
function parsePlaylistId(input) {
  const m = (input || '').trim().match(/(?:^|[/:=\s])(p_[a-z0-9]{3,16})(?:$|[/?#&\s])/i) || (input || '').trim().match(/^(p_[a-z0-9]{3,16})$/i)
  return m ? m[1].toLowerCase() : null
}

const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Name search for autocomplete / free text: exact > starts with > contains
async function searchPlaylists(text, limit = 25) {
  const all = await listPlaylists()
  const q = norm(text)
  if (!q) return all.slice(0, limit)
  const scored = all
    .map(p => {
      const n = norm(p.name)
      const score = n === q ? 3 : n.startsWith(q) ? 2 : n.includes(q) ? 1 : (norm(p.owner).includes(q) ? 0.5 : 0)
      return { p, score }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || b.p.updatedAt - a.p.updatedAt)
  return scored.slice(0, limit).map(x => x.p)
}

// Link/id → that playlist; otherwise the best name match (most recent among equals)
async function findPlaylist(input) {
  const id = parsePlaylistId(input)
  if (id) return getPlaylist(id)
  const found = await searchPlaylists(input, 1)
  if (!found.length) throw new Error(`Nenhuma playlist do NianPlay encontrada para "${input}".`)
  return found[0]
}

// Cloud track → queue item. Tracks without a link are searched on YouTube when they play.
function toQueueItem(track, playlist, { withGroup }) {
  const url = youtubeVideoId(track.yt_url) ? canonicalUrl(track.yt_url) : ''
  const artist = /^(desconhecido|unknown|desconocido)$/i.test(track.artist || '') ? '' : (track.artist || '')
  const groupMeta = withGroup && track.group_name
    ? (playlist.groups.find(g => g.name === track.group_name) || { name: track.group_name })
    : null
  return {
    title: track.title || 'Sem título',
    artist,
    duration: Number(track.duration) || 0,
    url,
    query: url ? '' : [artist, track.title].filter(Boolean).join(' - '),
    source: 'nianplay',
    playlistName: playlist.name,
    gain: Number(track.gain) || 0,
    cuts: Array.isArray(track.cut_segments) ? track.cut_segments : [],
    lyrics: track.lyrics || '',
    group: groupMeta ? {
      key: `${playlist.id}:${groupMeta.name}`,
      name: groupMeta.name,
      color: groupMeta.color || '',
      position: Number(track.group_position) || 0,
    } : null,
  }
}

module.exports = { listPlaylists, getPlaylist, findPlaylist, searchPlaylists, parsePlaylistId, toQueueItem, decode }

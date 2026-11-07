// Spotify links → queue items. Spotify audio can't be streamed (DRM), so — like every music bot —
// each track is played from YouTube, searched by "artist - title" when its turn comes.
const config = require('../config')

const SPOTIFY_RE = /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist)\/([A-Za-z0-9]+)/i
const parseSpotify = url => {
  const m = (url || '').trim().match(SPOTIFY_RE)
  return m ? { type: m[1].toLowerCase(), id: m[2] } : null
}

const item = (name, artist, durationMs) => ({
  title: name || 'Sem título',
  artist: artist || '',
  duration: Math.round((Number(durationMs) || 0) / 1000),
  url: '',
  query: [artist, name].filter(Boolean).join(' - '),
  source: 'spotify',
})

// ── Official Web API (optional, client credentials) ─────────────────────────────
let token = { value: '', expires: 0 }
async function apiToken() {
  if (token.value && Date.now() < token.expires - 60_000) return token.value
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${config.spotifyClientId}:${config.spotifyClientSecret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) throw new Error('Spotify recusou as credenciais (SPOTIFY_CLIENT_ID/SECRET)')
  token = { value: data.access_token, expires: Date.now() + (data.expires_in || 3600) * 1000 }
  return token.value
}

async function apiGet(url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${await apiToken()}` }, signal: AbortSignal.timeout(15000) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error?.message || `Spotify respondeu ${res.status}`)
  return data
}

async function resolveWithApi({ type, id }) {
  const API = 'https://api.spotify.com/v1'
  if (type === 'track') {
    const t = await apiGet(`${API}/tracks/${id}`)
    return { title: t.name, items: [item(t.name, t.artists?.map(a => a.name).join(', '), t.duration_ms)] }
  }
  const head = await apiGet(`${API}/${type}s/${id}${type === 'playlist' ? '?fields=name' : ''}`)
  const items = []
  let next = type === 'playlist'
    ? `${API}/playlists/${id}/tracks?limit=100&fields=items(track(name,artists(name),duration_ms)),next`
    : `${API}/albums/${id}/tracks?limit=50`
  while (next && items.length < config.maxQueue) {
    const page = await apiGet(next)
    for (const it of page.items || []) {
      const t = type === 'playlist' ? it.track : it
      if (t?.name) items.push(item(t.name, t.artists?.map(a => a.name).join(', '), t.duration_ms))
    }
    next = page.next
  }
  return { title: head.name, items }
}

// ── Public embed (no credentials; playlists/albums up to ~100 tracks) ───────────
async function resolveWithEmbed(url) {
  const { getData, getTracks } = require('spotify-url-info')(fetch)
  const data = await getData(url)
  const tracks = await getTracks(url)
  return {
    title: data?.name || data?.title || '',
    items: (tracks || []).map(t => item(t.name || t.title, t.artist || t.subtitle, t.duration)),
  }
}

async function resolveSpotify(url) {
  const parsed = parseSpotify(url)
  if (!parsed) throw new Error('Link do Spotify não reconhecido (use faixa, álbum ou playlist).')
  if (config.spotifyClientId && config.spotifyClientSecret) {
    try { return await resolveWithApi(parsed) } catch (e) { console.warn('[Spotify] API falhou, usando embed:', e.message) }
  }
  const res = await resolveWithEmbed(url)
  if (!res.items.length) throw new Error('Não consegui ler esse link do Spotify (privado ou indisponível).')
  return res
}

module.exports = { parseSpotify, resolveSpotify }

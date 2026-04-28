const { getDB } = require('../db')

function extractVideoId(url) {
  if (!url) return null
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?[^#]*v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return /^[a-zA-Z0-9_-]{11}$/.test(url) ? url : null
}

function normalizeTitle(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.(mp3|flac|wav|aac|ogg|m4a|opus|wma|webm|mp4)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleScore(a, b) {
  a = normalizeTitle(a)
  b = normalizeTitle(b)
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length)
  }

  const aWords = new Set(a.split(' ').filter(w => w.length > 1))
  const bWords = new Set(b.split(' ').filter(w => w.length > 1))
  if (!aWords.size || !bWords.size) return 0

  let hits = 0
  for (const word of aWords) {
    if (bWords.has(word)) hits++
  }
  return hits / Math.max(aWords.size, bWords.size)
}

function backfillYoutubeUrlsFromDownloads(db, rows, tracks) {
  const downloads = db.downloads.read()
    .filter(d => d.status === 'done' && d.title && extractVideoId(d.url))
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))

  if (!downloads.length) return { repaired: 0 }

  const rowTrackIds = new Set(rows.map(r => r.track_id))
  let repaired = 0

  for (const track of tracks) {
    if (!rowTrackIds.has(track.id) || track.yt_url) continue

    let best = null
    const fileName = require('path').basename(track.file_path || '')
    for (const download of downloads) {
      const score = Math.max(
        titleScore(track.title, download.title),
        titleScore(fileName, download.title)
      )
      if (!best || score > best.score) best = { score, download }
    }

    if (best && best.score >= 0.72) {
      track.yt_url = best.download.url
      track.updated_at = Date.now()
      repaired++
    }
  }

  if (repaired > 0) db.tracks.write(tracks)
  return { repaired }
}

async function youtubeFetch(url, token, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data
}

async function getAccessToken({ clientId, clientSecret, refreshToken }) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    throw new Error(data?.error_description || data?.error || 'Falha ao autenticar no YouTube')
  }
  return data.access_token
}

module.exports = function registerYoutubeHandlers(ipcMain) {
  ipcMain.handle('youtube:exportPlaylist', async (_, { playlistId, privacyStatus = 'private' }) => {
    try {
      const db = getDB()
      const settings = db.settings.read()
      const clientId = (settings.youtubeClientId || '').trim()
      const clientSecret = (settings.youtubeClientSecret || '').trim()
      const refreshToken = (settings.youtubeRefreshToken || '').trim()

      if (!clientId || !clientSecret || !refreshToken) {
        return { error: 'Configure Client ID, Client Secret e Refresh Token do YouTube nas configuraÃ§Ãµes.' }
      }

      const playlist = db.playlists.read().find(p => p.id === playlistId)
      if (!playlist) return { error: 'Playlist nÃ£o encontrada' }

      const rows = db.playlistTracks.read()
        .filter(r => r.playlist_id === playlistId)
        .sort((a, b) => a.position - b.position)
      const tracks = db.tracks.read()

      const { repaired } = backfillYoutubeUrlsFromDownloads(db, rows, tracks)

      const playlistTracks = rows
        .map(r => tracks.find(t => t.id === r.track_id))
        .filter(Boolean)

      const videoIds = playlistTracks
        .map(t => extractVideoId(t.yt_url))
        .filter(Boolean)

      if (!videoIds.length) {
        return {
          error: repaired
            ? 'Encontrei links no historico, mas nenhum deles tinha um video individual valido do YouTube para esta playlist.'
            : 'Nenhuma faixa desta playlist tem link do YouTube salvo nos metadados ou no historico de downloads.',
        }
      }

      const token = await getAccessToken({ clientId, clientSecret, refreshToken })
      const privacy = ['private', 'unlisted', 'public'].includes(privacyStatus) ? privacyStatus : 'private'

      const created = await youtubeFetch(
        'https://www.googleapis.com/youtube/v3/playlists?part=snippet,status',
        token,
        {
          snippet: {
            title: playlist.name || 'NianPlay Playlist',
            description: 'Playlist criada pelo NianPlay.',
          },
          status: { privacyStatus: privacy },
        }
      )

      const youtubePlaylistId = created.id
      let added = 0
      const failed = []

      for (const videoId of videoIds) {
        try {
          await youtubeFetch(
            'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet',
            token,
            {
              snippet: {
                playlistId: youtubePlaylistId,
                resourceId: { kind: 'youtube#video', videoId },
              },
            }
          )
          added++
        } catch (e) {
          failed.push({ videoId, error: e.message })
        }
      }

      return {
        ok: true,
        playlistId: youtubePlaylistId,
        url: `https://www.youtube.com/playlist?list=${youtubePlaylistId}`,
        added,
        skipped: playlistTracks.length - videoIds.length,
        repaired,
        failed,
      }
    } catch (e) {
      return { error: e.message }
    }
  })
}

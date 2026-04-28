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
      const videoIds = rows
        .map(r => tracks.find(t => t.id === r.track_id))
        .filter(Boolean)
        .map(t => extractVideoId(t.yt_url))
        .filter(Boolean)

      if (!videoIds.length) {
        return { error: 'Nenhuma faixa desta playlist tem link do YouTube salvo nos metadados.' }
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
        skipped: rows.length - videoIds.length,
        failed,
      }
    } catch (e) {
      return { error: e.message }
    }
  })
}

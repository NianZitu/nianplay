module.exports = function registerSpotifyHandlers(ipcMain) {
  const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

  let _cachedToken = null
  let _tokenExpiry  = 0

  const sleep = ms => new Promise(r => setTimeout(r, ms))

  // Fetch-compatible wrapper using electron.net (bypasses Spotify's Node-fetch blocking)
  function makeFetch(timeoutMs = 20000) {
    return async (url, opts = {}) => {
      const { net } = require('electron')
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout: ${url}`)), timeoutMs)

        const req = net.request({ url: url.toString(), method: (opts && opts.method) || 'GET', redirect: 'follow' })

        const rawHeaders = (opts && opts.headers) || {}
        const headers = {
          'User-Agent':      BROWSER_UA,
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept':          '*/*',
          'Referer':         'https://open.spotify.com/',
          'Origin':          'https://open.spotify.com',
          ...(typeof rawHeaders.entries === 'function'
            ? Object.fromEntries(rawHeaders.entries())
            : rawHeaders),
        }
        for (const [k, v] of Object.entries(headers)) req.setHeader(k, v)

        req.on('response', response => {
          const chunks = []
          response.on('data',  c   => chunks.push(Buffer.from(c)))
          response.on('end',   ()  => {
            clearTimeout(timer)
            const body = Buffer.concat(chunks).toString('utf8')
            resolve({
              ok:     response.statusCode >= 200 && response.statusCode < 300,
              status: response.statusCode,
              text:   () => Promise.resolve(body),
              json:   () => Promise.resolve(JSON.parse(body)),
            })
          })
          response.on('error', err => { clearTimeout(timer); reject(err) })
        })
        req.on('error', err => { clearTimeout(timer); reject(err) })
        req.end()
      })
    }
  }

  // Token via net.request (proven to work)
  async function getToken() {
    if (_cachedToken && Date.now() < _tokenExpiry - 120_000) return _cachedToken
    const res = await makeFetch()('https://open.spotify.com/get_access_token?reason=transport&productType=web_player')
    if (res.ok) {
      const data = await res.json()
      if (data.accessToken) {
        _cachedToken = data.accessToken
        _tokenExpiry = data.accessTokenExpirationTimestampMs || Date.now() + 3_600_000
        return _cachedToken
      }
    }
    throw new Error('Não foi possível obter token do Spotify')
  }

  // Spotify API call with retry on 429
  async function apiGet(apiUrl, token) {
    const nf = makeFetch()
    for (let i = 0; i < 3; i++) {
      const res = await nf(apiUrl, { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 429) { await sleep(5000); continue }
      const data = await res.json()
      if (data.error) throw new Error(`Spotify API: ${data.error.message}`)
      return data
    }
    throw new Error('Rate limit do Spotify para páginas adicionais.')
  }

  function extractId(url, type) {
    const m = url.match(new RegExp(`/${type}/([a-zA-Z0-9]+)`))
    return m?.[1] || null
  }

  // Convert raw trackList entry → normalised track object
  function toTrack(t) {
    const name = t.title || t.name || ''
    // artist: subtitle (already formatted string) or from artists array
    const artist = t.subtitle ||
      ([].concat(t.artists || []).filter(Boolean).map(a => a.name).join(', ')) ||
      ''
    // Spotify embed duration is in milliseconds
    const duration_ms = typeof t.duration === 'number' ? t.duration : 0
    return { name, artist, query: `${name} ${artist}`.trim(), duration_ms }
  }

  ipcMain.handle('spotify:resolve', async (_, url) => {
    const deadline = new Promise((_, rej) =>
      setTimeout(() => rej(new Error('Tempo limite excedido (90s). Verifique sua conexão.')), 90000)
    )

    const resolve = async () => {
      const nf = makeFetch()
      const { default: SpotifyUrlInfo } = await import('spotify-url-info')
      const { getData } = SpotifyUrlInfo(nf)

      if (url.includes('/playlist/') || url.includes('/album/')) {
        const isPlaylist = url.includes('/playlist/')
        const id = isPlaylist ? extractId(url, 'playlist') : extractId(url, 'album')
        if (!id) return { error: isPlaylist ? 'URL de playlist inválida' : 'URL de álbum inválida' }

        // Fetch embed page → initial track batch
        const data = await getData(url)
        const rawList = Array.isArray(data.trackList) ? data.trackList : (data.trackList ? [data.trackList] : [])
        const tracks  = rawList.map(toTrack)

        // totalCount tells us how many tracks the playlist actually has
        const totalCount = data.totalCount || tracks.length
        console.log(`[Spotify] Got ${tracks.length} / ${totalCount} tracks from embed`)

        // Paginate via API for remaining tracks
        if (tracks.length < totalCount) {
          try {
            const token = await getToken()
            let offset = tracks.length

            while (offset < totalCount) {
              console.log(`[Spotify] Fetching offset ${offset}/${totalCount}...`)
              const apiUrl = isPlaylist
                ? `https://api.spotify.com/v1/playlists/${id}/tracks?limit=100&offset=${offset}&fields=items(track(name,artists,duration_ms)),next,total`
                : `https://api.spotify.com/v1/albums/${id}/tracks?limit=50&offset=${offset}`
              const page = await apiGet(apiUrl, token)
              const items = page.items || []
              if (!items.length) break
              for (const item of items) {
                const t = isPlaylist ? item?.track : item
                if (!t?.name) continue
                const artist = t.artists?.[0]?.name || ''
                tracks.push({ name: t.name, artist, query: `${t.name} ${artist}`.trim(), duration_ms: t.duration_ms || 0 })
              }
              if (!page.next) break
              offset += items.length
            }
          } catch (e) {
            console.warn('[Spotify] Pagination failed:', e.message, '— returning partial results')
          }
        }

        return { type: 'playlist', tracks }
      }

      if (url.includes('/track/')) {
        const data = await getData(url)
        const t = toTrack(data)
        return { type: 'track', tracks: [t] }
      }

      return { error: 'URL do Spotify não reconhecida. Cole um link de playlist, álbum ou música.' }
    }

    try {
      return await Promise.race([resolve(), deadline])
    } catch (err) {
      return { error: err.message }
    }
  })
}

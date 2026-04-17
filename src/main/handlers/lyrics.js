// Fetch lyrics from lyrics.ovh (free, no auth required)
module.exports = function registerLyricsHandlers(ipcMain) {
  ipcMain.handle('lyrics:fetch', async (_, { title, artist }) => {
    if (!title) return { error: 'Título não informado' }
    try {
      const t = encodeURIComponent(title.trim())
      const a = encodeURIComponent((artist || '').trim())
      const url = a
        ? `https://api.lyrics.ovh/v1/${a}/${t}`
        : `https://api.lyrics.ovh/v1/unknown/${t}`

      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) return { error: `HTTP ${res.status}` }
      const data = await res.json()
      if (!data.lyrics) return { error: 'Letra não encontrada' }
      return { lyrics: data.lyrics.trim() }
    } catch (err) {
      return { error: err.message }
    }
  })
}

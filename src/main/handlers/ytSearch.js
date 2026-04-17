const { spawn } = require('child_process')
const fs = require('fs')

module.exports = function registerYtSearchHandlers(ipcMain) {
  ipcMain.handle('ytSearch:search', async (_, query) => {
    const ytDlpBin = require('../ytdlp-path')

    if (!fs.existsSync(ytDlpBin)) {
      return { error: 'yt-dlp ainda não está disponível. Aguarde o download.' }
    }

    return new Promise((resolve) => {
      const args = [
        `ytsearch15:${query}`,
        '--dump-json',
        '--no-download',
        '--flat-playlist',
        '--no-warnings',
      ]

      const proc = spawn(ytDlpBin, args, { windowsHide: true })
      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', chunk => { stdout += chunk.toString() })
      proc.stderr.on('data', chunk => { stderr += chunk.toString() })

      proc.on('error', err => resolve({ error: err.message }))

      proc.on('close', () => {
        try {
          const results = stdout.trim().split('\n')
            .filter(Boolean)
            .map(line => { try { return JSON.parse(line) } catch { return null } })
            .filter(Boolean)
            .map(item => ({
              id:        item.id,
              url:       item.url || `https://www.youtube.com/watch?v=${item.id}`,
              title:     item.title || '',
              duration:  item.duration || 0,
              channel:   item.uploader || item.channel || '',
              thumbnail: item.thumbnail || item.thumbnails?.[0]?.url || '',
            }))
          resolve({ results })
        } catch (e) {
          resolve({ error: e.message || 'Erro ao processar resultados' })
        }
      })
    })
  })
}

const { spawn } = require('child_process')
const { getDB } = require('../db')

function getFFmpegPath() {
  const { app } = require('electron')
  let p = require('ffmpeg-static')
  if (app.isPackaged) p = p.replace('app.asar', 'app.asar.unpacked')
  return p
}

// Measure integrated loudness (LUFS) using the EBU R128 filter.
// ebur128 is more accurate than loudnorm's single-pass estimate because it
// uses the full gating algorithm specified by ITU-R BS.1770-4.
function measureLufs(filePath) {
  const ffmpegPath = getFFmpegPath()

  return new Promise((resolve) => {
    const args = [
      '-nostats',
      '-i', filePath,
      '-filter_complex', 'ebur128=peak=true',
      '-f', 'null',
      '-',
    ]
    const proc = spawn(ffmpegPath, args, { windowsHide: true })
    let stderr = ''
    proc.stderr.on('data', chunk => { stderr += chunk.toString() })
    proc.on('error', err => resolve({ error: err.message }))
    proc.on('close', () => {
      try {
        // The Summary block contains:
        //   Integrated loudness:
        //     I:         -14.3 LUFS
        const match = stderr.match(/Integrated loudness[\s\S]*?I:\s+([-\d.]+)\s+LUFS/)
        if (!match) {
          // Fallback: any "I: X LUFS" line (handles different ffmpeg versions)
          const fallback = stderr.match(/\bI:\s+([-\d.]+)\s+LUFS/)
          if (!fallback) return resolve({ error: 'Não foi possível ler LUFS — ffmpeg não retornou dados EBU R128' })
          const lufs = parseFloat(fallback[1])
          if (isNaN(lufs)) return resolve({ error: 'Valor LUFS inválido' })
          return resolve({ lufs })
        }
        const lufs = parseFloat(match[1])
        if (isNaN(lufs)) return resolve({ error: 'Valor LUFS inválido' })
        resolve({ lufs })
      } catch (e) {
        resolve({ error: e.message })
      }
    })
  })
}

const MAX_GAIN_DB = 12 // cap to avoid clipping / extreme pumping

module.exports = function registerLufsHandlers(ipcMain, mainWindow) {
  function sendProgress(data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('lufs:progress', data)
    }
  }

  ipcMain.handle('lufs:measure', async (_, filePath) => {
    return measureLufs(filePath)
  })

  ipcMain.handle('lufs:equalizePlaylist', async (_, { anchorTrackId, playlistId }) => {
    try {
      const db = getDB()
      const trackById = new Map(db.tracks.read().map(t => [t.id, t]))
      const pt = db.playlistTracks.read().filter(r => r.playlist_id === playlistId)

      const anchorTrack = trackById.get(anchorTrackId)
      if (!anchorTrack) return { error: 'Faixa âncora não encontrada' }

      sendProgress({ phase: 'measuring_anchor', done: 0, total: pt.length + 1 })
      const anchorResult = await measureLufs(anchorTrack.file_path)
      if (anchorResult.error) return { error: `Erro na faixa âncora: ${anchorResult.error}` }

      const anchorLufs = anchorResult.lufs
      const gainById = new Map()
      let done = 1

      for (const row of pt) {
        const track = trackById.get(row.track_id)
        if (!track) { done++; continue }

        sendProgress({ phase: 'measuring', trackId: track.id, title: track.title, done, total: pt.length + 1 })
        const result = await measureLufs(track.file_path)

        if (!result.error) {
          // Clamp gain so we never boost/cut more than MAX_GAIN_DB
          const raw    = anchorLufs - result.lufs
          const gainDb = Math.max(-MAX_GAIN_DB, Math.min(MAX_GAIN_DB, raw))
          gainById.set(track.id, parseFloat(gainDb.toFixed(2)))
        }
        done++
      }

      // Also set anchor track gain to 0 (it IS the reference)
      gainById.set(anchorTrackId, 0)

      // Measuring takes a while — apply gains to the library as it is NOW, so edits
      // made during the analysis (scan, Maestro, sync) are not overwritten
      const tracks = db.tracks.read()
      tracks.forEach((t, i) => {
        if (gainById.has(t.id)) tracks[i] = { ...t, gain: gainById.get(t.id) }
      })
      db.tracks.write(tracks)
      sendProgress({ phase: 'done', done: pt.length + 1, total: pt.length + 1, anchorLufs })
      return { ok: true, anchorLufs }
    } catch (e) {
      return { error: e.message }
    }
  })
}

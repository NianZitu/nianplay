// Audio stream for one track: ffmpeg reads the direct YouTube audio URL and outputs raw PCM for
// Discord (48 kHz stereo). Nothing is written to disk. NianPlay's per-track LUFS gain and cut
// segments are applied here with ffmpeg filters, so playlists sound like in the app.
const { spawn } = require('child_process')
const config = require('../config')

// Cut segments (seconds of the original audio), sorted and merged — same rules as the app's player
function normalizeCuts(cuts, duration = 0) {
  const list = (Array.isArray(cuts) ? cuts : [])
    .map(c => ({ start: Math.max(0, Number(c.start) || 0), end: Math.max(0, Number(c.end) || 0) }))
    .map(c => duration ? { start: Math.min(c.start, duration), end: Math.min(c.end, duration) } : c)
    .filter(c => c.end > c.start)
    .sort((a, b) => a.start - b.start)
  const merged = []
  for (const c of list) {
    const prev = merged[merged.length - 1]
    if (prev && c.start <= prev.end) prev.end = Math.max(prev.end, c.end)
    else merged.push({ ...c })
  }
  return merged
}

const playableDuration = (duration, cuts) =>
  Math.max(0, (duration || 0) - cuts.reduce((s, c) => s + (c.end - c.start), 0))

// Position in the "playable" timeline (cuts removed) → position in the original audio
function playableToAudio(t, cuts) {
  let cursor = 0, remaining = Math.max(0, t)
  for (const c of cuts) {
    const before = Math.max(0, c.start - cursor)
    if (remaining <= before) return cursor + remaining
    remaining -= before
    cursor = c.end
  }
  return cursor + remaining
}

// ffmpeg filter chain for a track starting at `audioStart` seconds of the original audio
function buildFilters({ gain = 0, cuts = [], audioStart = 0 }) {
  const filters = []
  const rel = cuts
    .map(c => ({ start: c.start - audioStart, end: c.end - audioStart }))
    .filter(c => c.end > 0)
    .map(c => ({ start: Math.max(0, c.start), end: c.end }))
  if (rel.length) {
    const expr = rel.map(c => `between(t,${c.start.toFixed(3)},${c.end.toFixed(3)})`).join('+')
    filters.push(`aselect='not(${expr})'`, 'asetpts=N/SR/TB')
  }
  if (gain) filters.push(`volume=${Number(gain).toFixed(2)}dB`)
  return filters
}

// Spawns ffmpeg; returns { process, stream } where stream is raw s16le PCM
function createPcmStream(audioUrl, { audioStart = 0, gain = 0, cuts = [] } = {}) {
  const filters = buildFilters({ gain, cuts, audioStart })
  const args = [
    '-hide_banner', '-loglevel', 'error', '-nostdin',
    '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_on_network_error', '1', '-reconnect_delay_max', '5',
    ...(audioStart > 0 ? ['-ss', audioStart.toFixed(3)] : []),
    '-i', audioUrl,
    '-vn',
    ...(filters.length ? ['-af', filters.join(',')] : []),
    '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1',
  ]
  const proc = spawn(config.ffmpegPath, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  // Without a listener, a missing ffmpeg ('spawn ENOENT') would crash the whole bot
  proc.on('error', err => {
    proc.spawnError = err
    proc.stdout.destroy(new Error(`Não foi possível executar o ffmpeg (${err.code || err.message})`))
  })
  let stderr = ''
  proc.stderr.setEncoding('utf8')
  proc.stderr.on('data', d => { stderr = (stderr + d).slice(-2000) })
  proc.lastError = () => stderr.trim()
  return { process: proc, stream: proc.stdout }
}

module.exports = { normalizeCuts, playableDuration, playableToAudio, buildFilters, createPcmStream }

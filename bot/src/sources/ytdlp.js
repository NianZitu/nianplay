// Thin wrapper around the yt-dlp binary. Nothing is downloaded to disk: it is only used to
// search, read playlists and get the direct audio URL that ffmpeg streams from.
const { spawn } = require('child_process')
const config = require('../config')

function baseArgs() {
  const args = ['--no-warnings', '--no-progress', '--encoding', 'utf-8']
  if (config.ytdlpCookies) args.push('--cookies', config.ytdlpCookies)
  const js = config.ytdlpJsRuntime
  if (js && js !== 'none' && !config.ytdlpExtraArgs.includes('--js-runtimes')) args.push('--js-runtimes', js)
  return [...args, ...config.ytdlpExtraArgs]
}

function run(args, { timeoutMs = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.ytdlpPath, [...baseArgs(), ...args], {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    })
    let out = '', err = ''
    proc.stdout.setEncoding('utf8')
    proc.stderr.setEncoding('utf8')
    proc.stdout.on('data', d => { out += d })
    proc.stderr.on('data', d => { err += d })
    const timer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('yt-dlp demorou demais para responder')) }, timeoutMs)
    proc.on('error', e => { clearTimeout(timer); reject(new Error(`Não foi possível executar o yt-dlp (${e.message})`)) })
    proc.on('close', code => {
      clearTimeout(timer)
      if (code === 0) return resolve(out)
      reject(new Error(friendlyError(err) || `yt-dlp saiu com código ${code}`))
    })
  })
}

// Turn yt-dlp's last error line into something readable in Discord
function friendlyError(stderr) {
  const line = (stderr || '').trim().split('\n').filter(l => /ERROR/i.test(l)).pop() || ''
  if (/confirm you.?re not a bot|sign in to confirm/i.test(line)) {
    return 'O YouTube bloqueou o servidor ("confirme que você não é um robô"). Configure YTDLP_COOKIES (veja o README).'
  }
  if (/private video|video unavailable|this video is unavailable/i.test(line)) return 'Vídeo indisponível ou privado.'
  if (/age/i.test(line) && /restrict|confirm your age/i.test(line)) return 'Vídeo com restrição de idade (precisa de cookies).'
  if (/requested format is not available/i.test(line)) {
    return 'O YouTube não liberou o áudio deste vídeo. Atualize o bot (deploy/update.sh); se continuar, exporte os cookies de novo.'
  }
  return line.replace(/^ERROR:\s*/, '').slice(0, 300)
}

// Audio format used for streaming (prefers opus/webm, the native format of Discord)
const AUDIO_FORMAT = 'bestaudio[acodec=opus]/bestaudio/best'

// JSON of a video/playlist (flat = don't resolve every entry of a playlist).
// With `format`, the JSON also carries the direct URL of that format (see audioUrlOf), so a single
// yt-dlp call gives both the details and the audio — each call costs several seconds.
async function info(url, { flat = false, format = '' } = {}) {
  const args = ['-J', ...(flat ? ['--flat-playlist'] : ['--no-playlist']), ...(format ? ['-f', format] : []), url]
  return JSON.parse(await run(args, { timeoutMs: flat ? 120000 : 60000 }))
}

// Direct audio URL inside an info() JSON fetched with `format` ('' when it is not a single file)
function audioUrlOf(data) {
  if (!data || data.requested_formats) return ''
  return /^https?:\/\//.test(data.url || '') ? data.url : ''
}

// Up to `limit` search results: [{ id, url, title, duration, channel }]
async function search(query, limit = 5) {
  const data = JSON.parse(await run(['-J', '--flat-playlist', `ytsearch${limit}:${query}`]))
  return (data.entries || []).filter(e => e && e.id).map(e => ({
    id: e.id,
    url: `https://www.youtube.com/watch?v=${e.id}`,
    title: e.title || '',
    duration: e.duration || 0,
    channel: e.uploader || e.channel || '',
  }))
}

// Direct audio URL for streaming
async function streamUrl(videoUrl) {
  const out = await run(['-f', AUDIO_FORMAT, '-g', '--no-playlist', videoUrl])
  const url = out.trim().split('\n')[0]
  if (!/^https?:\/\//.test(url)) throw new Error('yt-dlp não retornou um endereço de áudio')
  return url
}

module.exports = { run, info, audioUrlOf, search, streamUrl, AUDIO_FORMAT }

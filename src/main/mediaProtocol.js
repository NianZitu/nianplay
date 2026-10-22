// nianmedia:// — serves local audio, covers and wallpapers to the renderer.
//
// The UI is loaded from http://localhost (17654 in production, 5173 in dev), so it
// cannot use file:// URLs with webSecurity on. This protocol replaces them:
//   nianmedia://local/<encodeURIComponent(absolute path)>[?anything]
// The whole path is a single encoded segment, so URL normalisation never touches it.
//
// Requirements it covers:
//   - Range requests (206 + Content-Range): without them the <audio> element cannot seek.
//   - CORS headers for the UI origin: the player routes audio through Web Audio
//     (MediaElementSource → GainNode for the LUFS gain), and cross-origin media without
//     CORS plays as silence there. The renderer sets audio.crossOrigin = 'anonymous'.
//   - Only regular local files with a known media extension are served (no UNC/network
//     paths, no arbitrary files such as the app's JSON data).

const path = require('path')
const fs   = require('fs')
const { protocol } = require('electron')

const SCHEME = 'nianmedia'
const HOST   = 'local'

const MIME_TYPES = {
  // audio
  '.mp3':  'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav':  'audio/wav',
  '.aac':  'audio/aac',
  '.ogg':  'audio/ogg',
  '.oga':  'audio/ogg',
  '.opus': 'audio/ogg',
  '.m4a':  'audio/mp4',
  '.wma':  'audio/x-ms-wma',
  '.weba': 'audio/webm',
  // images
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.bmp':  'image/bmp',
  '.avif': 'image/avif',
  // video (wallpapers)
  '.mp4':  'video/mp4',
  '.m4v':  'video/mp4',
  '.webm': 'video/webm',
  '.mov':  'video/quicktime',
  '.mkv':  'video/x-matroska',
  '.avi':  'video/x-msvideo',
}

// Must run before app 'ready'
function registerMediaScheme() {
  protocol.registerSchemesAsPrivileged([{
    scheme: SCHEME,
    privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true },
  }])
}

// URL → absolute local path, or null when the URL is not acceptable
function resolveMediaPath(url) {
  let u
  try { u = new URL(url) } catch { return null }
  if (u.host !== HOST) return null
  let p
  try { p = decodeURIComponent(u.pathname.replace(/^\/+/, '')) } catch { return null }
  if (!p || p.includes('\0')) return null
  // Local drives only: reject UNC/network paths (\\server\share, //server/share)
  if (/^[\\/]{2}/.test(p)) return null
  if (!path.isAbsolute(p)) return null
  return path.resolve(p)
}

// "bytes=a-b" | "bytes=a-" | "bytes=-n" → { start, end } (inclusive); null = serve whole
// file; 'invalid' = 416
function parseRange(header, size) {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m) return null   // multiple ranges / other units: answer with the whole file
  let start, end
  if (m[1] === '') {
    if (m[2] === '') return 'invalid'
    const suffix = Number(m[2])
    if (suffix === 0) return 'invalid'
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(m[1])
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  }
  if (start >= size || start > end) return 'invalid'
  return { start, end }
}

// fs.createReadStream(start, end) wrapped as a web ReadableStream, with backpressure,
// closing the file when the renderer aborts (seek, track change)
function fileStream(filePath, start, end) {
  const nodeStream = fs.createReadStream(filePath, { start, end })
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', chunk => {
        try { controller.enqueue(new Uint8Array(chunk)) } catch { nodeStream.destroy(); return }
        if (controller.desiredSize <= 0) nodeStream.pause()
      })
      nodeStream.on('end',   () => { try { controller.close() } catch {} })
      nodeStream.on('error', err => { try { controller.error(err) } catch {} })
    },
    pull()   { nodeStream.resume() },
    cancel() { nodeStream.destroy() },
  }, { highWaterMark: 4 })
}

function corsHeaders(request, allowedOrigins) {
  const origin = request.headers.get('origin')
  return {
    // Echo the UI origin; requests without an Origin header (plain <img>) get the default one
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    'Vary': 'Origin',
  }
}

// allowedOrigins: UI origins allowed to read the media (first one is the default)
function handleMediaProtocol(allowedOrigins) {
  protocol.handle(SCHEME, async (request) => {
    const cors = corsHeaders(request, allowedOrigins)

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, HEAD', 'Access-Control-Allow-Headers': 'Range' },
      })
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: cors })
    }

    const filePath = resolveMediaPath(request.url)
    const mime = filePath && MIME_TYPES[path.extname(filePath).toLowerCase()]
    if (!filePath || !mime) return new Response(null, { status: 403, headers: cors })

    let stat
    try { stat = await fs.promises.stat(filePath) } catch { stat = null }
    if (!stat || !stat.isFile()) return new Response(null, { status: 404, headers: cors })

    const size = stat.size
    const base = {
      ...cors,
      'Content-Type': mime,
      'Accept-Ranges': 'bytes',
      'Last-Modified': stat.mtime.toUTCString(),
      'Cache-Control': 'no-cache',
    }

    const range = parseRange(request.headers.get('range'), size)
    if (range === 'invalid') {
      return new Response(null, { status: 416, headers: { ...base, 'Content-Range': `bytes */${size}` } })
    }

    const head = request.method === 'HEAD'
    if (range) {
      const { start, end } = range
      return new Response(head ? null : fileStream(filePath, start, end), {
        status: 206,
        headers: { ...base, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
      })
    }
    return new Response(head || size === 0 ? null : fileStream(filePath, 0, size - 1), {
      status: 200,
      headers: { ...base, 'Content-Length': String(size) },
    })
  })
}

// Local path → nianmedia:// URL (same format as the renderer's utils/covers.js mediaUrl)
function mediaUrl(p) {
  return `${SCHEME}://${HOST}/${encodeURIComponent(p)}`
}

module.exports = { registerMediaScheme, handleMediaProtocol, mediaUrl, resolveMediaPath, parseRange }

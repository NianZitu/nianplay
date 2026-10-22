// URLs for local media (audio, covers, wallpapers).
//
// The UI is served from http://localhost, so local files go through the app's own
// nianmedia:// protocol (main/mediaProtocol.js) instead of file:// — that is what
// lets webSecurity stay on. The protocol answers Range requests (seeking) and sends
// CORS headers (Web Audio needs them, see PlayerContext).

// Local path (or a legacy file:// URL stored in the DB/settings) → nianmedia:// URL.
// The whole path is one encoded segment, so "..", "#", "%", spaces and accents are safe.
export function mediaUrl(p) {
  if (!p) return ''
  let local = String(p)
  let query = ''
  if (/^file:/i.test(local)) {
    local = local.replace(/^file:\/\/\/?/i, '')
    // "file://C:\a\b.jpg" (saved by the cover pickers) is a raw path; only a real
    // file:///C:/a%20b.jpg URL (old wallpaper src) is percent-encoded and may carry ?v=
    if (!local.includes('\\')) {
      const q = local.indexOf('?')
      if (q >= 0) { query = local.slice(q); local = local.slice(0, q) }
      try { local = decodeURIComponent(local) } catch {}
    }
  }
  return `nianmedia://local/${encodeURIComponent(local)}${query}`
}

// Any image/video source: remote and inline URLs untouched, local ones via nianmedia://
export function mediaSrc(p) {
  if (!p) return null
  if (/^(https?|data|blob|nianmedia):/i.test(p)) return p
  return mediaUrl(p)
}

// Full-size cover (now-playing art, big views)
export function coverSrc(p) {
  return mediaSrc(p)
}

// Small cover for list rows: the 96px thumbnail made by the main process when it
// is still for the current cover, otherwise the full cover
export function listCoverSrc(track) {
  if (!track?.cover_path) return null
  if (track.cover_thumb && track.cover_thumb_src === track.cover_path) {
    return coverSrc(track.cover_thumb)
  }
  return coverSrc(track.cover_path)
}

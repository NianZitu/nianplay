// Media link helpers (main process).
//
// The same YouTube video can be written many ways (youtu.be/ID, watch?v=ID&list=..&index=..,
// shorts/ID, music.youtube.com, ?si= tracking params). Links were compared as raw strings,
// so the same video often did NOT match and the app fell back to matching by name.
// Everything that compares or stores links goes through these helpers.

const YT_PATTERNS = [
  /(?:^|\/\/)(?:www\.|m\.|music\.)?youtube\.com\/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{11})/i,
  /(?:^|\/\/)(?:www\.)?youtu\.be\/([A-Za-z0-9_-]{11})/i,
  /(?:^|\/\/)(?:www\.|m\.)?youtube\.com\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/i,
]

// YouTube video id, or null (playlist links without a video, other sites, garbage)
function youtubeVideoId(url) {
  if (!url || typeof url !== 'string') return null
  const s = url.trim()
  for (const re of YT_PATTERNS) {
    const m = s.match(re)
    if (m) return m[1]
  }
  return null
}

// Canonical form to STORE: YouTube → https://www.youtube.com/watch?v=ID; others trimmed as given
function canonicalUrl(url) {
  if (!url || typeof url !== 'string') return ''
  const id = youtubeVideoId(url)
  return id ? `https://www.youtube.com/watch?v=${id}` : url.trim()
}

// Key to COMPARE two links: same video → same key ('' for no link)
function urlKey(url) {
  if (!url || typeof url !== 'string') return ''
  const id = youtubeVideoId(url)
  return id ? `yt:${id}` : url.trim().toLowerCase()
}

const isPlaylistUrl = url => /[?&]list=|\/playlist\b/i.test(url || '')

module.exports = { youtubeVideoId, canonicalUrl, urlKey, isPlaylistUrl }

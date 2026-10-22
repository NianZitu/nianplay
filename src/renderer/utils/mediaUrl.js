// Media link helpers for the renderer — same rules as src/main/mediaUrl.js (keep both in sync).
// The same YouTube video can be written many ways; compare with urlKey, store canonicalUrl.

const YT_PATTERNS = [
  /(?:^|\/\/)(?:www\.|m\.|music\.)?youtube\.com\/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{11})/i,
  /(?:^|\/\/)(?:www\.)?youtu\.be\/([A-Za-z0-9_-]{11})/i,
  /(?:^|\/\/)(?:www\.|m\.)?youtube\.com\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/i,
]

export function youtubeVideoId(url) {
  if (!url || typeof url !== 'string') return null
  const s = url.trim()
  for (const re of YT_PATTERNS) {
    const m = s.match(re)
    if (m) return m[1]
  }
  return null
}

export function canonicalUrl(url) {
  if (!url || typeof url !== 'string') return ''
  const id = youtubeVideoId(url)
  return id ? `https://www.youtube.com/watch?v=${id}` : url.trim()
}

export function urlKey(url) {
  if (!url || typeof url !== 'string') return ''
  const id = youtubeVideoId(url)
  return id ? `yt:${id}` : url.trim().toLowerCase()
}

export const isPlaylistUrl = url => /[?&]list=|\/playlist\b/i.test(url || '')

// What the "check links" tool reports for a track: '' = ok
export function linkProblem(url) {
  if (!url || !url.trim()) return 'missing'
  if (/youtube\.com|youtu\.be/i.test(url) && !youtubeVideoId(url)) return 'invalid'   // e.g. a playlist link
  return ''
}

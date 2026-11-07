// Same link rules as the NianPlay app (src/main/mediaUrl.js): the same YouTube video can be
// written many ways; compare with urlKey, store/play canonicalUrl.
const YT_PATTERNS = [
  /(?:^|\/\/)(?:www\.|m\.|music\.)?youtube\.com\/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{11})/i,
  /(?:^|\/\/)(?:www\.)?youtu\.be\/([A-Za-z0-9_-]{11})/i,
  /(?:^|\/\/)(?:www\.|m\.)?youtube\.com\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/i,
]

function youtubeVideoId(url) {
  if (!url || typeof url !== 'string') return null
  for (const re of YT_PATTERNS) {
    const m = url.trim().match(re)
    if (m) return m[1]
  }
  return null
}

function canonicalUrl(url) {
  const id = youtubeVideoId(url)
  return id ? `https://www.youtube.com/watch?v=${id}` : (url || '').trim()
}

const youtubePlaylistId = url => (url || '').match(/[?&]list=([A-Za-z0-9_-]+)/)?.[1] || null
const isYouTubeUrl = url => /^https?:\/\/(?:[\w-]+\.)?(?:youtube\.com|youtu\.be)\//i.test(url || '')

module.exports = { youtubeVideoId, canonicalUrl, youtubePlaylistId, isYouTubeUrl }

const { youtubeVideoId } = require('../sources/mediaUrl')

function formatTime(secs) {
  secs = Math.max(0, Math.floor(Number(secs) || 0))
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

// "90", "1:30", "1:02:03" → seconds (null if invalid)
function parseTime(text) {
  const t = (text || '').trim()
  if (/^\d+$/.test(t)) return Number(t)
  if (!/^\d+(:\d{1,2}){1,2}$/.test(t)) return null
  return t.split(':').map(Number).reduce((acc, n) => acc * 60 + n, 0)
}

const thumbnailOf = item => {
  const id = youtubeVideoId(item?.url)
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : (item?.thumbnail || null)
}

const truncate = (s, n) => (s || '').length > n ? s.slice(0, n - 1) + '…' : (s || '')

// Discord markdown link that doesn't break on [ ] in titles
const link = (title, url) => {
  const clean = truncate(title, 90).replace(/[[\]]/g, '')
  return url ? `[${clean}](${url})` : clean
}

const progressBar = (elapsed, total, size = 16) => {
  if (!total) return ''
  const filled = Math.min(size, Math.round((elapsed / total) * size))
  return '▬'.repeat(Math.max(0, filled)) + '🔘' + '▬'.repeat(Math.max(0, size - filled))
}

module.exports = { formatTime, parseTime, thumbnailOf, truncate, link, progressBar }

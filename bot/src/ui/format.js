const { youtubeVideoId } = require('../sources/mediaUrl')

function formatTime(secs) {
  secs = Math.max(0, Math.floor(Number(secs) || 0))
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

// Time typed by the user → seconds (null if invalid). Accepts:
//   "90"  "1:30"  "1:02:03"  "3m15s"  "3m 15s"  "1h2m3s"  "45s"  "2m"  "2min"  "1h"  "1h30" (= 1h30m)
function parseTime(text) {
  const t = (text || '').trim().toLowerCase().replace(/\s+/g, '')
  if (!t) return null
  if (/^\d+$/.test(t)) return Number(t)
  if (/^\d+(:\d{1,2}){1,2}$/.test(t)) return t.split(':').map(Number).reduce((acc, n) => acc * 60 + n, 0)
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m(?:in)?)?(?:(\d+)(s?))?$/)
  if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) return null
  let [, h = 0, min = 0, rest = 0, sUnit] = m
  // "1h30": a bare number right after the hours means minutes
  if (m[1] !== undefined && m[2] === undefined && m[3] !== undefined && !sUnit) { min = rest; rest = 0 }
  return Number(h) * 3600 + Number(min) * 60 + Number(rest)
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

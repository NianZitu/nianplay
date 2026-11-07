// User input (/play) → queue items, and lazy YouTube lookup for items that only have a search query.
const ytdlp = require('./ytdlp')
const { youtubeVideoId, canonicalUrl, youtubePlaylistId, isYouTubeUrl } = require('./mediaUrl')
const { parseSpotify, resolveSpotify } = require('./spotify')
const config = require('../config')

const videoItem = (e, source = 'youtube') => ({
  title: e.title || 'Sem título',
  artist: e.uploader || e.channel || e.artist || '',
  duration: Number(e.duration) || 0,
  url: youtubeVideoId(e.webpage_url) ? canonicalUrl(e.webpage_url) : (e.webpage_url || e.url || ''),
  thumbnail: e.thumbnail || '',
  query: '',
  source,
})

// Returns { title, items } — title is the playlist/album name when there is one
async function resolveInput(input) {
  const text = (input || '').trim()
  if (!text) throw new Error('Digite um nome ou cole um link.')

  if (parseSpotify(text)) return resolveSpotify(text)

  if (isYouTubeUrl(text)) {
    const videoId = youtubeVideoId(text)
    const listId = youtubePlaylistId(text)
    if (!videoId && listId) {
      const data = await ytdlp.info(`https://www.youtube.com/playlist?list=${listId}`, { flat: true })
      const items = (data.entries || []).filter(e => e?.id && e.title !== '[Private video]' && e.title !== '[Deleted video]')
        .slice(0, config.maxQueue)
        .map(e => videoItem({ ...e, webpage_url: `https://www.youtube.com/watch?v=${e.id}` }))
      if (!items.length) throw new Error('Playlist vazia ou privada.')
      return { title: data.title || 'Playlist do YouTube', items }
    }
    if (videoId) {
      const data = await ytdlp.info(canonicalUrl(text))
      return { title: '', items: [videoItem(data)] }
    }
  }

  if (/^https?:\/\//i.test(text)) {
    // Any other site yt-dlp supports (SoundCloud, Bandcamp, ...)
    const data = await ytdlp.info(text)
    return { title: '', items: [{ ...videoItem(data, 'link'), url: data.webpage_url || text }] }
  }

  // Plain text → first YouTube result
  const [first] = await ytdlp.search(text, 1)
  if (!first) throw new Error(`Nada encontrado no YouTube para "${text}".`)
  return { title: '', items: [{ ...videoItem({ ...first, webpage_url: first.url, uploader: first.channel }), source: 'search' }] }
}

// ── Lazy lookup: "artist - title" → best YouTube video (same scoring as the NianPlay app) ──
function wordSim(a, b) {
  a = (a || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim()
  b = (b || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim()
  if (!a || !b) return 0
  if (a === b) return 1
  if (b.includes(a) || a.includes(b)) return 0.85
  const aWords = new Set(a.split(/\s+/).filter(Boolean))
  const bWords = b.split(/\s+/).filter(Boolean)
  if (!aWords.size || !bWords.length) return 0
  return bWords.filter(w => aWords.has(w)).length / Math.max(aWords.size, bWords.length)
}

function score(result, item) {
  const nameSim = wordSim(item.title, result.title)
  const artistSim = item.artist ? wordSim(item.artist, `${result.title} ${result.channel}`) : 0.5
  let durScore = 0.5
  if (item.duration && result.duration) {
    const diff = Math.abs(item.duration - result.duration)
    durScore = diff <= 3 ? 1 : diff <= 8 ? 0.9 : diff <= 20 ? 0.6 : diff <= 45 ? 0.25 : diff <= 90 ? 0.05 : 0
  }
  const yt = (result.title || '').toLowerCase()
  const t = (item.title || '').toLowerCase()
  let penalty = 0
  if (!t.includes('cover') && yt.includes('cover')) penalty += 0.35
  if (!t.includes('nightcore') && yt.includes('nightcore')) penalty += 0.6
  if (!t.includes('karaoke') && yt.includes('karaoke')) penalty += 0.6
  if (!t.includes('remix') && yt.includes('remix')) penalty += 0.2
  return Math.max(0, nameSim * 0.45 + artistSim * 0.15 + durScore * 0.4 - penalty)
}

async function findOnYoutube(item) {
  const results = await ytdlp.search(item.query || item.title, 6)
  if (!results.length) throw new Error(`Nada encontrado no YouTube para "${item.query || item.title}".`)
  return results.map(r => ({ r, s: score(r, item) })).sort((a, b) => b.s - a.s)[0].r
}

module.exports = { resolveInput, findOnYoutube, score }

// Fills missing yt_url on library tracks from the app's own download history.
//
// Exact evidence only — never similar names:
//  1. Downloads since 1.1.26 record every final file with the link it came from
//     (download.files = [{ path, url }]) → match by exact file path.
//  2. Older downloads only recorded the first "Destination:" file name (download.title, often the
//     .webm/.m4a before conversion) and the link typed in. A track whose file name (without
//     extension) is identical, and whose record points to exactly ONE single-video link, gets it.
//     Playlist downloads are skipped: their link is not the link of each file.
// Tracks that already have a link are never touched.

const path = require('path')
const { getDB } = require('./db')
const { canonicalUrl, isPlaylistUrl } = require('./mediaUrl')

const pathKey  = p => path.normalize(p || '').toLowerCase()   // Windows paths are case-insensitive
const fileStem = p => path.basename(p || '')
  .replace(/\.[^.]+$/, '')        // extension
  .replace(/\.f\d+$/i, '')        // yt-dlp format suffix of intermediate files (name.f251.webm)
  .toLowerCase().trim()

function buildDownloadIndex(downloads) {
  const byPath = new Map()   // pathKey → url
  const byStem = new Map()   // stem → Set(url)
  for (const d of downloads || []) {
    if (d.status !== 'done') continue
    for (const f of d.files || []) {
      if (f.path && f.url) byPath.set(pathKey(f.path), canonicalUrl(f.url))
    }
    if (!d.files?.length && d.title && d.url && !isPlaylistUrl(d.url)) {
      const stem = fileStem(d.title)
      if (!stem) continue
      if (!byStem.has(stem)) byStem.set(stem, new Set())
      byStem.get(stem).add(canonicalUrl(d.url))
    }
  }
  return { byPath, byStem }
}

function urlForFile(filePath, index) {
  if (!filePath) return ''
  const exact = index.byPath.get(pathKey(filePath))
  if (exact) return exact
  const legacy = index.byStem.get(fileStem(filePath))
  return legacy && legacy.size === 1 ? [...legacy][0] : ''
}

function repairTrackUrls() {
  const db = getDB()
  const index = buildDownloadIndex(db.downloads.read())
  if (!index.byPath.size && !index.byStem.size) return { repaired: 0 }
  const tracks = db.tracks.read()
  let repaired = 0
  tracks.forEach((t, i) => {
    if (t.yt_url || !t.file_path) return
    const url = urlForFile(t.file_path, index)
    if (!url) return
    tracks[i] = { ...t, yt_url: url, updated_at: Date.now() }
    repaired++
  })
  if (repaired) {
    db.tracks.write(tracks)
    console.log(`[Links] Restored ${repaired} link(s) from the download history`)
  }
  return { repaired }
}

module.exports = { repairTrackUrls, buildDownloadIndex, urlForFile, pathKey }

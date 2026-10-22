// Small cover thumbnails for list rows (36px on screen).
//
// Covers embedded in audio files are often 500–1500px; decoding hundreds of
// them just to draw 36px squares costs a lot of memory. This module creates
// 96px JPEG copies in userData/thumbs and stores, on each track:
//   cover_thumb      path of the thumbnail ('' when none could be made)
//   cover_thumb_src  the cover_path the thumbnail was made from
// The renderer only uses cover_thumb while cover_thumb_src === cover_path, so a
// changed cover never shows a stale thumbnail.
//
// Work runs in the background, one image at a time with yields in between, so
// the main process stays responsive. Uses Electron's nativeImage (PNG/JPEG).

const path   = require('path')
const fs     = require('fs')
const crypto = require('crypto')
const { getDB } = require('./db')

const THUMB_SIZE   = 96   // shorter side, px (36px rows on high-DPI screens)
const JPEG_QUALITY = 82
const DEBOUNCE_MS  = 1500
const BATCH_SIZE   = 20   // apply results to the DB every N thumbnails

let timer   = null
let running = false
let again   = false
let notify  = null

function thumbDir() {
  const { app } = require('electron')
  const dir = path.join(app.getPath('userData'), 'thumbs')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

// cover_path may be a plain path or a file:// URL; remote URLs are skipped
function localCoverPath(p) {
  if (!p || typeof p !== 'string') return null
  if (/^(https?|data|blob):/i.test(p)) return null
  let local = p.replace(/^file:\/\/\/?/i, '')
  if (local !== p) { try { local = decodeURIComponent(local) } catch {} }
  // Same file written as "C:/a/b.jpg" or "C:\a\b.jpg" → one thumbnail
  return path.normalize(local)
}

function needsThumb(track) {
  if (!track.cover_path) return false
  if (track.cover_thumb_src !== track.cover_path) return true
  // Thumbnail recorded but deleted from disk (e.g. userData cleaned)
  return Boolean(track.cover_thumb) && track.cover_thumb !== localCoverPath(track.cover_path) &&
    !fs.existsSync(track.cover_thumb)
}

// Returns the thumbnail path, the original path when it is already small, or ''
function makeThumb(coverPath) {
  const src = localCoverPath(coverPath)
  if (!src) return ''
  let stat
  try { stat = fs.statSync(src) } catch { return '' }
  if (!stat.isFile()) return ''

  const hash = crypto.createHash('sha1').update(`${src}|${stat.size}|${stat.mtimeMs}`).digest('hex').slice(0, 24)
  const dest = path.join(thumbDir(), `${hash}.jpg`)
  if (fs.existsSync(dest)) return dest

  const { nativeImage } = require('electron')
  const img = nativeImage.createFromPath(src)
  if (img.isEmpty()) return ''   // unsupported format (e.g. WebP) — rows fall back to the full cover
  const { width, height } = img.getSize()
  if (Math.min(width, height) <= THUMB_SIZE * 1.5) return src   // already small: no gain

  const resized = width < height
    ? img.resize({ width: THUMB_SIZE, quality: 'good' })
    : img.resize({ height: THUMB_SIZE, quality: 'good' })
  fs.writeFileSync(dest, resized.toJPEG(JPEG_QUALITY))
  return dest
}

const yieldToEventLoop = () => new Promise(r => setImmediate(r))

// Write results onto the CURRENT library (it may have changed while we worked)
function applyResults(results) {
  if (!results.size) return 0
  const db = getDB()
  const tracks = db.tracks.read()
  let changed = 0
  tracks.forEach((t, i) => {
    const r = results.get(t.id)
    // Skip if the cover was changed again while this thumbnail was being made
    if (!r || t.cover_path !== r.src) return
    tracks[i] = { ...t, cover_thumb: r.thumb, cover_thumb_src: r.src }
    changed++
  })
  if (changed) db.tracks.write(tracks)
  results.clear()
  return changed
}

async function run() {
  if (running) { again = true; return }
  running = true
  let total = 0
  try {
    do {
      again = false
      const pending = getDB().tracks.read()
        .filter(needsThumb)
        .map(t => ({ id: t.id, cover_path: t.cover_path }))
      const results = new Map()
      for (const item of pending) {
        let thumb = ''
        try { thumb = makeThumb(item.cover_path) } catch (err) {
          console.warn('[Thumbs] Failed for', item.cover_path, err.message)
        }
        results.set(item.id, { thumb, src: item.cover_path })
        if (results.size >= BATCH_SIZE) total += applyResults(results)
        await yieldToEventLoop()
      }
      total += applyResults(results)
    } while (again)
  } finally {
    running = false
  }
  if (total > 0) {
    console.log(`[Thumbs] Updated ${total} thumbnail(s)`)
    notify?.()
  }
}

// Debounced entry point — call after anything that may add or change covers
function scheduleThumbnails() {
  clearTimeout(timer)
  timer = setTimeout(() => { run().catch(err => console.error('[Thumbs]', err)) }, DEBOUNCE_MS)
}

// onUpdated is called after a run that changed at least one track
function initThumbnails(onUpdated) {
  notify = onUpdated
  scheduleThumbnails()
}

module.exports = { initThumbnails, scheduleThumbnails, localCoverPath, makeThumb }

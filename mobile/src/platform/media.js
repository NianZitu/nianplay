// Getting music onto the phone.
//
//  importFiles(files)  — files picked in the Files app (<input type="file">). Each one is COPIED into
//                        the app (Library/NoCloud/music), in 3 MB pieces so big files don't exhaust memory.
//  scanDocuments()     — files the user put in the app's Documents folder (Files app → "No meu iPhone >
//                        NianPlay", or from the PC via Apple Devices/iTunes). Read in place, not copied.
//
// For each file: tags from the ID3 header (only those bytes are read), duration from an <audio>
// element, cover art resized to 600 px + a 120 px thumbnail. Then, like the desktop, a track that came
// from the cloud without a file (same title + artist, unambiguous — rules.findTrackMatch) RECEIVES the
// file, so synced playlists become playable. Otherwise a new track is created.

import { Filesystem, Directory } from '@capacitor/filesystem'
import { db } from './storage'
import { LIB, DOCS, isNative, mediaUrl, registerWebBlob } from './paths'
import { parseId3, id3TagSize } from './id3'
import { findTrackMatch, uuid } from './rules'
import { notifyLibraryChanged } from './api'

export const AUDIO_EXT = new Set(['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus', '.aif', '.aiff', '.caf'])
const CHUNK = 3 * 1024 * 1024   // multiple of 3 bytes → base64 pieces concatenate cleanly

const extOf = name => (name.match(/\.[^.\/]+$/)?.[0] || '').toLowerCase()
const stemOf = name => name.replace(/^.*\//, '').replace(/\.[^.]+$/, '')

function toBase64(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

// ── reading ──────────────────────────────────────────────────────────────────
async function readRange(source, start, end) {
  if (source instanceof Blob) return new Uint8Array(await source.slice(start, end).arrayBuffer())
  const res = await fetch(source, { headers: { Range: `bytes=${start}-${end - 1}` } })
  const buf = new Uint8Array(await res.arrayBuffer())
  // A server that ignores Range sends the whole file
  return res.status === 206 ? buf : buf.subarray(start, end)
}

async function readTags(source) {
  try {
    const head = await readRange(source, 0, 10)
    const size = id3TagSize(head)
    if (!size) return null
    return parseId3(await readRange(source, 0, size))
  } catch (err) {
    console.warn('[media] tags', err)
    return null
  }
}

function readDuration(url) {
  return new Promise(resolve => {
    const audio = new Audio()
    const done = d => { clearTimeout(timer); audio.removeAttribute('src'); audio.load(); resolve(Number.isFinite(d) ? d : 0) }
    const timer = setTimeout(() => done(0), 10000)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => done(audio.duration)
    audio.onerror = () => done(0)
    audio.src = url
  })
}

// ── writing ──────────────────────────────────────────────────────────────────
async function copyIntoApp(file, relPath) {
  for (let pos = 0; pos < file.size || pos === 0; pos += CHUNK) {
    const data = toBase64(new Uint8Array(await file.slice(pos, pos + CHUNK).arrayBuffer()))
    if (pos === 0) await Filesystem.writeFile({ path: relPath, directory: Directory.LibraryNoCloud, data, recursive: true })
    else await Filesystem.appendFile({ path: relPath, directory: Directory.LibraryNoCloud, data })
    if (file.size === 0) break
  }
}

async function resizeToJpeg(blob, maxSize) {
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85))
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function saveImage(blob, relPath) {
  const stored = LIB + relPath
  if (!isNative()) { registerWebBlob(stored, blob); return stored }
  const data = toBase64(new Uint8Array(await blob.arrayBuffer()))
  await Filesystem.writeFile({ path: relPath, directory: Directory.LibraryNoCloud, data, recursive: true })
  return stored
}

// Cover (600 px) + list thumbnail (120 px); returns the track fields to set
async function saveCovers(picture, id) {
  if (!picture?.data?.length) return {}
  try {
    const original = new Blob([picture.data], { type: picture.mime || 'image/jpeg' })
    const [cover, thumb] = await Promise.all([resizeToJpeg(original, 600), resizeToJpeg(original, 120)])
    const cover_path = await saveImage(cover, `covers/${id}.jpg`)
    const cover_thumb = await saveImage(thumb, `covers/${id}_t.jpg`)
    return { cover_path, cover_thumb, cover_thumb_src: cover_path }
  } catch (err) {
    console.warn('[media] cover', err)
    return {}
  }
}

// ── library ──────────────────────────────────────────────────────────────────
const normTitle = s => (s || '').toLowerCase().trim()

// The library track a file belongs to: the usual rule (title + artist, unambiguous). A file WITHOUT
// an artist tag may still match by title alone — only when exactly one track in the whole library
// has that title and, when both durations are known, they differ by at most 3 s.
function matchFile(tracks, candidate, hasArtistTag) {
  const exact = findTrackMatch(tracks, candidate)
  if (exact || hasArtistTag) return exact
  const sameTitle = tracks.filter(t => normTitle(t.title) === normTitle(candidate.title))
  if (sameTitle.length !== 1) return null
  const t = sameTitle[0]
  if (t.duration && candidate.duration && Math.abs(t.duration - candidate.duration) > 3) return null
  return t
}

const candidateOf = (tags, fileName, duration) => ({
  title: tags?.title || stemOf(fileName),
  artist: tags?.artist || 'Desconhecido',
  album: tags?.album || '',
  duration,
})

// Adds a file to the library: links it to a cloud track without file, or creates a new track
async function addToLibrary({ filePath, fileName, tags, duration, picture }) {
  const candidate = candidateOf(tags, fileName, duration)
  const tracks = db.tracks.read()
  const match = matchFile(tracks, candidate, Boolean(tags?.artist))
  if (match?.file_path) return 'duplicate'

  if (match) {
    const covers = match.cover_path ? {} : await saveCovers(picture, match.id)
    const fresh = db.tracks.read()
    const idx = fresh.findIndex(t => t.id === match.id)
    if (idx === -1) return 'skipped'
    fresh[idx] = {
      ...fresh[idx],
      file_path: filePath,
      duration: fresh[idx].duration || duration,
      album: fresh[idx].album || candidate.album,
      ...covers,
      updated_at: Date.now(),
    }
    db.tracks.write(fresh)
    return 'linked'
  }

  const id = uuid()
  const covers = await saveCovers(picture, id)
  db.tracks.write([...db.tracks.read(), {
    id, ...candidate,
    file_path: filePath,
    genre: tags?.genre || '',
    year: tags?.year || null,
    gain: 0, cut_segments: [], lyrics: '', yt_url: '',
    ...covers,
    created_at: Date.now(), updated_at: Date.now(),
  }])
  return 'added'
}

const emptySummary = () => ({ added: 0, linked: 0, duplicate: 0, skipped: 0, failed: 0, missing: 0 })

export async function importFiles(fileList, onProgress) {
  const files = [...fileList].filter(f => AUDIO_EXT.has(extOf(f.name)))
  const summary = emptySummary()
  summary.skipped = fileList.length - files.length
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    onProgress?.({ done: i, total: files.length, name: file.name })
    try {
      const tags = extOf(file.name) === '.mp3' ? await readTags(file) : null
      const tempUrl = URL.createObjectURL(file)
      const duration = await readDuration(tempUrl)
      URL.revokeObjectURL(tempUrl)

      // Don't copy a file that is already in the library
      const probe = matchFile(db.tracks.read(), candidateOf(tags, file.name, duration), Boolean(tags?.artist))
      if (probe?.file_path) { summary.duplicate++; continue }

      const rel = `music/${uuid()}${extOf(file.name)}`
      const filePath = LIB + rel
      if (isNative()) await copyIntoApp(file, rel)
      else registerWebBlob(filePath, file)
      const result = await addToLibrary({ filePath, fileName: file.name, tags, duration, picture: tags?.picture })
      summary[result]++
    } catch (err) {
      console.error('[media] import failed', file.name, err)
      summary.failed++
    }
  }
  onProgress?.({ done: files.length, total: files.length, name: '' })
  notifyLibraryChanged()
  return summary
}

async function listDocuments(dir = '') {
  const out = []
  let res
  try { res = await Filesystem.readdir({ path: dir, directory: Directory.Documents }) } catch { return out }
  for (const f of res.files) {
    if (f.name.startsWith('.')) continue
    const rel = dir ? `${dir}/${f.name}` : f.name
    if (f.type === 'directory') out.push(...await listDocuments(rel))
    else if (AUDIO_EXT.has(extOf(f.name))) out.push(rel)
  }
  return out
}

export async function scanDocuments(onProgress) {
  const summary = emptySummary()
  if (!isNative()) return summary
  const onDisk = await listDocuments()
  const present = new Set(onDisk.map(rel => DOCS + rel))

  // Files deleted from the Documents folder: the track stays (playlists, cloud data) but loses its file
  const tracks = db.tracks.read()
  let changed = false
  for (const t of tracks) {
    if (t.file_path?.startsWith(DOCS) && !present.has(t.file_path)) { t.file_path = ''; changed = true; summary.missing++ }
  }
  if (changed) db.tracks.write(tracks)

  // Already in the library, or a duplicate of a track that has a file (remembered so the scan that
  // runs on every app start doesn't re-read it)
  const settings = db.settings.read()
  const ignored = new Set(settings.ignoredDocs || [])
  const known = new Set(db.tracks.read().map(t => t.file_path).filter(Boolean))
  const fresh = onDisk.filter(rel => !known.has(DOCS + rel) && !ignored.has(DOCS + rel))
  for (let i = 0; i < fresh.length; i++) {
    const rel = fresh[i]
    onProgress?.({ done: i, total: fresh.length, name: rel })
    try {
      const filePath = DOCS + rel
      const url = mediaUrl(filePath)
      const tags = extOf(rel) === '.mp3' ? await readTags(url) : null
      const duration = await readDuration(url)
      const result = await addToLibrary({ filePath, fileName: rel, tags, duration, picture: tags?.picture })
      summary[result]++
      if (result === 'duplicate') ignored.add(filePath)
    } catch (err) {
      console.error('[media] scan failed', rel, err)
      summary.failed++
    }
  }
  onProgress?.({ done: fresh.length, total: fresh.length, name: '' })
  const all = db.settings.read()
  all.ignoredDocs = [...ignored].filter(p => present.has(p))
  db.settings.write(all)
  notifyLibraryChanged()
  return summary
}

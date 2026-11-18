// Where the iPhone app keeps media, and how a stored path becomes a playable URL.
//
// Tracks store RELATIVE paths, because iOS changes the app's container folder on every update or
// reinstall (absolute file:// paths would break):
//   nian-lib://music/<id>.mp3     files imported from the Files app (copied into Library/NoCloud —
//                                 private, not in iCloud backups; music can be re-imported)
//   nian-lib://covers/<id>.jpg    cover art extracted from the tags
//   nian-docs://Pasta/Musica.mp3  files the user put in the app's Documents folder ("No meu iPhone >
//                                 NianPlay" in Files, or the PC via Apple Devices/iTunes) — read in place
// mediaUrl() turns them into Capacitor URLs (capacitor://localhost/_capacitor_file_/...): same
// origin as the app, so Web Audio works, and the WebView serves them with Range support (seeking).

import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'

export const LIB  = 'nian-lib://'
export const DOCS = 'nian-docs://'
export const isNative = () => Capacitor.isNativePlatform()
export const isAndroid = () => Capacitor.getPlatform() === 'android'

// Where each prefix lives on disk.
//   iOS:     LIB → Library/NoCloud (private, not backed up)     DOCS → Documents (Arquivos › No meu iPhone)
//   Android: LIB → files/ (private)                             DOCS → Android/data/com.nianplay.mobile/files
//            (visible from the PC over USB; also where YouTube downloads land, in YouTube/)
export const libDirectory  = () => (isAndroid() ? Directory.Data : Directory.LibraryNoCloud)
export const docsDirectory = () => (isAndroid() ? Directory.External : Directory.Documents)

const bases = { lib: '', docs: '' }
// Browser dev/testing only: imported files are played from in-memory blob URLs
const webBlobs = new Map()

export async function initPaths() {
  if (!isNative()) return
  const [lib, docs] = await Promise.all([
    Filesystem.getUri({ directory: libDirectory(), path: '' }),
    Filesystem.getUri({ directory: docsDirectory(), path: '' }),
  ])
  bases.lib = lib.uri.replace(/\/+$/, '')
  bases.docs = docs.uri.replace(/\/+$/, '')
}

// "nian-lib://music/a b.mp3" → { directory, path: 'music/a b.mp3' }
export function splitStored(p) {
  if (p?.startsWith(LIB))  return { directory: libDirectory(), path: p.slice(LIB.length), base: 'lib' }
  if (p?.startsWith(DOCS)) return { directory: docsDirectory(), path: p.slice(DOCS.length), base: 'docs' }
  return null
}

const encodePath = rel => rel.split('/').map(encodeURIComponent).join('/')

export function fileUri(p) {
  const s = splitStored(p)
  if (!s) return p
  return `${bases[s.base]}/${encodePath(s.path)}`
}

export function mediaUrl(p) {
  if (!p) return ''
  if (/^(https?|data|blob|capacitor):/i.test(p)) return p
  if (!isNative()) return webBlobs.get(p) || ''
  if (p.startsWith(LIB) || p.startsWith(DOCS)) return Capacitor.convertFileSrc(fileUri(p))
  if (p.startsWith('file:')) return Capacitor.convertFileSrc(p)
  return ''   // a desktop path (C:\...) synced from another device: not on this phone
}

// Absolute file path (from a native plugin) → stored path, when it is inside the app's folders
export function storedFromAbsolute(absPath) {
  const plainPath = p => {
    const s = String(p || '').replace(/^file:\/\//, '')
    try { return decodeURIComponent(s) } catch { return s }
  }
  const file = plainPath(absPath)
  for (const [base, prefix] of [['docs', DOCS], ['lib', LIB]]) {
    if (!bases[base]) continue
    const root = plainPath(bases[base])
    if (file.startsWith(root + '/')) return prefix + file.slice(root.length + 1)
  }
  return null
}

export function registerWebBlob(storedPath, blob) {
  webBlobs.set(storedPath, URL.createObjectURL(blob))
}

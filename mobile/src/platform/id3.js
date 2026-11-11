// Minimal ID3v2 reader (v2.2, v2.3, v2.4) for the iPhone app.
//
// The desktop uses music-metadata (Node only). On the phone we only need what the library shows —
// title, artist, album, genre, year and the cover picture — and only from the tag at the start of
// the file, so the importer can fetch just those bytes (see media.js: id3TagSize + Range request).
// Files without a tag (e.g. plain yt-dlp downloads) fall back to the file name, like the desktop.

const LATIN1 = new TextDecoder('iso-8859-1')
const UTF8   = new TextDecoder('utf-8')
const UTF16LE = new TextDecoder('utf-16le')
const UTF16BE = new TextDecoder('utf-16be')

const syncsafe = (b, i) => ((b[i] & 0x7f) << 21) | ((b[i + 1] & 0x7f) << 14) | ((b[i + 2] & 0x7f) << 7) | (b[i + 3] & 0x7f)
const uint32   = (b, i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]

// Total bytes of the ID3v2 tag at the start of `head` (header + body + footer), 0 if none.
// `head` needs only the first 10 bytes of the file.
export function id3TagSize(head) {
  const b = head instanceof Uint8Array ? head : new Uint8Array(head)
  if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return 0   // "ID3"
  const footer = (b[5] & 0x10) ? 10 : 0
  return 10 + syncsafe(b, 6) + footer
}

// Reverses ID3 "unsynchronisation": every 0xFF 0x00 pair becomes 0xFF
function removeUnsync(b) {
  const out = new Uint8Array(b.length)
  let j = 0
  for (let i = 0; i < b.length; i++) {
    out[j++] = b[i]
    if (b[i] === 0xff && b[i + 1] === 0x00) i++
  }
  return out.subarray(0, j)
}

function decodeText(enc, bytes) {
  let s
  if (enc === 1) {                       // UTF-16 with BOM
    if (bytes[0] === 0xfe && bytes[1] === 0xff) s = UTF16BE.decode(bytes.subarray(2))
    else if (bytes[0] === 0xff && bytes[1] === 0xfe) s = UTF16LE.decode(bytes.subarray(2))
    else s = UTF16LE.decode(bytes)
  } else if (enc === 2) s = UTF16BE.decode(bytes)
  else if (enc === 3) s = UTF8.decode(bytes)
  else s = LATIN1.decode(bytes)
  // v2.4 allows several values separated by NUL — keep the first; drop terminators
  return s.split('\u0000').find(v => v.trim())?.trim() || ''
}

// Index right after a NUL terminator starting at `from` (2-byte terminator for UTF-16)
function skipTerminated(bytes, from, enc) {
  if (enc === 1 || enc === 2) {
    for (let i = from; i + 1 < bytes.length; i += 2) if (bytes[i] === 0 && bytes[i + 1] === 0) return i + 2
    return bytes.length
  }
  for (let i = from; i < bytes.length; i++) if (bytes[i] === 0) return i + 1
  return bytes.length
}

function readPicture(id, data) {
  const enc = data[0]
  let i = 1
  let mime
  if (id === 'PIC') {                    // v2.2: 3-char image format
    const fmt = LATIN1.decode(data.subarray(1, 4)).toLowerCase()
    mime = fmt === 'png' ? 'image/png' : 'image/jpeg'
    i = 4
  } else {
    const end = skipTerminated(data, 1, 0)
    mime = LATIN1.decode(data.subarray(1, end - 1)).toLowerCase() || 'image/jpeg'
    if (!mime.includes('/')) mime = `image/${mime === 'jpg' ? 'jpeg' : mime}`
    i = end
  }
  const type = data[i]
  i = skipTerminated(data, i + 1, enc)  // description
  return { type, mime, data: data.subarray(i) }
}

const FRAME_MAP = {
  TIT2: 'title', TT2: 'title',
  TPE1: 'artist', TP1: 'artist',
  TALB: 'album', TAL: 'album',
  TCON: 'genre', TCO: 'genre',
  TYER: 'year', TYE: 'year', TDRC: 'year',
}

// Parses an ID3v2 tag from the start of `buffer`. Returns null when there is no (readable) tag.
export function parseId3(buffer) {
  let b = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const size = id3TagSize(b)
  if (!size) return null
  const major = b[3]
  if (major < 2 || major > 4) return null
  const flags = b[5]
  let body = b.subarray(10, Math.min(b.length, size))
  if ((flags & 0x80) && major < 4) body = removeUnsync(body)   // v2.3: whole-tag unsync

  let pos = 0
  if (major >= 3 && (flags & 0x40)) {                          // extended header
    pos = major === 4 ? syncsafe(body, 0) : uint32(body, 0) + 4
  }

  const idLen = major === 2 ? 3 : 4
  const headLen = major === 2 ? 6 : 10
  const out = { title: '', artist: '', album: '', genre: '', year: null, picture: null }
  const pictures = []

  while (pos + headLen <= body.length) {
    const id = LATIN1.decode(body.subarray(pos, pos + idLen))
    if (!/^[A-Z0-9]+$/.test(id)) break                         // padding or garbage
    let frameSize
    if (major === 2) frameSize = (body[pos + 3] << 16) | (body[pos + 4] << 8) | body[pos + 5]
    else if (major === 4) frameSize = syncsafe(body, pos + 4)
    else frameSize = uint32(body, pos + 4)
    const formatFlags = major >= 3 ? body[pos + 9] : 0
    let data = body.subarray(pos + headLen, pos + headLen + frameSize)
    pos += headLen + frameSize
    if (frameSize <= 0 || data.length < frameSize) break

    if (major === 4) {
      if (formatFlags & 0x01) data = data.subarray(4)          // data length indicator
      if (formatFlags & 0x02) data = removeUnsync(data)        // frame-level unsync
    }
    if (major === 4 ? (formatFlags & 0x0c) : major === 3 ? (formatFlags & 0xc0) : 0) continue  // compressed/encrypted

    const key = FRAME_MAP[id]
    if (key && !out[key]) {
      const text = decodeText(data[0], data.subarray(1))
      if (key === 'year') {
        const y = parseInt(text.slice(0, 4), 10)
        out.year = Number.isFinite(y) ? y : null
      } else if (key === 'genre') {
        out.genre = text.replace(/^\(\d+\)/, '').trim() || (/^\(?\d+\)?$/.test(text) ? '' : text)
      } else {
        out[key] = text
      }
    } else if (id === 'APIC' || id === 'PIC') {
      try { pictures.push(readPicture(id, data)) } catch {}
    }
  }

  // Prefer the front cover (type 3), like music-metadata's first picture otherwise
  out.picture = pictures.find(p => p.type === 3 && p.data.length) || pictures.find(p => p.data.length) || null
  return out
}

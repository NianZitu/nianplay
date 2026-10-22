// Shared track-matching logic for imports and cloud sync (main process).
//
// findTrackMatch() is the reference behaviour: match by yt_url, otherwise only
// when title + artist (+ duration or album) identify exactly one track.
// TrackIndex gives the same answers in O(1) per lookup, for loops that match
// many imported tracks against the whole library.

const { urlKey } = require('./mediaUrl')

const norm = s => (s || '').toLowerCase().trim()

// Links are compared by urlKey: youtu.be/ID, watch?v=ID&list=... etc. are the same video
function findTrackMatch(tracks, track) {
  const key = urlKey(track.yt_url)
  if (key) {
    const byUrl = tracks.find(t => urlKey(t.yt_url) === key)
    if (byUrl) return byUrl
  }

  const title = norm(track.title)
  const artist = norm(track.artist)
  const album = norm(track.album)
  const duration = Math.round(track.duration || 0)

  let matches = tracks.filter(t =>
    norm(t.title) === title &&
    norm(t.artist) === artist &&
    Math.abs(Math.round(t.duration || 0) - duration) <= 2
  )
  if (matches.length === 1) return matches[0]

  matches = tracks.filter(t =>
    norm(t.title) === title &&
    norm(t.artist) === artist &&
    norm(t.album) === album
  )
  if (matches.length === 1) return matches[0]

  matches = tracks.filter(t => norm(t.title) === title && norm(t.artist) === artist)
  return matches.length === 1 ? matches[0] : null
}

const titleArtistKey = t => `${norm(t.title)}\u0000${norm(t.artist)}`

class TrackIndex {
  constructor(tracks) {
    this.byUrl         = new Map() // urlKey(yt_url) → first track with it (Array.find semantics)
    this.byTitleArtist = new Map() // title+artist → tracks, in library order
    this.byTitle       = new Map() // title → tracks, in library order
    for (const t of tracks) this.add(t)
  }

  // Call for every track appended to the library while the index is in use
  add(track) {
    this.noteUrl(track)
    const ta = titleArtistKey(track)
    if (!this.byTitleArtist.has(ta)) this.byTitleArtist.set(ta, [])
    this.byTitleArtist.get(ta).push(track)
    const ti = norm(track.title)
    if (!this.byTitle.has(ti)) this.byTitle.set(ti, [])
    this.byTitle.get(ti).push(track)
  }

  // Call after setting yt_url on a track that is already indexed
  noteUrl(track) {
    const key = urlKey(track.yt_url)
    if (key && !this.byUrl.has(key)) this.byUrl.set(key, track)
  }

  // Same result as findTrackMatch(tracks, track): every tier after the URL check
  // only considers tracks with identical title + artist, so it searches that group
  match(track) {
    const key = urlKey(track.yt_url)
    if (key && this.byUrl.has(key)) return this.byUrl.get(key)

    const group = this.byTitleArtist.get(titleArtistKey(track)) || []
    if (group.length === 0) return null
    if (group.length === 1) return group[0]

    const duration = Math.round(track.duration || 0)
    let matches = group.filter(t => Math.abs(Math.round(t.duration || 0) - duration) <= 2)
    if (matches.length === 1) return matches[0]

    const album = norm(track.album)
    matches = group.filter(t => norm(t.album) === album)
    if (matches.length === 1) return matches[0]

    return null
  }

  firstWithTitleArtist(track) {
    return (this.byTitleArtist.get(titleArtistKey(track)) || [])[0] || null
  }

  withTitle(title) {
    return this.byTitle.get(norm(title)) || []
  }
}

module.exports = { norm, findTrackMatch, TrackIndex }

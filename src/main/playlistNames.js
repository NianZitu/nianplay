// Playlist names are unique per account.
//
// The cloud identifies a playlist by account + name (renderer/firebase.js → playlistCloudId), so
// two local playlists with the same name would overwrite/merge each other in the cloud. Names are
// compared case-insensitively and ignoring extra spaces ("Games" = " games " = "GAMES"); accents
// count ("Música" ≠ "Musica"). Keep normalizePlaylistName identical to the renderer's copy.

const normalizePlaylistName = name =>
  (name || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()

// The playlist (other than `exceptId`) that already uses this name, or null
function findByName(playlists, name, exceptId = null) {
  const key = normalizePlaylistName(name)
  if (!key) return null
  return playlists.find(p => p.id !== exceptId && normalizePlaylistName(p.name) === key) || null
}

// `base` if free, otherwise "base (2)", "base (3)", ...
function uniqueName(playlists, base, exceptId = null) {
  const clean = (base || '').trim().replace(/\s+/g, ' ') || 'Playlist'
  if (!findByName(playlists, clean, exceptId)) return clean
  const stem = clean.replace(/\s\(\d+\)$/, '')
  for (let n = 2; n < 10000; n++) {
    const candidate = `${stem} (${n})`
    if (!findByName(playlists, candidate, exceptId)) return candidate
  }
  return `${stem} (${Date.now()})`
}

const duplicateNameError = name =>
  `Já existe uma playlist chamada "${(name || '').trim()}". Escolha outro nome — playlists com o mesmo nome se misturariam na nuvem.`

// One-time repair for accounts that already have duplicated names: the oldest playlist keeps the
// name, the others get "(2)", "(3)"... Returns the list of renames.
function dedupePlaylistNames(playlists) {
  const byAge = [...playlists].sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
  const kept = []
  const renamed = []
  for (const p of byAge) {
    if (findByName(kept, p.name)) {
      const next = uniqueName([...kept, ...playlists.filter(x => x !== p)], p.name)
      renamed.push({ id: p.id, from: p.name, to: next })
      p.name = next
      p.updated_at = Date.now()
    }
    kept.push(p)
  }
  return renamed
}

module.exports = { normalizePlaylistName, findByName, uniqueName, duplicateNameError, dedupePlaylistNames }

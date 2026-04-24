const { v4: uuidv4 } = require('uuid')
const { getDB } = require('../db')
const path = require('path')
const fs   = require('fs')

module.exports = function registerPlaylistHandlers(ipcMain) {
  ipcMain.handle('playlists:getAll', () => {
    const db = getDB()
    const playlists = db.playlists.read()
    const pt = db.playlistTracks.read()
    return playlists.map(p => ({
      ...p,
      trackCount: pt.filter(t => t.playlist_id === p.id).length,
    })).sort((a, b) => b.created_at - a.created_at)
  })

  ipcMain.handle('playlists:create', (_, { name, cover_url }) => {
    const db = getDB()
    const playlists = db.playlists.read()
    const playlist = { id: uuidv4(), name, cover_url: cover_url || '', created_at: Date.now(), updated_at: Date.now() }
    playlists.unshift(playlist)
    db.playlists.write(playlists)
    return playlist
  })

  ipcMain.handle('playlists:update', (_, { id, name, cover_url }) => {
    const db = getDB()
    const playlists = db.playlists.read()
    const idx = playlists.findIndex(p => p.id === id)
    if (idx === -1) return false
    playlists[idx] = { ...playlists[idx], name, cover_url, updated_at: Date.now() }
    db.playlists.write(playlists)
    return playlists[idx]
  })

  ipcMain.handle('playlists:delete', (_, id) => {
    const db = getDB()
    db.playlists.write(db.playlists.read().filter(p => p.id !== id))
    db.playlistTracks.write(db.playlistTracks.read().filter(pt => pt.playlist_id !== id))
    return true
  })

  ipcMain.handle('playlists:getTracks', (_, playlistId) => {
    const db = getDB()
    const pt = db.playlistTracks.read()
      .filter(t => t.playlist_id === playlistId)
      .sort((a, b) => a.position - b.position)
    const tracks = db.tracks.read()
    return pt.map(row => {
      const track = tracks.find(t => t.id === row.track_id)
      if (!track) return null
      return { ...track, group_id: row.group_id || null, group_position: row.group_position ?? 0 }
    }).filter(Boolean)
  })

  ipcMain.handle('playlists:addTrack', (_, { playlistId, trackId }) => {
    const db = getDB()
    const pt = db.playlistTracks.read()
    if (pt.find(r => r.playlist_id === playlistId && r.track_id === trackId)) return false
    const maxPos = pt.filter(r => r.playlist_id === playlistId).reduce((m, r) => Math.max(m, r.position), -1)
    pt.push({ id: uuidv4(), playlist_id: playlistId, track_id: trackId, position: maxPos + 1 })
    db.playlistTracks.write(pt)
    return true
  })

  ipcMain.handle('playlists:removeTrack', (_, { playlistId, trackId }) => {
    const db = getDB()
    db.playlistTracks.write(
      db.playlistTracks.read().filter(r => !(r.playlist_id === playlistId && r.track_id === trackId))
    )
    return true
  })

  ipcMain.handle('playlists:reorder', (_, { playlistId, orderedTrackIds }) => {
    const db = getDB()
    const pt = db.playlistTracks.read()
    orderedTrackIds.forEach((trackId, i) => {
      const row = pt.find(r => r.playlist_id === playlistId && r.track_id === trackId)
      if (row) row.position = i
    })
    db.playlistTracks.write(pt)
    return true
  })

  // Pick cover image from local file
  ipcMain.handle('playlists:chooseCover', async () => {
    const { dialog, BrowserWindow } = require('electron')
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    })
    if (result.canceled || !result.filePaths.length) return null
    return result.filePaths[0]
  })

  ipcMain.handle('playlists:toggleGroups', (_, id) => {
    const db = getDB()
    const playlists = db.playlists.read()
    const idx = playlists.findIndex(p => p.id === id)
    if (idx === -1) return false
    playlists[idx].groups_enabled = !playlists[idx].groups_enabled
    playlists[idx].updated_at = Date.now()
    db.playlists.write(playlists)
    return playlists[idx]
  })

  ipcMain.handle('playlists:createGroup', (_, { playlistId, name }) => {
    const db = getDB()
    const GROUP_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#db2777']
    const groups = db.playlistGroups.read()
    const usedColors = groups.filter(g => g.playlist_id === playlistId).map(g => g.color)
    const color = GROUP_COLORS.find(c => !usedColors.includes(c)) || GROUP_COLORS[0]
    const group = { id: uuidv4(), playlist_id: playlistId, name, color, created_at: Date.now() }
    groups.push(group)
    db.playlistGroups.write(groups)
    return group
  })

  ipcMain.handle('playlists:deleteGroup', (_, groupId) => {
    const db = getDB()
    db.playlistGroups.write(db.playlistGroups.read().filter(g => g.id !== groupId))
    const pt = db.playlistTracks.read()
    pt.forEach(row => {
      if (row.group_id === groupId) {
        row.group_id = null
        row.group_position = 0
      }
    })
    db.playlistTracks.write(pt)
    return true
  })

  ipcMain.handle('playlists:setTrackGroup', (_, { playlistId, trackId, groupId, position }) => {
    const db = getDB()
    const pt = db.playlistTracks.read()
    const row = pt.find(r => r.playlist_id === playlistId && r.track_id === trackId)
    if (!row) return false
    if (!groupId) {
      row.group_id = null
      row.group_position = 0
    } else {
      // If position is explicitly provided (e.g. from cloud sync), use it directly
      const pos = (position !== undefined && position !== null)
        ? position
        : pt.filter(r => r.playlist_id === playlistId && r.group_id === groupId)
             .reduce((m, r) => Math.max(m, r.group_position ?? -1), -1) + 1
      row.group_id = groupId
      row.group_position = pos
    }
    db.playlistTracks.write(pt)
    return true
  })

  ipcMain.handle('playlists:reorderGroup', (_, { playlistId, groupId, orderedTrackIds }) => {
    const db = getDB()
    const pt = db.playlistTracks.read()
    orderedTrackIds.forEach((trackId, i) => {
      const row = pt.find(r => r.playlist_id === playlistId && r.group_id === groupId && r.track_id === trackId)
      if (row) row.group_position = i
    })
    db.playlistTracks.write(pt)
    return true
  })

  ipcMain.handle('playlists:getGroups', (_, playlistId) => {
    const db = getDB()
    return db.playlistGroups.read().filter(g => g.playlist_id === playlistId)
  })

  // Open browser for Google Images search
  ipcMain.handle('playlists:searchImageBrowser', (_, query) => {
    const { shell } = require('electron')
    const q = encodeURIComponent(query + ' playlist cover art')
    shell.openExternal(`https://www.google.com/search?q=${q}&tbm=isch`)
    return true
  })

  // Export a playlist (with all its tracks and groups) to a JSON file
  ipcMain.handle('playlists:export', async (_, playlistId) => {
    const { dialog, BrowserWindow } = require('electron')
    const db = getDB()
    const playlist = db.playlists.read().find(p => p.id === playlistId)
    if (!playlist) return { error: 'Playlist não encontrada' }

    const pt = db.playlistTracks.read()
      .filter(r => r.playlist_id === playlistId)
      .sort((a, b) => a.position - b.position)
    const allTracks  = db.tracks.read()
    const allGroups  = db.playlistGroups.read().filter(g => g.playlist_id === playlistId)
    // Build lookup: group id → group name
    const groupById  = allGroups.reduce((m, g) => { m[g.id] = g; return m }, {})

    const tracks = pt.map(row => {
      const t = allTracks.find(t => t.id === row.track_id)
      if (!t) return null
      return {
        title:          t.title,
        artist:         t.artist,
        album:          t.album,
        duration:       t.duration,
        genre:          t.genre,
        year:           t.year,
        yt_url:         t.yt_url,
        lyrics:         t.lyrics,
        gain:           t.gain,
        group_name:     row.group_id ? (groupById[row.group_id]?.name || null) : null,
        group_position: row.group_id ? (row.group_position ?? 0) : null,
      }
    }).filter(Boolean)

    const groups = allGroups.map(g => ({
      name:       g.name,
      color:      g.color,
      created_at: g.created_at,
    }))

    const exportData = {
      version:    2,
      type:       'nianplay-playlist',
      name:       playlist.name,
      cover_url:  playlist.cover_url || '',
      exportedAt: Date.now(),
      groups,
      tracks,
    }

    const win = BrowserWindow.getFocusedWindow()
    const safeName = playlist.name.replace(/[<>:"/\\|?*]/g, '_')
    const result = await dialog.showSaveDialog(win, {
      defaultPath: `${safeName}.nianplaylist`,
      filters: [{ name: 'NianPlay Playlist', extensions: ['nianplaylist'] }, { name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return { canceled: true }

    fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf8')
    return { ok: true, path: result.filePath, trackCount: tracks.length }
  })

  // Import a playlist from a JSON file
  ipcMain.handle('playlists:import', async () => {
    const { dialog, BrowserWindow } = require('electron')
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'NianPlay Playlist', extensions: ['nianplaylist', 'json'] }],
    })
    if (result.canceled || !result.filePaths.length) return { canceled: true }

    let data
    try {
      data = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'))
    } catch {
      return { error: 'Arquivo inválido ou corrompido' }
    }

    if (data.type !== 'nianplay-playlist' || !Array.isArray(data.tracks)) {
      return { error: 'Formato não reconhecido' }
    }

    const db = getDB()
    const allTracks = db.tracks.read()

    // Create the playlist
    const playlist = {
      id:         uuidv4(),
      name:       data.name || 'Playlist Importada',
      cover_url:  data.cover_url || '',
      created_at: Date.now(),
      updated_at: Date.now(),
    }
    const playlists = db.playlists.read()
    playlists.unshift(playlist)
    db.playlists.write(playlists)

    // For each track: find match in library with tiered strategy, or create virtual track
    const UNKNOWN = new Set(['desconhecido', 'unknown', 'desconocido', ''])
    const norm = s => (s || '').toLowerCase().trim()

    const pt = db.playlistTracks.read()
    let added = 0
    let created = 0

    // Map import index → matched track id — used later for group assignment
    // to guarantee we use the SAME track that was stored in the playlist row
    const importIndexToTrackId = {}

    for (let i = 0; i < data.tracks.length; i++) {
      const imp = data.tracks[i]
      const impTitle  = norm(imp.title)
      const impArtist = norm(imp.artist)

      // 1. yt_url match (most reliable)
      let match = imp.yt_url
        ? allTracks.find(t => t.yt_url && t.yt_url === imp.yt_url)
        : null

      // 2. Exact title + artist match
      if (!match) {
        match = allTracks.find(t =>
          norm(t.title) === impTitle && norm(t.artist) === impArtist
        )
      }

      // 3. Title match only — covers "Desconhecido" vs real artist, or re-tagged files
      if (!match) {
        match = allTracks.find(t =>
          norm(t.title) === impTitle && t.file_path  // real file only
        )
      }

      // 4. Duration-guided title fuzzy — same title prefix and duration within 3s
      if (!match && imp.duration) {
        match = allTracks.find(t =>
          t.file_path &&
          Math.abs((t.duration || 0) - imp.duration) <= 3 &&
          (norm(t.title).startsWith(impTitle.slice(0, 8)) || impTitle.startsWith(norm(t.title).slice(0, 8)))
        )
      }

      if (!match) {
        // Create a virtual (metadata-only) track
        match = {
          id:         uuidv4(),
          title:      imp.title    || 'Desconhecido',
          artist:     imp.artist   || 'Desconhecido',
          album:      imp.album    || '',
          duration:   imp.duration || 0,
          file_path:  '',
          cover_path: null,
          genre:      imp.genre    || '',
          year:       imp.year     || null,
          gain:       imp.gain     || 0,
          lyrics:     imp.lyrics   || '',
          yt_url:     imp.yt_url   || '',
          created_at: Date.now(),
          updated_at: Date.now(),
        }
        allTracks.push(match)
        created++
      } else {
        // Merge metadata missing from local track
        let changed = false
        if (!match.yt_url && imp.yt_url)   { match.yt_url  = imp.yt_url;  changed = true }
        if (!match.lyrics && imp.lyrics)   { match.lyrics  = imp.lyrics;  changed = true }
        if (!match.gain   && imp.gain)     { match.gain    = imp.gain;    changed = true }
        if (changed) match.updated_at = Date.now()
      }

      importIndexToTrackId[i] = match.id  // remember which track was used

      if (!pt.find(r => r.playlist_id === playlist.id && r.track_id === match.id)) {
        pt.push({ id: uuidv4(), playlist_id: playlist.id, track_id: match.id, position: i })
        added++
      }
    }

    db.tracks.write(allTracks)
    db.playlistTracks.write(pt)

    // ── Restore groups (version 2+) ──────────────────────────────────────────
    if (Array.isArray(data.groups) && data.groups.length > 0) {
      const GROUP_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#db2777']
      const groups = db.playlistGroups.read()

      // Map group name → new local group id
      const groupNameToId = {}
      data.groups.forEach((g, idx) => {
        const color = g.color || GROUP_COLORS[idx % GROUP_COLORS.length]
        const newGroup = { id: uuidv4(), playlist_id: playlist.id, name: g.name, color, created_at: g.created_at || Date.now() }
        groups.push(newGroup)
        groupNameToId[g.name] = newGroup.id
      })
      db.playlistGroups.write(groups)

      // Assign group memberships using the importIndexToTrackId map
      // (guarantees same track_id that was written to playlistTracks)
      const ptFinal = db.playlistTracks.read()
      data.tracks.forEach((imp, i) => {
        if (!imp.group_name || !(imp.group_name in groupNameToId)) return
        const groupId = groupNameToId[imp.group_name]
        const trackId = importIndexToTrackId[i]
        if (!trackId) return
        const row = ptFinal.find(r => r.playlist_id === playlist.id && r.track_id === trackId)
        if (row) {
          row.group_id       = groupId
          row.group_position = imp.group_position ?? 0
        }
      })
      db.playlistTracks.write(ptFinal)
    }

    return {
      ok:          true,
      playlist,
      trackCount:  data.tracks.length,
      matched:     data.tracks.length - created,
      created,
    }
  })
}

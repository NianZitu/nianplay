const { getDB } = require('../db')

// Player session (queue + playback state) in its own file, player_session.json.
// The queue is large and only changes when a new list starts playing; the small
// state (index, time, volume, shuffle) is saved often. Keeping them apart avoids
// re-serializing ~100 KB of queue every few seconds.
//
// Shape: { queue: Track[], state: { currentIdx, currentTime, volume, shuffle,
//          shuffledOrder, shuffledPos, groupsEnabled } }

function migrateLegacySession(db) {
  const settings = db.settings.read()
  const legacy = settings.playerSession
  if (!legacy) return null
  const { queue, ...state } = legacy
  const session = { queue: Array.isArray(queue) ? queue : [], state }
  db.playerSession.write(session)
  delete settings.playerSession
  db.settings.write(settings)
  console.log('[Player] Migrated session from settings.json')
  return session
}

module.exports = function registerPlayerHandlers(ipcMain) {
  ipcMain.handle('player:getSession', () => {
    const db = getDB()
    const session = db.playerSession.read()
    if (session.queue || session.state) return session
    return migrateLegacySession(db) || {}
  })

  ipcMain.handle('player:saveState', (_, state) => {
    const db = getDB()
    db.playerSession.write({ ...db.playerSession.read(), state })
    return true
  })

  ipcMain.handle('player:saveQueue', (_, queue) => {
    const db = getDB()
    db.playerSession.write({ ...db.playerSession.read(), queue: Array.isArray(queue) ? queue : [] })
    return true
  })
}

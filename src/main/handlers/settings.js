const { getDB } = require('../db')

module.exports = function registerSettingsHandlers(ipcMain) {
  ipcMain.handle('settings:get', (_, key) => {
    const all = getDB().settings.read()
    return all[key] ?? null
  })

  ipcMain.handle('settings:set', (_, key, value) => {
    const all = getDB().settings.read()
    all[key] = value
    getDB().settings.write(all)
    return true
  })

  ipcMain.handle('settings:getAll', () => {
    return getDB().settings.read()
  })
}

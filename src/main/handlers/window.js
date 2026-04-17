module.exports = function registerWindowHandlers(ipcMain, win) {
  ipcMain.handle('window:minimize',   () => win.minimize())
  ipcMain.handle('window:maximize',   () => {
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.handle('window:close',      () => win.close())
  ipcMain.handle('window:isMaximized',() => win.isMaximized())

  ipcMain.handle('dialog:openFolder', async () => {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })
}

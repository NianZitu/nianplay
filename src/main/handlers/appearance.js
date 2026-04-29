const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')
const { app, dialog, BrowserWindow } = require('electron')
const { getDB } = require('../db')

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.mkv', '.avi'])

function safeExt(filePath, fallback = '.bin') {
  const ext = path.extname(filePath).toLowerCase()
  return ext || fallback
}

function typeFromPath(filePath) {
  const ext = safeExt(filePath)
  if (VIDEO_EXTENSIONS.has(ext)) return 'video'
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  return ''
}

module.exports = function registerAppearanceHandlers(ipcMain) {
  ipcMain.handle('appearance:chooseWallpaper', async (_, kind = 'all') => {
    const win = BrowserWindow.getFocusedWindow()
    const filters = []

    if (kind === 'image' || kind === 'all') {
      filters.push({ name: 'Imagens', extensions: [...IMAGE_EXTENSIONS].map(e => e.slice(1)) })
    }
    if (kind === 'video' || kind === 'all') {
      filters.push({ name: 'Videos', extensions: [...VIDEO_EXTENSIONS].map(e => e.slice(1)) })
    }

    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: filters.length ? filters : [{ name: 'Midia', extensions: ['jpg', 'png', 'webp', 'mp4', 'webm'] }],
    })

    if (result.canceled || !result.filePaths.length) return null

    const source = result.filePaths[0]
    const type = typeFromPath(source)
    if (!type) return { error: 'Arquivo de wallpaper nao reconhecido.' }

    const dir = path.join(app.getPath('userData'), 'wallpapers')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const dest = path.join(dir, `account-wallpaper${safeExt(source)}`)
    fs.copyFileSync(source, dest)

    const wallpaper = {
      src: `${pathToFileURL(dest).toString()}?v=${Date.now()}`,
      type,
      mode: getDB().settings.read().accountWallpaper?.mode || 'normal',
      file_path: dest,
    }

    const settings = getDB().settings.read()
    settings.accountWallpaper = wallpaper
    getDB().settings.write(settings)

    return wallpaper
  })

  ipcMain.handle('appearance:setWallpaper', (_, wallpaper) => {
    const settings = getDB().settings.read()
    settings.accountWallpaper = wallpaper || null
    getDB().settings.write(settings)
    return settings.accountWallpaper
  })
}

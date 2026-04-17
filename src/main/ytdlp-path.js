const path = require('path')
const { app } = require('electron')

// yt-dlp binary stored in userData so it persists between updates
// e.g. C:\Users\<user>\AppData\Roaming\nianplay\yt-dlp.exe
const binName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
module.exports   = path.join(app.getPath('userData'), binName)

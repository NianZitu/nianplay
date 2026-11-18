import { registerPlugin } from '@capacitor/core'

// Android: android/src/.../NianYoutubePlugin.kt. Browser (dev server only): a stand-in that fakes
// search/download (web.js). iOS has neither, so Capacitor.isPluginAvailable('NianYoutube') is false
// there and the app hides the download features.
let webInstance = null
export const NianYoutube = registerPlugin('NianYoutube', {
  web: () => (webInstance ||= import('./web.js').then(m => new m.NianYoutubeWeb())),
})

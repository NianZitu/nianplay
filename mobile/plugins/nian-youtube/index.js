import { registerPlugin } from '@capacitor/core'

// Android only (android/src/.../NianYoutubePlugin.kt). Elsewhere every call rejects as "not
// implemented" and the app hides the download features (Capacitor.isPluginAvailable).
export const NianYoutube = registerPlugin('NianYoutube')

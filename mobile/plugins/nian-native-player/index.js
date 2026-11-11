import { registerPlugin } from '@capacitor/core'

// iOS: ios/Sources/NianNativePlayerPlugin (AVPlayer). Web: a test stand-in (web.js).
// The web instance is cached here: Capacitor calls this factory once per call made before the
// first one resolves, which would spread listeners and playback across several instances.
let webInstance = null
export const NianNativePlayer = registerPlugin('NianNativePlayer', {
  web: () => (webInstance ||= import('./web.js').then(m => new m.NianNativePlayerWeb())),
})

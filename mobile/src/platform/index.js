// Boots the iPhone platform layer before React renders.
import { App } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { db, loadAll, flushAll } from './storage'
import { initPaths, mediaUrl, isNative } from './paths'
import { installElectronApi } from './api'
import { scanDocuments } from './media'

export async function initPlatform() {
  await loadAll()
  await initPaths()

  // Read by the shared renderer code (utils/covers.js, store/PlayerContext.jsx)
  window.nianplayPlatform = {
    mobile: true,
    mediaUrl,
    // "Equalização no iPhone" (Conta → Ajustes). Applied when the app starts.
    webAudio: db.settings.read().mobileWebAudio !== false,
    // "Volume do NianPlay" — multiplies the gain node (iOS ignores audio.volume). 50% by default:
    // with the LUFS gains the music was too loud even at the lowest system volume.
    outputGain: Number(db.settings.read().mobileVolume ?? 0.5),
  }
  installElectronApi()

  if (isNative()) {
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
    // iOS can kill a backgrounded app without warning: persist everything now
    App.addListener('pause', () => { flushAll() })
    // New files may have been dropped in the app's Documents folder meanwhile
    App.addListener('resume', () => { scanDocuments().catch(() => {}) })
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushAll() })
}

export { scanDocuments }

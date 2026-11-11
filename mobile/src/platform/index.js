// Boots the iPhone platform layer before React renders.
import { App } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Capacitor } from '@capacitor/core'
import { db, loadAll, flushAll } from './storage'
import { initPaths, mediaUrl, isNative } from './paths'
import { installElectronApi } from './api'
import { scanDocuments } from './media'

export async function initPlatform() {
  await loadAll()
  await initPaths()

  // Native AVPlayer (plugin nian-native-player): keeps playing in the background and with the
  // screen off. Web Audio did not — iOS suspends it when the app leaves the screen.
  const nativePlayer = isNative()
    ? Capacitor.isPluginAvailable('NianNativePlayer')
    : (() => { try { return localStorage.getItem('nianNativeWeb') === '1' } catch { return false } })()   // browser test of that path
  let NativeAudio = null
  if (nativePlayer) ({ NativeAudio } = await import('./nativeAudio'))
  let nativeAudio = null

  // Read by the shared renderer code (utils/covers.js, store/PlayerContext.jsx)
  window.nianplayPlatform = {
    mobile: true,
    mediaUrl,
    nativePlayer,
    // PlayerContext creates its audio element through this when present
    createAudio: nativePlayer ? () => (nativeAudio = new NativeAudio()) : undefined,
    // "Equalização no iPhone" (Conta → Ajustes). Applied when the app starts. With the native
    // player there is no Web Audio: the LUFS gain goes to the AVPlayer volume (nativeAudio.js).
    webAudio: !nativePlayer && db.settings.read().mobileWebAudio !== false,
    // Same setting, for the native player: apply the per-track LUFS gain (changes apply at once)
    lufs: db.settings.read().mobileWebAudio !== false,
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
    App.addListener('resume', () => {
      scanDocuments().catch(() => {})
      nativeAudio?.refresh()   // position/state moved on natively while the WebView was frozen
    })
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushAll() })
}

export { scanDocuments }

import { initializeApp }                                       from 'firebase/app'
import { initializeAuth, indexedDBLocalPersistence, browserPopupRedirectResolver } from 'firebase/auth'
import { getFirestore }                                         from 'firebase/firestore'
import { canonicalUrl }                                         from './utils/mediaUrl'

// ─── CONFIGURAÇÃO FIREBASE ───────────────────────────────────────────────────
// 1. Acesse https://console.firebase.google.com
// 2. Crie um projeto → Adicione um app Web
// 3. Copie o firebaseConfig gerado e cole abaixo
// 4. No Firestore → Regras, adicione:
//
//   rules_version = '2';
//   service cloud.firestore {
//     match /databases/{database}/documents {
//       match /users/{userId}/{document=**} {
//         allow read, write: if request.auth.uid == userId;
//       }
//     }
//   }
// ─────────────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBF7kTz5bBZ6VG7uODbbWfZKh_ZM9T7mgk",
  authDomain:        "nianplay-bdd59.firebaseapp.com",
  projectId:         "nianplay-bdd59",
  storageBucket:     "nianplay-bdd59.firebasestorage.app",
  messagingSenderId: "492681068704",
  appId:             "1:492681068704:web:ce783b304c87898c3549c5",
}

const firebaseApp = initializeApp(firebaseConfig)

// indexedDBLocalPersistence é necessário no Electron (contextIsolation bloqueia localStorage)
//
// iPhone app (mobile/, Capacitor): NO popupRedirectResolver. It loads a hidden iframe from the
// authDomain to support Google popup/redirect sign-in; inside the iOS WebView (capacitor://)
// that iframe never loads and Auth never finishes initializing — onAuthStateChanged never fires
// and the account screen spins forever. The phone only uses e-mail/password, which doesn't need it.
// window.Capacitor is injected by the native side before any page script runs.
const isNativeApp = typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.())
export const auth = initializeAuth(firebaseApp, isNativeApp
  ? { persistence: indexedDBLocalPersistence }
  : { persistence: indexedDBLocalPersistence, popupRedirectResolver: browserPopupRedirectResolver })
export const db = getFirestore(firebaseApp)

// Deterministic cloud ID from track or playlist fields
export function trackCloudId(track) {
  const title = (track.title || '').toLowerCase().trim()
  const artist = (track.artist || '').toLowerCase().trim()
  const album = (track.album || '').toLowerCase().trim()
  // canonical: the same video in any link format gets the same cloud id
  const ytUrl = canonicalUrl(track.yt_url)
  const duration = Math.round(track.duration || 0)
  const filePath = (track.file_path || '').toLowerCase().trim()
  const key = ytUrl
    ? `yt|${ytUrl}`
    : filePath
      ? `file|${filePath}|${duration}`
      : `meta|${title}|${artist}|${album}|${duration}`
  let h = 5381
  for (let i = 0; i < key.length; i++) h = Math.imul((h << 5) + h, 1) ^ key.charCodeAt(i)
  return `t_${(h >>> 0).toString(36)}`
}

// Playlist names are unique per account — same rules as src/main/playlistNames.js (keep identical)
export const normalizePlaylistName = name =>
  (name || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()

function djb2(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = Math.imul((h << 5) + h, 1) ^ str.charCodeAt(i)
  return h >>> 0
}
function fnv1a(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193)
  return h >>> 0
}

// Cloud id of a playlist = account + normalized name. The same name in the same account always
// maps to the same document, so sending again REPLACES it (it used to be name + creation date,
// which created a new copy whenever a playlist was recreated or renamed). 64 bits (two hashes)
// because communityPlaylists is shared by all accounts and must not collide between users.
export function playlistCloudId(playlist, ownerUid) {
  const key = `${ownerUid || 'local'}|${normalizePlaylistName(playlist.name)}`
  return `p_${djb2(key).toString(36).padStart(7, '0')}${fnv1a(key).toString(36).padStart(7, '0')}`
}

import { initializeApp }                                       from 'firebase/app'
import { initializeAuth, indexedDBLocalPersistence }           from 'firebase/auth'
import { getFirestore }                                         from 'firebase/firestore'

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
export const auth = initializeAuth(firebaseApp, {
  persistence: indexedDBLocalPersistence,
})
export const db = getFirestore(firebaseApp)

// Deterministic cloud ID from track or playlist fields
export function trackCloudId(track) {
  const key = `${(track.title || '').toLowerCase().trim()}|${(track.artist || '').toLowerCase().trim()}`
  let h = 5381
  for (let i = 0; i < key.length; i++) h = Math.imul((h << 5) + h, 1) ^ key.charCodeAt(i)
  return `t_${(h >>> 0).toString(36)}`
}

export function playlistCloudId(playlist) {
  const key = `${(playlist.name || '').toLowerCase().trim()}|${playlist.created_at || ''}`
  let h = 5381
  for (let i = 0; i < key.length; i++) h = Math.imul((h << 5) + h, 1) ^ key.charCodeAt(i)
  return `p_${(h >>> 0).toString(36)}`
}

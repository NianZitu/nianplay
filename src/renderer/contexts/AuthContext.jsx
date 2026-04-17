import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import {
  doc, collection, getDocs, setDoc, deleteDoc,
  writeBatch, serverTimestamp,
} from 'firebase/firestore'
import { auth, db, trackCloudId, playlistCloudId } from '../firebase'

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

// ─── Firestore batch helper (Firestore limit: 500 ops/batch) ─────────────────
async function commitInChunks(ops) {
  const SIZE = 400
  for (let i = 0; i < ops.length; i += SIZE) {
    const batch = writeBatch(db)
    ops.slice(i, i + SIZE).forEach(fn => fn(batch))
    await batch.commit()
  }
}

export function AuthProvider({ children }) {
  const [user,       setUser]       = useState(undefined) // undefined = loading
  const [syncStatus, setSyncStatus] = useState({ uploading: false, downloading: false, error: null, lastSync: null })

  // ── Auth state listener ────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u ?? null))
    return unsub
  }, [])

  // ── Auth actions ───────────────────────────────────────────────────────────
  async function login(email, password) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function register(email, password, displayName) {
    const { user: u } = await createUserWithEmailAndPassword(auth, email, password)
    if (displayName) await updateProfile(u, { displayName })
  }

  async function logout() {
    await signOut(auth)
  }

  // ── Upload local → cloud ──────────────────────────────────────────────────
  const syncToCloud = useCallback(async () => {
    if (!user) return
    setSyncStatus(s => ({ ...s, uploading: true, error: null }))
    try {
      const [tracks, playlists] = await Promise.all([
        window.electron.library.getTracks(),
        window.electron.playlists.getAll(),
      ])

      const ops = []

      // Tracks
      for (const t of (tracks || [])) {
        const id  = trackCloudId(t)
        const ref = doc(db, 'users', user.uid, 'tracks', id)
        ops.push(batch => batch.set(ref, {
          title:     t.title     || '',
          artist:    t.artist    || '',
          album:     t.album     || '',
          duration:  t.duration  || 0,
          yt_url:    t.yt_url    || '',
          cover_url: t.cover_url || '',
          lyrics:    t.lyrics    || '',
          gain:      t.gain      || 0,
          updatedAt: serverTimestamp(),
        }, { merge: true }))
      }

      // Playlists + their tracks
      for (const pl of (playlists || [])) {
        const plId  = playlistCloudId(pl)
        const plRef = doc(db, 'users', user.uid, 'playlists', plId)
        ops.push(batch => batch.set(plRef, {
          name:       pl.name       || '',
          cover_url:  pl.cover_url  || '',
          created_at: pl.created_at || '',
          updatedAt:  serverTimestamp(),
        }, { merge: true }))

        // Playlist tracks
        const plTracks = await window.electron.playlists.getTracks(pl.id)
        for (const t of (plTracks || [])) {
          const tId  = trackCloudId(t)
          const ptRef = doc(db, 'users', user.uid, 'playlists', plId, 'tracks', tId)
          ops.push(batch => batch.set(ptRef, {
            title:    t.title  || '',
            artist:   t.artist || '',
            position: t.position || 0,
          }, { merge: true }))
        }
      }

      await commitInChunks(ops)
      setSyncStatus(s => ({ ...s, uploading: false, lastSync: Date.now() }))
    } catch (e) {
      console.error('[Sync] Upload failed:', e)
      setSyncStatus(s => ({ ...s, uploading: false, error: e.message }))
    }
  }, [user])

  // ── Download cloud → local ─────────────────────────────────────────────────
  const syncFromCloud = useCallback(async () => {
    if (!user) return
    setSyncStatus(s => ({ ...s, downloading: true, error: null }))
    try {
      const localTracks = await window.electron.library.getTracks()
      const localKeys   = new Set((localTracks || []).map(t =>
        `${(t.title || '').toLowerCase()}|${(t.artist || '').toLowerCase()}`
      ))

      // Fetch cloud tracks
      const tracksSnap = await getDocs(collection(db, 'users', user.uid, 'tracks'))
      const newTracks  = []
      tracksSnap.forEach(d => {
        const t   = d.data()
        const key = `${(t.title || '').toLowerCase()}|${(t.artist || '').toLowerCase()}`
        if (!localKeys.has(key)) newTracks.push(t)
      })

      // Import missing tracks into local library as virtual entries (no file_path)
      for (const t of newTracks) {
        await window.electron.library.importVirtualTrack({
          title:     t.title    || '',
          artist:    t.artist   || '',
          album:     t.album    || '',
          duration:  t.duration || 0,
          yt_url:    t.yt_url   || '',
          cover_url: t.cover_url || '',
          lyrics:    t.lyrics   || '',
          gain:      t.gain     || 0,
          file_path: '',
        })
      }

      // Fetch cloud playlists
      const localPlaylists = await window.electron.playlists.getAll()
      const localPlNames   = new Set((localPlaylists || []).map(p => (p.name || '').toLowerCase()))

      const playlistsSnap = await getDocs(collection(db, 'users', user.uid, 'playlists'))
      for (const plDoc of playlistsSnap.docs) {
        const pl = plDoc.data()
        const plName = (pl.name || '').toLowerCase()

        let localPl = (localPlaylists || []).find(p => (p.name || '').toLowerCase() === plName)
        if (!localPl) {
          // Create playlist
          localPl = await window.electron.playlists.create({ name: pl.name, cover_url: pl.cover_url })
        }

        if (!localPl?.id) continue

        // Fetch playlist tracks from cloud and add missing ones
        const ptSnap    = await getDocs(collection(db, 'users', user.uid, 'playlists', plDoc.id, 'tracks'))
        const localPlTracks = await window.electron.playlists.getTracks(localPl.id)
        const localPtKeys   = new Set((localPlTracks || []).map(t =>
          `${(t.title || '').toLowerCase()}|${(t.artist || '').toLowerCase()}`
        ))

        for (const ptDoc of ptSnap.docs) {
          const pt  = ptDoc.data()
          const key = `${(pt.title || '').toLowerCase()}|${(pt.artist || '').toLowerCase()}`
          if (localPtKeys.has(key)) continue

          // Find the track in local library
          const allTracks = await window.electron.library.getTracks()
          const match     = (allTracks || []).find(t =>
            (t.title || '').toLowerCase()  === (pt.title || '').toLowerCase() &&
            (t.artist || '').toLowerCase() === (pt.artist || '').toLowerCase()
          )
          if (match) await window.electron.playlists.addTrack(localPl.id, match.id)
        }
      }

      setSyncStatus(s => ({ ...s, downloading: false, lastSync: Date.now() }))
    } catch (e) {
      console.error('[Sync] Download failed:', e)
      setSyncStatus(s => ({ ...s, downloading: false, error: e.message }))
    }
  }, [user])

  const value = { user, syncStatus, login, register, logout, syncToCloud, syncFromCloud }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

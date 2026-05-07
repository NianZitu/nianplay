import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from 'firebase/auth'
import {
  doc, collection, getDocs, setDoc, deleteDoc,
  writeBatch, serverTimestamp, getDoc,
} from 'firebase/firestore'
import { auth, db, trackCloudId, playlistCloudId } from '../firebase'

const AuthContext = createContext(null)
const DEFAULT_PROFILE = { displayName: '', avatarDataUrl: '', frame: 'classic' }

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

// ─── Delete ALL cloud data for a user (full replace before re-upload) ────────
async function deleteAllCloudData(uid) {
  const delOps = []

  // Tracks
  const tSnap = await getDocs(collection(db, 'users', uid, 'tracks'))
  tSnap.docs.forEach(d => delOps.push(b => b.delete(d.ref)))

  // Playlists + subcollections
  const plSnap = await getDocs(collection(db, 'users', uid, 'playlists'))
  for (const plDoc of plSnap.docs) {
    const [ptSnap, grpSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'playlists', plDoc.id, 'tracks')),
      getDocs(collection(db, 'users', uid, 'playlists', plDoc.id, 'groups')),
    ])
    ptSnap.docs.forEach(d  => delOps.push(b => b.delete(d.ref)))
    grpSnap.docs.forEach(d => delOps.push(b => b.delete(d.ref)))
    delOps.push(b => b.delete(plDoc.ref))
  }

  if (delOps.length > 0) await commitInChunks(delOps)
}

function publicMediaUrl(src) {
  if (!src) return ''
  return /^https?:\/\//.test(src) ? src : ''
}

function trackKey(track) {
  return `${(track.title || '').toLowerCase().trim()}|${(track.artist || '').toLowerCase().trim()}|${Math.round(track.duration || 0)}`
}

function findTrackMatch(tracks, target) {
  if (!target) return null
  if (target.yt_url) {
    const byUrl = tracks.find(t => t.yt_url && t.yt_url === target.yt_url)
    if (byUrl) return byUrl
  }

  const duration = Math.round(target.duration || 0)
  const title = (target.title || '').toLowerCase().trim()
  const artist = (target.artist || '').toLowerCase().trim()
  const album = (target.album || '').toLowerCase().trim()

  let matches = tracks.filter(t =>
    (t.title || '').toLowerCase().trim() === title &&
    (t.artist || '').toLowerCase().trim() === artist &&
    Math.abs(Math.round(t.duration || 0) - duration) <= 2
  )
  if (matches.length === 1) return matches[0]

  matches = tracks.filter(t =>
    (t.title || '').toLowerCase().trim() === title &&
    (t.artist || '').toLowerCase().trim() === artist &&
    (t.album || '').toLowerCase().trim() === album
  )
  if (matches.length === 1) return matches[0]

  matches = tracks.filter(t =>
    (t.title || '').toLowerCase().trim() === title &&
    (t.artist || '').toLowerCase().trim() === artist
  )
  return matches.length === 1 ? matches[0] : null
}

export function AuthProvider({ children }) {
  const [user,       setUser]       = useState(undefined) // undefined = loading
  const [accountProfile, setAccountProfile] = useState(DEFAULT_PROFILE)
  const [syncStatus, setSyncStatus] = useState({ uploading: false, downloading: false, error: null, lastSync: null })

  // ── Auth state listener ────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u ?? null))
    return unsub
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadAccountProfile() {
      const local = await window.electron?.settings?.get?.('accountProfile').catch(() => null)
      let next = { ...DEFAULT_PROFILE, ...(local || {}) }

      if (user) {
        if (!next.displayName) next.displayName = user.displayName || ''
        if (!next.avatarDataUrl && user.photoURL?.startsWith('data:image/')) next.avatarDataUrl = user.photoURL

        try {
          const snap = await getDoc(doc(db, 'users', user.uid, 'profile', 'customization'))
          if (snap.exists()) next = { ...next, ...snap.data() }
        } catch (e) {
          console.warn('[Profile] Cloud profile unavailable:', e)
        }
      }

      if (!cancelled) setAccountProfile(next)
    }

    loadAccountProfile()
    return () => { cancelled = true }
  }, [user])

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

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  async function sendPasswordReset(email) {
    await sendPasswordResetEmail(auth, email)
  }

  async function updateAccountProfile(profile) {
    const next = {
      displayName: (profile.displayName || '').trim(),
      avatarDataUrl: profile.avatarDataUrl || '',
      frame: profile.frame || 'classic',
    }

    await window.electron?.settings?.set?.('accountProfile', next)
    setAccountProfile(next)

    if (auth.currentUser) {
      await updateProfile(auth.currentUser, {
        displayName: next.displayName || auth.currentUser.displayName || '',
      })
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'profile', 'customization'), {
        ...next,
        updatedAt: serverTimestamp(),
      }, { merge: true })
    }

    return next
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

      // Wipe existing cloud data so stale entries don't linger after edits/deletes
      await deleteAllCloudData(user.uid)

      const ops = []
      const communityOps = []

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

      // Playlists + their tracks + groups
      for (const pl of (playlists || [])) {
        const plId  = playlistCloudId(pl)
        const plRef = doc(db, 'users', user.uid, 'playlists', plId)
        ops.push(batch => batch.set(plRef, {
          name:            pl.name            || '',
          cover_url:       pl.cover_url       || '',
          created_at:      pl.created_at      || '',
          groups_enabled:  pl.groups_enabled  || false,
          updatedAt:       serverTimestamp(),
        }, { merge: true }))

        // Playlist groups
        const plGroups  = await window.electron.playlists.getGroups(pl.id)
        const groupById = (plGroups || []).reduce((m, g) => { m[g.id] = g; return m }, {})
        for (const g of (plGroups || [])) {
          const gCloudId = `g_${(g.name || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`
          const gRef = doc(db, 'users', user.uid, 'playlists', plId, 'groups', gCloudId)
          ops.push(batch => batch.set(gRef, {
            name:       g.name       || '',
            color:      g.color      || '',
            created_at: g.created_at || 0,
          }, { merge: true }))
        }

        // Playlist tracks (with group assignment)
        const plTracks = await window.electron.playlists.getTracks(pl.id)
        const communityTracks = []
        for (const t of (plTracks || [])) {
          const tId   = trackCloudId(t)
          const ptRef = doc(db, 'users', user.uid, 'playlists', plId, 'tracks', tId)
          const grp   = t.group_id ? groupById[t.group_id] : null
          ops.push(batch => batch.set(ptRef, {
            track_cloud_id:  tId,
            title:          t.title  || '',
            artist:         t.artist || '',
            album:          t.album || '',
            duration:       t.duration || 0,
            yt_url:         t.yt_url || '',
            cover_url:      publicMediaUrl(t.cover_url || t.cover_path),
            lyrics:         t.lyrics || '',
            gain:           t.gain || 0,
            position:       t.position     || 0,
            group_name:     grp?.name      || null,
            group_position: grp ? (t.group_position ?? 0) : null,
          }, { merge: true }))

          communityTracks.push({
            title:          t.title     || '',
            artist:         t.artist    || '',
            album:          t.album     || '',
            duration:       t.duration  || 0,
            yt_url:         t.yt_url    || '',
            cover_url:      publicMediaUrl(t.cover_url || t.cover_path),
            lyrics:         t.lyrics    || '',
            gain:           t.gain      || 0,
            group_name:     grp?.name   || null,
            group_position: grp ? (t.group_position ?? 0) : null,
          })
        }

        const communityRef = doc(db, 'communityPlaylists', plId)
        const ownerName = accountProfile.displayName || user.displayName || user.email?.split('@')[0] || 'Ouvinte NianPlay'
        communityOps.push(batch => batch.set(communityRef, {
          name:           pl.name           || '',
          cover_url:      publicMediaUrl(pl.cover_url),
          owner_uid:      user.uid,
          owner_name:     ownerName,
          owner_avatar:   accountProfile.avatarDataUrl || '',
          owner_frame:    accountProfile.frame || 'classic',
          groups_enabled: pl.groups_enabled || false,
          trackCount:     communityTracks.length,
          updatedAt:      serverTimestamp(),
          tracks:         communityTracks,
          groups:         (plGroups || []).map(g => ({
            name:       g.name       || '',
            color:      g.color      || '',
            created_at: g.created_at || 0,
          })),
        }, { merge: true }))
      }

      await commitInChunks(ops)

      try {
        if (communityOps.length > 0) await commitInChunks(communityOps)
      } catch (communityError) {
        console.warn('[Sync] Community publish skipped:', communityError)
      }

      setSyncStatus(s => ({ ...s, uploading: false, lastSync: Date.now() }))
    } catch (e) {
      console.error('[Sync] Upload failed:', e)
      setSyncStatus(s => ({ ...s, uploading: false, error: e.message }))
    }
  }, [user, accountProfile])

  // ── Download cloud → local ─────────────────────────────────────────────────
  const syncFromCloud = useCallback(async () => {
    if (!user) return
    setSyncStatus(s => ({ ...s, downloading: true, error: null }))
    try {
      const localTracks = await window.electron.library.getTracks()
      const localUrlSet  = new Set((localTracks || []).filter(t => t.yt_url).map(t => t.yt_url))
      const localMetaSet = new Set((localTracks || []).map(trackKey))

      // Fetch cloud tracks
      const tracksSnap = await getDocs(collection(db, 'users', user.uid, 'tracks'))
      const newTracks  = []
      tracksSnap.forEach(d => {
        const t   = d.data()
        if (t.yt_url && localUrlSet.has(t.yt_url)) return   // already exists by URL
        const key = trackKey(t)
        if (localMetaSet.has(key)) return                    // already exists by meta
        newTracks.push(t)
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
        const ptSnap        = await getDocs(collection(db, 'users', user.uid, 'playlists', plDoc.id, 'tracks'))
        const localPlTracks = await window.electron.playlists.getTracks(localPl.id)
        const localPtKeys   = new Set((localPlTracks || []).map(trackKey))

        const allTracks = await window.electron.library.getTracks()
        for (const ptDoc of ptSnap.docs) {
          const pt  = ptDoc.data()
          const key = trackKey(pt)
          if (localPtKeys.has(key)) continue
          let match = findTrackMatch(allTracks || [], pt)
          if (!match) {
            const imported = await window.electron.library.importVirtualTrack({
              title:     pt.title    || '',
              artist:    pt.artist   || '',
              album:     pt.album    || '',
              duration:  pt.duration || 0,
              yt_url:    pt.yt_url   || '',
              cover_url: pt.cover_url || '',
              lyrics:    pt.lyrics   || '',
              gain:      pt.gain     || 0,
              file_path: '',
            })
            if (imported?.id) {
              const refreshed = await window.electron.library.getTracks()
              match = refreshed?.find(t => t.id === imported.id)
              if (match) allTracks.push(match)
            }
          }
          if (match) await window.electron.playlists.addTrack(localPl.id, match.id)
        }

        // ── Restore groups ──────────────────────────────────────────────────
        const groupsSnap  = await getDocs(collection(db, 'users', user.uid, 'playlists', plDoc.id, 'groups'))
        if (!groupsSnap.empty) {
          const localGroups    = await window.electron.playlists.getGroups(localPl.id)
          const groupNameToId  = {}

          // Build / reuse local groups
          for (const gDoc of groupsSnap.docs) {
            const g = gDoc.data()
            const existing = localGroups.find(lg => (lg.name || '').toLowerCase() === (g.name || '').toLowerCase())
            if (existing) {
              groupNameToId[g.name] = existing.id
            } else {
              const created = await window.electron.playlists.createGroup(localPl.id, g.name)
              if (created?.id) groupNameToId[g.name] = created.id
            }
          }

          // Apply group membership to local playlist tracks
          const freshPlTracks = await window.electron.playlists.getTracks(localPl.id)
          for (const ptDoc of ptSnap.docs) {
            const pt = ptDoc.data()
            if (!pt.group_name || !(pt.group_name in groupNameToId)) continue
            const groupId  = groupNameToId[pt.group_name]
            const localMatch = findTrackMatch(freshPlTracks, pt)
            if (localMatch && !localMatch.group_id) {
              await window.electron.playlists.setTrackGroup(localPl.id, localMatch.id, groupId, pt.group_position ?? 0)
            }
          }
        }
      }

      setSyncStatus(s => ({ ...s, downloading: false, lastSync: Date.now() }))
    } catch (e) {
      console.error('[Sync] Download failed:', e)
      setSyncStatus(s => ({ ...s, downloading: false, error: e.message }))
    }
  }, [user])

  const value = {
    user,
    accountProfile,
    syncStatus,
    login,
    register,
    logout,
    loginWithGoogle,
    sendPasswordReset,
    updateAccountProfile,
    syncToCloud,
    syncFromCloud,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

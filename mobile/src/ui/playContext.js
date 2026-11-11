// "Where is this playing from" (Spotify's "TOCANDO DA PLAYLIST …") and the recently played list
// shown on Início. Tiny external store, persisted in the phone's settings.
import { useSyncExternalStore } from 'react'

const MAX_RECENT = 12
let state = { current: null, recent: [] }   // context: { type: 'playlist'|'all'|'artist', id, name }
const subs = new Set()
const emit = () => subs.forEach(fn => fn())

export async function loadRecent() {
  const saved = await window.electron.settings.get('mobileRecent')
  state = { ...state, recent: Array.isArray(saved) ? saved : [] }
  emit()
}

const sameContext = (a, b) => a && b && a.type === b.type && (a.id || a.name) === (b.id || b.name)

export function setPlayContext(ctx) {
  const recent = [{ ...ctx, at: Date.now() }, ...state.recent.filter(r => !sameContext(r, ctx))].slice(0, MAX_RECENT)
  state = { current: ctx, recent }
  window.electron.settings.set('mobileRecent', recent).catch(() => {})
  emit()
}

export function forgetContext(match) {
  state = { ...state, recent: state.recent.filter(r => !sameContext(r, match)) }
  window.electron.settings.set('mobileRecent', state.recent).catch(() => {})
  emit()
}

const subscribe = fn => { subs.add(fn); return () => subs.delete(fn) }
export const usePlayContext = () => useSyncExternalStore(subscribe, () => state)

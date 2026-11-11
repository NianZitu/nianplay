// Stand-in for the <audio> element that plays through the native iOS player (AVPlayer, plugin
// mobile/plugins/nian-native-player). PlayerContext uses it like an HTMLAudioElement
// (src/currentTime/duration/paused/play()/pause()/events), plus three optional hooks it checks for:
//   setTrack(track)         open a track (with title/artist/cover for the lock screen, cuts, gain)
//   setGain(track)          per-track LUFS gain × "Volume do NianPlay" → AVPlayer volume
//   setUpcoming(items)      the songs that come next — the native side advances through them by itself
//                           while the app is in the background (iOS freezes the WebView's JavaScript)
// It dispatches 'nativeadvance' { track } when the native side moved to another song on its own
// (song ended in the background, next/previous on the lock screen).

import { NianNativePlayer } from 'nian-native-player'
import { fileUri, mediaUrl, isNative } from './paths'

// Songs sent ahead to the native queue (~5 h of music for when the app stays in the background)
const UPCOMING_LIMIT = 80

function linearGain(track) {
  const output = Number(window.nianplayPlatform?.outputGain ?? 0.5)
  // "Equalização de volume" off → no LUFS gain, only the app volume
  const lufs = window.nianplayPlatform?.lufs === false ? 1 : Math.pow(10, ((track?.gain) || 0) / 20)
  const value = lufs * (Number.isFinite(output) ? output : 1)
  return Math.max(0, Math.min(1, value))   // AVPlayer cannot amplify
}

function itemFor(track) {
  // iOS: a file:// URL for AVPlayer. Browser test (web.js): the blob URL of the imported file.
  const toUrl = p => (p ? (isNative() ? fileUri(p) : mediaUrl(p)) : '')
  const url = toUrl(track?.file_path)
  if (!url || (isNative() && !/^file:/i.test(url))) return null   // e.g. a desktop path synced from another device
  const art = toUrl(track.cover_path)
  const cuts = (Array.isArray(track.cut_segments) ? track.cut_segments : [])
    .map(seg => ({ start: Number(seg.start) || 0, end: Number(seg.end) || 0 }))
    .filter(seg => seg.end > seg.start)
  return {
    url,
    title: track.title || '',
    artist: track.artist || '',
    album: track.album || '',
    artwork: art || undefined,
    volume: linearGain(track),
    cuts,
  }
}

export class NativeAudio extends EventTarget {
  constructor() {
    super()
    this.crossOrigin = null
    this.volume = 1            // ignored: the native volume comes from setGain()
    this._url = ''
    this._track = null
    this._time = 0
    this._duration = NaN
    this._paused = true
    this._ended = false
    this._ready = false
    this._pendingSeek = null
    this._known = new Map()    // native url → track object (current, upcoming, recent)
    if (import.meta.env.DEV) window.__nianAudio = this

    NianNativePlayer.addListener('time', e => {
      if (e.url !== this._url) return
      this._time = Number(e.currentTime) || 0
      if (e.duration) this._duration = Number(e.duration)
      this._emit('timeupdate')
    })
    NianNativePlayer.addListener('ready', e => {
      if (e.url !== this._url) return
      this._ready = true
      if (e.duration) this._duration = Number(e.duration)
      if (this._pendingSeek != null) {
        const t = this._pendingSeek
        this._pendingSeek = null
        this.currentTime = t
      }
      this._emit('loadedmetadata')
    })
    NianNativePlayer.addListener('state', e => {
      const paused = !e.playing
      if (paused === this._paused) return
      this._paused = paused
      if (!paused) this._ended = false
      this._emit(paused ? 'pause' : 'play')
    })
    NianNativePlayer.addListener('advanced', e => {
      const track = this._known.get(e.url) || null
      this._adopt(e.url, track)
      this._paused = false
      this.dispatchEvent(Object.assign(new Event('nativeadvance'), { track, url: e.url }))
    })
    NianNativePlayer.addListener('queueEnded', e => {
      if (e.url !== this._url) return
      this._ended = true
      this._paused = true
      this._emit('ended')
    })
    NianNativePlayer.addListener('error', e => {
      if (e.url !== this._url) return
      console.warn('[NianNativePlayer]', e.message)
      this._emit('error')
    })
  }

  _emit(type) { this.dispatchEvent(new Event(type)) }

  _adopt(url, track) {
    this._url = url
    this._track = track
    this._time = 0
    this._duration = Number(track?.duration) || NaN
    this._ended = false
    this._ready = false
    this._pendingSeek = null
  }

  _remember(url, track) {
    this._known.set(url, track)
    if (this._known.size > 400) this._known.delete(this._known.keys().next().value)
  }

  // ── PlayerContext hooks ──
  setTrack(track) {
    const item = itemFor(track)
    this._adopt(item?.url || '', track)
    this._paused = true
    if (!item) {
      setTimeout(() => this._emit('error'), 0)
      return
    }
    this._remember(item.url, track)
    NianNativePlayer.open({ ...item, autoplay: false }).catch(err => console.warn('[NianNativePlayer] open', err))
  }

  setGain(track) {
    if (!track || track !== this._track) {
      if (track?.id && this._track?.id === track.id) this._track = track
      else return
    }
    NianNativePlayer.setVolume({ volume: linearGain(track) }).catch(() => {})
  }

  setUpcoming(tracks) {
    const items = []
    for (const track of tracks) {
      if (items.length >= UPCOMING_LIMIT) break
      const item = itemFor(track)
      if (!item) continue
      this._remember(item.url, track)
      items.push(item)
    }
    NianNativePlayer.setUpcoming({ items }).catch(() => {})
  }

  // ── HTMLAudioElement surface ──
  get src() { return this._url }
  set src(value) {
    // Only reached if a caller sets src directly — the track data then comes from setTrack()
    if (!value) return
    this._adopt(value, null)
    NianNativePlayer.open({ url: value, autoplay: false }).catch(() => {})
  }

  get currentTime() { return this._time }
  set currentTime(value) {
    const t = Math.max(0, Number(value) || 0)
    this._time = t
    if (!this._ready) { this._pendingSeek = t; return }
    NianNativePlayer.seek({ time: t }).catch(() => {})
  }

  get duration() { return this._duration }
  get paused() { return this._paused }
  get ended() { return this._ended }

  play() {
    if (!this._url) return Promise.reject(new Error('no source'))
    this._paused = false
    this._ended = false
    this._emit('play')
    return NianNativePlayer.play()
  }

  pause() {
    if (!this._paused) {
      this._paused = true
      this._emit('pause')
    }
    NianNativePlayer.pause().catch(() => {})
  }

  // Native state after the WebView comes back from the background (time events stop there)
  async refresh() {
    try {
      const s = await NianNativePlayer.getState()
      if (s.url && s.url === this._url) {
        this._time = Number(s.currentTime) || 0
        if (s.duration) this._duration = Number(s.duration)
        const paused = !s.playing
        if (paused !== this._paused) { this._paused = paused; this._emit(paused ? 'pause' : 'play') }
        this._emit('timeupdate')
      }
    } catch {}
  }
}

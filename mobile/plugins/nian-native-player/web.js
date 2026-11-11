// Browser stand-in for the iOS plugin — for testing the app's native-player path without an iPhone
// (enable with localStorage.nianNativeWeb = '1' in the dev server). Mirrors the Swift behavior:
// it owns the upcoming queue, advances by itself, skips cuts, and sends the same events.
import { WebPlugin } from '@capacitor/core'

export class NianNativePlayerWeb extends WebPlugin {
  constructor() {
    super()
    this.audio = new Audio()
    this.current = null
    this.upcoming = []
    this.history = []
    this.pendingStart = 0
    const a = this.audio
    a.addEventListener('timeupdate', () => {
      const now = this.current
      if (!now) return
      const cut = (now.cuts || []).find(c => a.currentTime >= c.start && a.currentTime < c.end)
      if (cut) { a.currentTime = Math.min(cut.end + 0.05, a.duration || cut.end + 0.05); return }
      this.notifyListeners('time', { url: now.url, currentTime: a.currentTime, duration: a.duration || 0 })
    })
    a.addEventListener('loadedmetadata', () => {
      if (this.pendingStart) { a.currentTime = this.pendingStart; this.pendingStart = 0 }
      this.notifyListeners('ready', { url: this.current?.url, duration: a.duration || 0 })
    })
    a.addEventListener('play', () => this.notifyListeners('state', { playing: true }))
    a.addEventListener('pause', () => this.notifyListeners('state', { playing: false }))
    a.addEventListener('ended', () => this.advance())
    a.addEventListener('error', () => this.notifyListeners('error', { url: this.current?.url, message: 'load failed' }))
    window.__nianNative = this   // tests: __nianNative.advance() simulates the lock-screen "next"
  }

  start(item, startAt = 0, autoplay = true) {
    this.current = item
    this.pendingStart = startAt
    this.audio.src = item.url
    this.audio.volume = Math.min(1, Math.max(0, item.volume ?? 1))
    if (autoplay) this.audio.play().catch(() => {})
  }

  advance() {
    const next = this.upcoming.shift()
    if (!next) {
      this.audio.pause()
      this.notifyListeners('queueEnded', { url: this.current?.url || '' })
      return
    }
    if (this.current) this.history.push(this.current)
    this.start(next)
    this.notifyListeners('advanced', { url: next.url })
  }

  async open(opts) {
    if (this.current && this.current.url !== opts.url) this.history.push(this.current)
    this.start(opts, opts.startAt || 0, opts.autoplay !== false)
  }
  async setUpcoming({ items }) { this.upcoming = [...(items || [])] }
  async play() { await this.audio.play().catch(() => {}) }
  async pause() { this.audio.pause() }
  async seek({ time }) { this.audio.currentTime = time }
  async setVolume({ volume }) { this.audio.volume = Math.min(1, Math.max(0, volume)) }
  async getState() {
    return { url: this.current?.url || '', currentTime: this.audio.currentTime, duration: this.audio.duration || 0, playing: !this.audio.paused }
  }
}

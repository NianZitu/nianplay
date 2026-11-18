// Browser stand-in for the Android plugin — only to try the download screens in the dev server.
// Search returns sample results; a download fakes progress (no file is produced).
import { WebPlugin } from '@capacitor/core'

export class NianYoutubeWeb extends WebPlugin {
  constructor() {
    super()
    this.timers = new Map()
  }
  async status() { return { ready: true, version: 'web-teste', error: null } }
  async update() { return { status: 'ALREADY_UP_TO_DATE', version: 'web-teste' } }
  async search({ query, limit = 8 }) {
    await new Promise(r => setTimeout(r, 900))
    const ids = ['dQw4w9WgXcQ', 'kJQP7kiw5Fk', '9bZkp7q19f0', 'fJ9rUzIMcZQ', 'OPf0YbXqDm0', 'JGwWNGJdvx8', 'hT_nvWreIhg', 'YQHsXMglC9A']
    const out = ids.slice(0, limit).map((id, i) => JSON.stringify({
      id, url: `https://www.youtube.com/watch?v=${id}`,
      title: `${query} — resultado ${i + 1}${i === 2 ? ' (versão estendida com um título bem comprido)' : ''}`,
      duration: 150 + i * 37, channel: i % 2 ? 'Canal de Teste - Topic' : 'Outro Canal',
    })).join('\n')
    return { out }
  }
  async download({ id, url }) {
    let p = 0
    const fail = /fail/.test(url)
    this.notifyListeners('progress', { id, percent: 0, title: `Música de teste (${url.slice(-11)})` })
    const t = setInterval(() => {
      p += 12
      if (fail && p > 40) {
        clearInterval(t); this.timers.delete(id)
        this.notifyListeners('done', { id, ok: false, cancelled: false, error: '[youtube] Video unavailable' })
        return
      }
      if (p >= 100) {
        clearInterval(t); this.timers.delete(id)
        this.notifyListeners('done', { id, ok: true, cancelled: false, error: null })
        return
      }
      this.notifyListeners('progress', { id, percent: p, eta: Math.round((100 - p) / 12) })
    }, 450)
    this.timers.set(id, t)
  }
  async cancel({ id }) {
    clearInterval(this.timers.get(id)); this.timers.delete(id)
    this.notifyListeners('done', { id, ok: false, cancelled: true, error: null })
  }
}

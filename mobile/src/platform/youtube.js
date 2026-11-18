// YouTube on Android: search and audio downloads with yt-dlp running on the phone (plugin
// mobile/plugins/nian-youtube). Same flow as the desktop's DownloadsPage + downloader.js:
//   • a download is a job (one link — a song or a whole playlist) with progress, cancel and errors;
//   • every finished song goes into the library (media.importDownloaded): onto the track it was
//     downloaded for, or the cloud track with the same link, or a title/artist match, or a new track
//     — always keeping the link in yt_url.
// iOS has no plugin: youtubeAvailable() is false there and the UI hides all of this.

import { Capacitor } from '@capacitor/core'
import { NianYoutube } from 'nian-youtube'
import { storedFromAbsolute } from './paths'
import { importDownloaded } from './media'
import { canonicalUrl, urlKey, isPlaylistUrl } from '../../../src/renderer/utils/mediaUrl'

export const youtubeAvailable = () => Capacitor.isPluginAvailable('NianYoutube')
// Whole YouTube playlists: yt-dlp (Android) only
export const playlistDownloads = () => Capacitor.getPlatform() !== 'ios'
export { isPlaylistUrl }

const YT_URL = /^(https?:\/\/)?((www|m|music)\.)?(youtube\.com|youtu\.be)\//i
export const isYoutubeUrl = s => YT_URL.test((s || '').trim())

// ── jobs store ───────────────────────────────────────────────────────────────
// job: { id, url, title, playlist, trackId, status: queued|downloading|done|error|cancelled,
//        percent, eta, error, files: [{ title, result }], createdAt }
let jobs = []
const subscribers = new Set()
const eventSubscribers = new Set()

const publish = () => { jobs = [...jobs]; subscribers.forEach(fn => fn(jobs)) }
const emitEvent = ev => eventSubscribers.forEach(fn => fn(ev))
const patch = (id, fields) => {
  const i = jobs.findIndex(j => j.id === id)
  if (i === -1) return null
  jobs[i] = { ...jobs[i], ...fields }
  publish()
  return jobs[i]
}

export const getJobs = () => jobs
export function subscribeJobs(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }
// { type: 'file', job, title } when a song is ready · { type: 'done' | 'error', job }
export function subscribeEvents(fn) { eventSubscribers.add(fn); return () => eventSubscribers.delete(fn) }
export const activeCount = list => list.filter(j => j.status === 'queued' || j.status === 'downloading').length

// ── plugin events ────────────────────────────────────────────────────────────
let listening = null
function listen() {
  if (listening) return listening
  listening = Promise.all([
    NianYoutube.addListener('progress', e => {
      const job = jobs.find(j => j.id === e.id)
      if (!job || job.status === 'cancelled') return
      patch(e.id, {
        status: 'downloading',
        ...(typeof e.percent === 'number' && e.percent >= 0 ? { percent: e.percent } : {}),
        ...(typeof e.eta === 'number' ? { eta: e.eta } : {}),
        ...(e.title ? { title: e.title, percent: 0 } : {}),
      })
    }),
    NianYoutube.addListener('file', async e => {
      const job = jobs.find(j => j.id === e.id)
      const filePath = storedFromAbsolute(e.path)
      if (!job || !filePath) return
      try {
        // Only the first file of a single-song job goes onto the track it was requested for
        const forTrack = job.trackId && !job.playlist && job.files.length === 0 ? job.trackId : null
        const meta = e.title || e.artist || e.cover ? { title: e.title, artist: e.artist, coverPath: e.cover } : null
        const { result, track } = await importDownloaded({ filePath, url: e.url, trackId: forTrack, meta })
        const title = track?.title || filePath.replace(/^.*\//, '').replace(/\.[^.]+$/, '')
        const fresh = jobs.find(j => j.id === e.id)
        patch(e.id, { files: [...(fresh?.files || []), { title, result }] })
        emitEvent({ type: 'file', job: fresh, title })
      } catch (err) {
        console.error('[youtube] import', err)
      }
    }),
    NianYoutube.addListener('done', e => {
      const job = jobs.find(j => j.id === e.id)
      if (!job) return
      const status = e.cancelled ? 'cancelled' : e.ok ? 'done' : 'error'
      const updated = patch(e.id, { status, percent: e.ok ? 100 : job.percent, error: e.ok ? null : (e.error || null) })
      if (status === 'done' || status === 'error') emitEvent({ type: status, job: updated })
    }),
  ])
  return listening
}

// ── API ──────────────────────────────────────────────────────────────────────
const newId = () => `dl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

// title/artist: what the app already knows about the song (the iPhone plugin uses them as tags)
export async function startDownload({ url, title = '', artist = '', trackId = null, playlist = null }) {
  const raw = (url || '').trim()
  if (!raw) throw new Error('Link vazio')
  // A whole playlist keeps its list= link (canonicalUrl would reduce it to the single video)
  const wholeList = playlist ?? (isPlaylistUrl(raw) && !/[?&]v=/.test(raw))
  const link = wholeList ? raw : canonicalUrl(raw)
  await listen()
  // The same song already queued or downloading
  const key = urlKey(link)
  const running = jobs.find(j => (j.status === 'queued' || j.status === 'downloading') && urlKey(j.url) === key)
  if (running) return running
  const job = {
    id: newId(), url: link, title, artist, trackId,
    playlist: wholeList,
    status: 'queued', percent: 0, eta: null, error: null, files: [], createdAt: Date.now(),
  }
  jobs = [job, ...jobs]
  publish()
  try {
    await NianYoutube.download({ id: job.id, url: job.url, playlist: job.playlist, title, artist })
  } catch (err) {
    patch(job.id, { status: 'error', error: err?.message || String(err) })
  }
  return job
}

export async function cancelDownload(id) {
  patch(id, { status: 'cancelled' })
  try { await NianYoutube.cancel({ id }) } catch {}
}

export function retryDownload(id) {
  const job = jobs.find(j => j.id === id)
  if (!job) return
  jobs = jobs.filter(j => j.id !== id)
  publish()
  return startDownload({ url: job.url, title: job.title, artist: job.artist, trackId: job.trackId, playlist: job.playlist })
}

export function clearFinished() {
  jobs = jobs.filter(j => j.status === 'queued' || j.status === 'downloading')
  publish()
}

// Same fields as the desktop's ytSearch:search
export async function searchYoutube(query, limit = 20) {
  const { out } = await NianYoutube.search({ query, limit })
  return (out || '').split('\n').map(line => {
    try { return JSON.parse(line) } catch { return null }
  }).filter(Boolean).map(item => ({
    id: item.id,
    url: canonicalUrl(item.url && /^https?:/.test(item.url) ? item.url : `https://www.youtube.com/watch?v=${item.id}`),
    title: item.title || '',
    duration: item.duration || 0,
    channel: (item.channel || item.uploader || '').replace(/\s+-\s+Topic$/i, ''),
    thumbnail: item.id ? `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg` : (item.thumbnails?.[0]?.url || ''),
  }))
}

export async function ytdlpStatus() {
  try { return await NianYoutube.status() } catch (err) { return { ready: false, error: err?.message } }
}

export async function updateYtdlp() {
  return NianYoutube.update()
}

// One player per Discord server: voice connection, queue, history, loop, volume, seek.
//
// The queue is a single array; `index` points at the current track, items before it are the
// history (used by /previous and by loop "fila"). Items that only have a search query (Spotify,
// NianPlay tracks without link) are looked up on YouTube right before they play.
const {
  joinVoiceChannel, createAudioPlayer, createAudioResource, entersState,
  AudioPlayerStatus, VoiceConnectionStatus, StreamType, NoSubscriberBehavior,
} = require('@discordjs/voice')
const config = require('../config')
const ytdlp = require('../sources/ytdlp')
const { findOnYoutube } = require('../sources/resolve')
const { createPcmStream, normalizeCuts, playableDuration, playableToAudio } = require('./stream')
const { shuffleArray, groupedShuffle, hasGroups } = require('../queue/grouping')

const STREAM_URL_TTL = 3 * 60 * 60 * 1000   // YouTube audio URLs expire after ~6h
const MAX_CONSECUTIVE_FAILURES = 3

class GuildPlayer {
  constructor(guild, { onEvent }) {
    this.guild = guild
    this.onEvent = onEvent            // (type, payload) → UI messages (see index.js)
    this.queue = []
    this.index = -1
    this.loop = 'off'                 // 'off' | 'track' | 'queue'
    this.volume = config.defaultVolume
    this.connection = null
    this.textChannel = null
    this.resource = null
    this.ffmpeg = null
    this.seekOffset = 0               // playable seconds before the current resource started
    this.failures = 0
    this.loading = false
    this.idleTimer = null
    this.aloneTimer = null

    this.player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } })
    this.player.on(AudioPlayerStatus.Idle, (old) => {
      if (old.status === AudioPlayerStatus.Idle) return
      // Only a track that really ended advances the queue. When a resource is replaced (seek,
      // skip, /stop) the one that went idle is no longer this.resource.
      if (!old.resource || old.resource !== this.resource) return
      this._advance()
    })
    this.player.on('error', err => {
      console.error(`[${guild.name}] Erro de áudio:`, err.message)
      this.onEvent('error', { message: `Erro ao tocar **${this.current?.title || 'faixa'}**: ${err.message}` })
    })
  }

  // Changing the loop mode can change which track comes next
  get loop() { return this._loop }
  set loop(mode) {
    this._loop = mode
    if (this.queue) this.prefetchNext()
  }

  get current() { return this.queue[this.index] || null }
  get upcoming() { return this.queue.slice(this.index + 1) }
  get isPlaying() { return this.player.state.status === AudioPlayerStatus.Playing }
  get isPaused() { return this.player.state.status === AudioPlayerStatus.Paused || this.player.state.status === AudioPlayerStatus.AutoPaused }
  // Loading, buffering, playing or paused — anything but stopped
  get isActive() { return this.loading || this.player.state.status !== AudioPlayerStatus.Idle }

  // Seconds played in the current track (playable timeline: NianPlay cuts are not counted)
  get elapsed() {
    return this.seekOffset + (this.resource ? this.resource.playbackDuration / 1000 : 0)
  }

  // ── Voice connection ──────────────────────────────────────────────────────
  async connect(voiceChannel, textChannel) {
    if (textChannel) this.textChannel = textChannel
    if (this.connection && this.connection.joinConfig.channelId === voiceChannel.id &&
        this.connection.state.status !== VoiceConnectionStatus.Destroyed) return
    this.connection?.destroy()
    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
    })
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        // Moved to another channel or brief network drop → reconnects by itself
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5000),
        ])
      } catch {
        this.destroy('Desconectado do canal de voz.')
      }
    })
    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 20000)
    } catch {
      this.connection?.destroy()
      this.connection = null
      throw new Error('Não consegui entrar no canal de voz (verifique as permissões Conectar e Falar).')
    }
    this.connection.subscribe(this.player)
  }

  // ── Queue ─────────────────────────────────────────────────────────────────
  // Adds items; starts playing if idle. `next` = right after the current track.
  async enqueue(items, { next = false, requestedBy = '' } = {}) {
    const room = Math.max(0, config.maxQueue - this.upcoming.length)
    const toAdd = items.slice(0, room).map(it => ({ ...it, requestedBy }))
    if (!toAdd.length) return { added: 0, truncated: items.length }
    // Where the new items begin — decided BEFORE inserting: after the queue ended `index` points
    // just past the end, and the first new item lands exactly there.
    const hasCurrent = Boolean(this.current)
    const startAt = hasCurrent ? this.index + 1 : this.queue.length
    if (next && hasCurrent) this.queue.splice(this.index + 1, 0, ...toAdd)
    else this.queue.push(...toAdd)
    const truncated = items.length - toAdd.length
    // Start only when nothing is going on. (Checking "not playing" would also be true while a
    // track is still buffering — adding a song at that moment used to skip the current one.)
    if (!this.isActive) {
      // Something current but stopped (e.g. after 3 failures): continue with the next track
      await this.playIndex(startAt)
    } else {
      this.prefetchNext()          // e.g. /playnext changed what comes next
    }
    return { added: toAdd.length, truncated }
  }

  async playIndex(i, { seek = 0 } = {}) {
    if (i < 0 || i >= this.queue.length) return this._finish()
    clearTimeout(this.idleTimer)
    this.index = i
    const item = this.queue[i]
    this.loading = true
    try {
      await this._ensurePlayable(item)
      await this._startStream(item, seek)
      this.failures = 0
      if (!seek) this.onEvent('nowPlaying', { item })
      this.prefetchNext()
    } catch (err) {
      this.failures++
      console.warn(`[${this.guild.name}] Falha em "${item.title}":`, err.message)
      this.onEvent('error', { message: `Não consegui tocar **${item.title}**: ${err.message}` })
      if (this.failures >= MAX_CONSECUTIVE_FAILURES) {
        this.failures = 0
        this.onEvent('error', { message: `${MAX_CONSECUTIVE_FAILURES} faixas seguidas falharam — reprodução parada. Use /play ou /skip para continuar.` })
        this.loading = false
        this.player.stop(true)
        return
      }
      this.loading = false
      return this._advance({ fromError: true })
    } finally {
      this.loading = false
    }
  }

  // Search query → YouTube video; video → direct audio URL (both cached on the item).
  // Each yt-dlp call takes seconds, so the next track is prepared while the current one plays
  // (prefetchNext); a lookup already running for an item is shared instead of started again.
  _isReady(item) {
    return Boolean(item.streamUrl) && Date.now() - (item.streamUrlAt || 0) < STREAM_URL_TTL
  }

  _ensurePlayable(item) {
    if (this._isReady(item)) return Promise.resolve()
    if (!item._pending) {
      item._pending = this._resolvePlayable(item).finally(() => { item._pending = null })
    }
    return item._pending
  }

  async _resolvePlayable(item) {
    if (!item.url) {
      const found = await findOnYoutube(item)
      item.url = found.url
      item.resolvedTitle = found.title
      if (!item.duration) item.duration = found.duration
    }
    if (!this._isReady(item)) {
      item.streamUrl = await ytdlp.streamUrl(item.url)
      item.streamUrlAt = Date.now()
    }
  }

  // Index of the track that plays after the current one (-1 = none), following the loop mode
  _nextIndex() {
    if (!this.current) return -1
    if (this.loop === 'track') return this.index
    if (this.index + 1 < this.queue.length) return this.index + 1
    if (this.loop === 'queue' && this.queue.length) return 0
    return -1
  }

  // Prepares the next track in the background. Errors are ignored here: the real attempt retries
  // and reports them.
  prefetchNext() {
    const item = this.queue[this._nextIndex()]
    if (!item || item === this.current || this._isReady(item) || item._pending) return
    this._ensurePlayable(item).catch(err => {
      console.warn(`[${this.guild.name}] Pré-carregamento de "${item.title}" falhou:`, err.message)
    })
  }

  async _startStream(item, seek) {
    const useCuts = item.source === 'nianplay' && config.applyNianplayCuts
    const cuts = useCuts ? normalizeCuts(item.cuts, item.duration) : []
    const gain = item.source === 'nianplay' && config.applyNianplayGain ? (Number(item.gain) || 0) : 0
    item.playableDuration = cuts.length ? playableDuration(item.duration, cuts) : item.duration
    const audioStart = cuts.length ? playableToAudio(seek, cuts) : seek

    this._killFfmpeg()
    const { process: proc, stream } = createPcmStream(item.streamUrl, { audioStart, gain, cuts })
    this.ffmpeg = proc
    // An expired/blocked audio URL fails right away: drop it so the next try gets a fresh one
    proc.once('close', code => { if (code && code !== 255 && this.resource?.playbackDuration < 2000) item.streamUrl = null })

    const resource = createAudioResource(stream, { inputType: StreamType.Raw, inlineVolume: true, metadata: item })
    resource.volume.setVolume(this.volume / 100)
    this.resource = resource
    this.seekOffset = seek
    this.player.play(resource)
    await entersState(this.player, AudioPlayerStatus.Playing, 15000).catch(() => {
      throw new Error(proc.lastError() || proc.spawnError?.message || 'o áudio não começou a tocar')
    })
  }

  _advance({ fromError = false } = {}) {
    if (!this.current) return this._finish()
    if (this.loop === 'track' && !fromError) return this.playIndex(this.index)
    if (this.index + 1 < this.queue.length) return this.playIndex(this.index + 1)
    if (this.loop === 'queue' && this.queue.length) return this.playIndex(0)
    this.index = this.queue.length          // past the end: history kept, nothing current
    return this._finish()
  }

  _finish() {
    this._killFfmpeg()
    this.resource = null
    this.onEvent('queueEnd', {})
    clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => this.destroy('Fila terminou — saindo do canal.'), config.idleLeaveSeconds * 1000)
  }

  // ── Controls ──────────────────────────────────────────────────────────────
  pause()  { return this.player.pause() }
  resume() { return this.player.unpause() }

  async skip(count = 1) {
    if (!this.current) return false
    if (this.loop === 'track') this.loop = 'off'
    const target = this.index + count
    if (target >= this.queue.length && this.loop !== 'queue') {
      this.player.stop(true)       // Idle → _advance → end of queue
      this.index = this.queue.length - 1
      return true
    }
    await this.playIndex(target >= this.queue.length ? 0 : target)
    return true
  }

  async previous() {
    if (this.index <= 0) return false
    await this.playIndex(this.index - 1)
    return true
  }

  async seek(seconds) {
    const item = this.current
    if (!item || !item.streamUrl) return false
    const max = item.playableDuration || item.duration || 0
    const target = Math.max(0, max ? Math.min(seconds, max - 1) : seconds)
    await this._startStream(item, target)
    return target
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(200, Math.round(v)))
    this.resource?.volume?.setVolume(this.volume / 100)
    return this.volume
  }

  // Normal: shuffles everything after the current track.
  // Group mode (the queue has NianPlay groups): only the order of the groups is shuffled and the
  // loose tracks are spread between them — like the app. The rest of the group that is playing
  // right now stays next, so a group is never cut in half.
  shuffle() {
    const upcoming = this.upcoming
    if (upcoming.length < 2) return { mode: 'none', count: upcoming.length }
    const cur = this.current
    let next
    let mode = 'normal'
    if (hasGroups(upcoming) || cur?.group) {
      mode = 'groups'
      const sameGroup = cur?.group ? upcoming.filter(it => it.group?.key === cur.group.key) : []
      const rest = upcoming.filter(it => !sameGroup.includes(it))
      next = [...sameGroup, ...groupedShuffle(rest)]
    } else {
      next = shuffleArray(upcoming)
    }
    this.queue = [...this.queue.slice(0, this.index + 1), ...next]
    this.prefetchNext()
    return { mode, count: next.length }
  }

  // Positions are 1-based among the upcoming tracks (as shown by /queue)
  remove(pos) {
    const i = this.index + pos
    if (pos < 1 || i >= this.queue.length) return null
    const [it] = this.queue.splice(i, 1)
    this.prefetchNext()
    return it
  }

  move(from, to) {
    const a = this.index + from, b = this.index + to
    if (from < 1 || to < 1 || a >= this.queue.length || b >= this.queue.length) return null
    const [it] = this.queue.splice(a, 1)
    this.queue.splice(b, 0, it)
    this.prefetchNext()
    return it
  }

  async skipTo(pos) {
    const i = this.index + pos
    if (pos < 1 || i >= this.queue.length) return null
    await this.playIndex(i)
    return this.current
  }

  clearUpcoming() {
    const n = this.upcoming.length
    this.queue = this.queue.slice(0, this.index + 1)
    return n
  }

  stop() {
    this.queue = []
    this.index = -1
    this.loop = 'off'
    this.resource = null          // before stop(): the Idle that follows must not advance
    this.player.stop(true)
    this._killFfmpeg()
  }

  // ── Presence in the voice channel ─────────────────────────────────────────
  checkAlone(channel) {
    const humans = channel?.members?.filter(m => !m.user.bot).size ?? 0
    clearTimeout(this.aloneTimer)
    if (humans === 0) {
      this.aloneTimer = setTimeout(() => this.destroy('Fiquei sozinho no canal — saindo.'), config.aloneLeaveSeconds * 1000)
    }
  }

  _killFfmpeg() {
    if (this.ffmpeg && this.ffmpeg.exitCode === null) {
      try { this.ffmpeg.kill('SIGKILL') } catch {}
    }
    this.ffmpeg = null
  }

  destroy(reason = '') {
    clearTimeout(this.idleTimer)
    clearTimeout(this.aloneTimer)
    this.stop()
    try { this.connection?.destroy() } catch {}
    this.connection = null
    if (reason) this.onEvent('left', { reason })
    this.onEvent('destroyed', {})
  }
}

module.exports = { GuildPlayer }

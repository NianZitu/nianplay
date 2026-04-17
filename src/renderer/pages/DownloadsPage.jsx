import React, { useState, useEffect, useRef } from 'react'
import {
  Download, X, FolderOpen, Music, Video,
  Loader2, CheckCircle2, AlertCircle, Ban,
  AlertTriangle, CheckCircle, Search, Play,
  ListMusic,
} from 'lucide-react'

const STATUS_ICON = {
  queued:      <Loader2 size={14} className="animate-spin text-white/40" />,
  downloading: <Loader2 size={14} className="animate-spin text-brand-400" />,
  done:        <CheckCircle2 size={14} className="text-green-400" />,
  error:       <AlertCircle size={14} className="text-red-400" />,
  cancelled:   <Ban size={14} className="text-white/30" />,
}

function formatDuration(secs) {
  if (!secs) return ''
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ── Tab: URL download ──────────────────────────────────────────────────────────
function UrlTab({ ytdlpReady, sharedOutputDir, onOutputDirChange }) {
  const [url,      setUrl]      = useState('')
  const [format,   setFormat]   = useState('audio')
  const [audioFmt, setAudioFmt] = useState('mp3')
  const [quality,  setQuality]  = useState('1080p')
  const [error,    setError]    = useState('')

  const isElectron = !!window.electron

  async function handleChooseDir() {
    if (!isElectron) return
    const dir = await window.electron.dialog.openFolder()
    if (dir) {
      onOutputDirChange(dir)
      window.electron.settings.set('downloadPath', dir)
    }
  }

  async function handleDownload() {
    if (!url.trim()) return
    setError('')
    const result = await window.electron.downloader.start({
      url: url.trim(), format, audioFormat: audioFmt, quality,
      outputDir: sharedOutputDir || undefined,
    })
    if (result?.error) { setError(result.error); return }
    setUrl('')
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-300">
          <AlertTriangle size={15} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="url"
          placeholder="Cole um link do YouTube ou playlist..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleDownload()}
          className="input-base flex-1 text-sm"
        />
        <button
          onClick={handleDownload}
          disabled={!url.trim() || ytdlpReady === false}
          className="btn-primary flex items-center gap-2 whitespace-nowrap"
        >
          {ytdlpReady === false
            ? <><Loader2 size={14} className="animate-spin" /> Aguardando...</>
            : <><Download size={14} /> Baixar</>
          }
        </button>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Formato</label>
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {[{ val: 'audio', label: 'Áudio', icon: Music }, { val: 'video', label: 'Vídeo', icon: Video }].map(({ val, label, icon: Icon }) => (
              <button key={val} onClick={() => setFormat(val)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm transition-colors
                  ${format === val ? 'bg-brand-600 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>

        {format === 'audio' && (
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Codec</label>
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              {['mp3', 'flac'].map(f => (
                <button key={f} onClick={() => setAudioFmt(f)}
                  className={`px-4 py-2 text-sm uppercase transition-colors
                    ${audioFmt === f ? 'bg-brand-600 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        {format === 'video' && (
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Qualidade</label>
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              {['4K', '1080p', '720p', '480p', '360p'].map(q => (
                <button key={q} onClick={() => setQuality(q)}
                  className={`px-3 py-2 text-sm transition-colors
                    ${quality === q ? 'bg-brand-600 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1">
          <label className="text-xs text-white/40 mb-1.5 block">Pasta de destino</label>
          <div className="flex gap-2">
            <input type="text" readOnly placeholder="Padrão: Downloads do sistema"
              value={sharedOutputDir} onClick={handleChooseDir}
              className="input-base flex-1 text-sm cursor-pointer" />
            <button onClick={handleChooseDir} className="btn-ghost p-2">
              <FolderOpen size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tab: YouTube Search ────────────────────────────────────────────────────────
function YtSearchTab({ ytdlpReady, outputDir }) {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [format,   setFormat]   = useState('audio')
  const [audioFmt, setAudioFmt] = useState('mp3')

  async function handleSearch() {
    if (!query.trim() || !window.electron) return
    setLoading(true)
    setError('')
    const res = await window.electron.ytSearch.search(query.trim())
    setLoading(false)
    if (res.error) { setError(res.error); return }
    setResults(res.results || [])
  }

  async function handleDownload(item) {
    if (!window.electron) return
    await window.electron.downloader.start({
      url: item.url, format, audioFormat: audioFmt,
      outputDir: outputDir || undefined,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Buscar no YouTube..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="input-base flex-1 text-sm"
        />
        <button
          onClick={handleSearch}
          disabled={!query.trim() || loading || ytdlpReady === false}
          className="btn-primary flex items-center gap-2 whitespace-nowrap"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Buscar
        </button>
      </div>

      {/* Format strip */}
      <div className="flex gap-3 items-center">
        <label className="text-xs text-white/40">Baixar como:</label>
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          {[{ val: 'audio', label: 'Áudio' }, { val: 'video', label: 'Vídeo' }].map(({ val, label }) => (
            <button key={val} onClick={() => setFormat(val)}
              className={`px-3 py-1.5 text-xs transition-colors
                ${format === val ? 'bg-brand-600 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
              {label}
            </button>
          ))}
        </div>
        {format === 'audio' && (
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {['mp3', 'flac'].map(f => (
              <button key={f} onClick={() => setAudioFmt(f)}
                className={`px-3 py-1.5 text-xs uppercase transition-colors
                  ${audioFmt === f ? 'bg-brand-600 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-300">{error}</div>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
          {results.map(item => (
            <div key={item.id} className="card p-3 flex items-center gap-3">
              {item.thumbnail && (
                <img src={item.thumbnail} alt="" className="w-16 h-10 object-cover rounded shrink-0" />
              )}
              <div className="flex-1 overflow-hidden">
                <p className="text-sm text-white truncate">{item.title}</p>
                <p className="text-xs text-white/40">{item.channel}{item.duration ? ` · ${formatDuration(item.duration)}` : ''}</p>
              </div>
              <button
                onClick={() => handleDownload(item)}
                disabled={ytdlpReady === false}
                className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5 shrink-0 disabled:opacity-40"
              >
                <Download size={12} /> Baixar
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && query && (
        <p className="text-center text-white/20 text-sm py-6">
          {error ? '' : 'Nenhum resultado. Refine sua busca.'}
        </p>
      )}
    </div>
  )
}

// ── Tab: Spotify ───────────────────────────────────────────────────────────────
function SpotifyTab({ ytdlpReady, outputDir }) {
  const [url,          setUrl]          = useState('')
  const [loading,      setLoading]      = useState(false)
  const [tracks,       setTracks]       = useState([])
  const [error,        setError]        = useState('')
  const [format,       setFormat]       = useState('audio')
  const [audioFmt,     setAudioFmt]     = useState('mp3')
  const [queued,       setQueued]       = useState(new Set())
  const [allDone,      setAllDone]      = useState(false)
  const [fetchLyrics,  setFetchLyrics]  = useState(false)
  const [lyricsStatus, setLyricsStatus] = useState({}) // {trackQuery: 'ok'|'fail'}

  async function handleResolve() {
    if (!url.trim() || !window.electron) return
    setLoading(true)
    setError('')
    setTracks([])
    setAllDone(false)
    const res = await window.electron.spotify.resolve(url.trim())
    setLoading(false)
    if (res.error) { setError(res.error); return }
    setTracks(res.tracks || [])
  }

  // Score a YouTube result against a Spotify track
  function scoreResult(ytResult, spotTrack) {
    function normalize(s) {
      return (s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim()
    }
    function wordSim(a, b) {
      a = normalize(a); b = normalize(b)
      if (!a || !b) return 0
      if (a === b) return 1
      if (a.includes(b) || b.includes(a)) return 0.85
      const aW = new Set(a.split(/\s+/).filter(Boolean))
      const bW = b.split(/\s+/).filter(Boolean)
      if (!aW.size || !bW.length) return 0
      const common = bW.filter(w => aW.has(w)).length
      return common / Math.max(aW.size, bW.length)
    }
    const nameSim   = wordSim(spotTrack.name, ytResult.title)
    const artistSim = spotTrack.artist ? wordSim(spotTrack.artist, ytResult.title) : 0.5

    let durScore = 0.5
    if (spotTrack.duration_ms && ytResult.duration) {
      const diff = Math.abs(spotTrack.duration_ms / 1000 - ytResult.duration)
      durScore = diff < 5 ? 1 : diff < 15 ? 0.75 : diff < 30 ? 0.4 : diff < 60 ? 0.15 : 0
    }

    const ytLower = ytResult.title.toLowerCase()
    const isOriginalRemix = spotTrack.name.toLowerCase().includes('remix') || spotTrack.name.toLowerCase().includes('feat')
    let penalty = 0
    if (!isOriginalRemix) {
      if (ytLower.includes('cover') && !spotTrack.name.toLowerCase().includes('cover')) penalty += 0.3
      if (ytLower.includes('nightcore')) penalty += 0.5
      if (ytLower.includes('karaoke')) penalty += 0.5
    }

    return Math.max(0, nameSim * 0.45 + artistSim * 0.15 + durScore * 0.40 - penalty)
  }

  async function handleDownloadOne(track) {
    if (!window.electron) return
    const searchRes = await window.electron.ytSearch.search(track.query)
    if (!searchRes.results?.length) return

    // Score all results and pick best scoring one (min score 0.1 to avoid totally wrong matches)
    const scored = searchRes.results
      .map(r => ({ ...r, _score: scoreResult(r, track) }))
      .filter(r => r._score > 0.1)
      .sort((a, b) => b._score - a._score)

    const best = scored[0] || searchRes.results[0]
    await window.electron.downloader.start({
      url: best.url, format, audioFormat: audioFmt,
      outputDir: outputDir || undefined,
      trackTitle: track.name, trackArtist: track.artist,
    })
    setQueued(prev => new Set(prev).add(track.query))

    // Persist the found YouTube URL to the library track so future exports/imports carry it
    if (best.url && window.electron?.library) {
      window.electron.library.getTracks().then(libTracks => {
        if (!libTracks) return
        const norm = s => (s || '').toLowerCase().trim()
        const n = norm(track.name)
        const a = norm(track.artist)
        const match = libTracks.find(t =>
          norm(t.title) === n ||
          (norm(t.title).includes(n) && (!a || norm(t.artist) === a))
        )
        if (match && !match.yt_url) {
          window.electron.library.updateTrack({ ...match, yt_url: best.url })
        }
      })
    }

    // Fetch lyrics in parallel if enabled
    if (fetchLyrics && format === 'audio' && window.electron?.lyrics) {
      window.electron.lyrics.fetch({ title: track.name, artist: track.artist }).then(res => {
        if (res?.lyrics) {
          // Try to apply to library if the track is already scanned
          window.electron.library.getTracks().then(libTracks => {
            const match = libTracks?.find(t =>
              t.title?.toLowerCase().includes(track.name.toLowerCase()) ||
              track.name.toLowerCase().includes(t.title?.toLowerCase() || '')
            )
            if (match && !match.lyrics) {
              window.electron.library.updateTrack({ ...match, lyrics: res.lyrics })
            }
          })
          setLyricsStatus(prev => ({ ...prev, [track.query]: 'ok' }))
        } else {
          setLyricsStatus(prev => ({ ...prev, [track.query]: 'fail' }))
        }
      })
    }
  }

  async function handleDownloadAll() {
    if (!window.electron || tracks.length === 0) return
    for (const track of tracks) {
      await handleDownloadOne(track)
    }
    setAllDone(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Cole o link de uma playlist ou música do Spotify..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleResolve()}
          className="input-base flex-1 text-sm"
        />
        <button
          onClick={handleResolve}
          disabled={!url.trim() || loading}
          className="btn-primary flex items-center gap-2 whitespace-nowrap"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <ListMusic size={14} />}
          Importar
        </button>
      </div>

      {/* Format */}
      <div className="flex gap-3 items-center">
        <label className="text-xs text-white/40">Baixar como:</label>
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          {[{ val: 'audio', label: 'Áudio' }, { val: 'video', label: 'Vídeo' }].map(({ val, label }) => (
            <button key={val} onClick={() => setFormat(val)}
              className={`px-3 py-1.5 text-xs transition-colors
                ${format === val ? 'bg-brand-600 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
              {label}
            </button>
          ))}
        </div>
        {format === 'audio' && (
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {['mp3', 'flac'].map(f => (
              <button key={f} onClick={() => setAudioFmt(f)}
                className={`px-3 py-1.5 text-xs uppercase transition-colors
                  ${audioFmt === f ? 'bg-brand-600 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lyrics checkbox */}
      {format === 'audio' && (
        <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
          <div
            onClick={() => setFetchLyrics(v => !v)}
            className={`w-8 h-4 rounded-full transition-colors relative ${fetchLyrics ? 'bg-brand-600' : 'bg-white/20'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform shadow ${fetchLyrics ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-xs text-white/50">Baixar letra automaticamente</span>
        </label>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-300">{error}</div>
      )}

      {tracks.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/40">{tracks.length} faixa{tracks.length !== 1 ? 's' : ''} encontrada{tracks.length !== 1 ? 's' : ''}</p>
            <button
              onClick={handleDownloadAll}
              disabled={ytdlpReady === false || allDone}
              className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-40"
            >
              {allDone ? <><CheckCircle size={12} /> Todas na fila</> : <><Download size={12} /> Baixar tudo</>}
            </button>
          </div>
          <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
            {tracks.map((t, i) => (
              <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/5">
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm text-white truncate">{t.name}</p>
                  <p className="text-xs text-white/40 truncate">{t.artist}</p>
                </div>
                {queued.has(t.query) ? (
                  <CheckCircle size={13} className="text-green-400 shrink-0" />
                ) : (
                  <button
                    onClick={() => handleDownloadOne(t)}
                    disabled={ytdlpReady === false}
                    className="btn-ghost p-1.5 text-brand-400 hover:text-brand-300 shrink-0 disabled:opacity-40"
                  >
                    <Download size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function DownloadsPage() {
  const [activeTab,  setActiveTab]  = useState('url')
  const [queue,      setQueue]      = useState([])
  const [ytdlpReady, setYtdlpReady] = useState(null)
  const [outputDir,  setOutputDir]  = useState('')

  const isElectron = !!window.electron
  const unsubRef   = useRef(null)
  const pollRef    = useRef(null)

  // Load saved download path so all tabs share the same default
  useEffect(() => {
    if (!isElectron) return
    window.electron.settings.get('downloadPath').then(p => { if (p) setOutputDir(p) })
  }, [])

  // Poll yt-dlp status until ready
  useEffect(() => {
    if (!isElectron) return
    async function checkStatus() {
      const s = await window.electron.downloader.ytdlpStatus()
      setYtdlpReady(s.ready)
      if (!s.ready) pollRef.current = setTimeout(checkStatus, 3000)
    }
    checkStatus()
    return () => clearTimeout(pollRef.current)
  }, [])

  useEffect(() => {
    if (!isElectron) return
    window.electron.downloader.getQueue().then(q => setQueue(q || []))
    unsubRef.current = window.electron.downloader.onProgress((data) => {
      setQueue(prev => {
        const exists = prev.find(j => j.id === data.id)
        if (!exists) return [{ ...data }, ...prev]
        return prev.map(j => j.id === data.id ? { ...j, ...data } : j)
      })
    })
    return () => { if (unsubRef.current) unsubRef.current() }
  }, [])

  async function handleCancel(id) {
    if (!isElectron) return
    await window.electron.downloader.cancel(id)
  }

  const TABS = [
    { id: 'url',      label: 'Link / URL' },
    { id: 'ytsearch', label: 'Busca YouTube' },
    { id: 'spotify',  label: 'Spotify' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 gap-4">

      {/* yt-dlp status banner */}
      {ytdlpReady === false && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-amber-300 shrink-0">
          <Loader2 size={15} className="animate-spin shrink-0" />
          <strong>Preparando yt-dlp...</strong> O binário está sendo baixado (~20 MB). Aguarde.
        </div>
      )}
      {ytdlpReady === true && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2 text-xs text-green-400 shrink-0">
          <CheckCircle size={13} /> yt-dlp pronto
        </div>
      )}

      {/* Input card with tabs */}
      <div className="card p-5 flex flex-col gap-4 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Download size={16} className="text-brand-400" /> Novo Download
          </h2>
          {/* Tabs */}
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 text-xs transition-colors
                  ${activeTab === t.id ? 'bg-brand-600 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'url'      && <UrlTab      ytdlpReady={ytdlpReady} sharedOutputDir={outputDir} onOutputDirChange={setOutputDir} />}
        {activeTab === 'ytsearch' && <YtSearchTab ytdlpReady={ytdlpReady} outputDir={outputDir} />}
        {activeTab === 'spotify'  && <SpotifyTab  ytdlpReady={ytdlpReady} outputDir={outputDir} />}
      </div>

      {/* Queue */}
      <div className="flex-1 overflow-hidden flex flex-col gap-3 min-h-0">
        <h3 className="text-sm font-medium text-white/60 shrink-0">Fila de downloads</h3>
        {queue.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-white/20 text-sm">
            Nenhum download ainda
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col gap-2">
            {queue.map(job => (
              <div key={job.id} className="card p-4 flex items-start gap-4">
                <div className="shrink-0 mt-0.5">{STATUS_ICON[job.status] ?? STATUS_ICON.queued}</div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm text-white truncate">{job.title || job.url || job.id}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className={`text-xs ${
                      job.status === 'done'        ? 'text-green-400'
                      : job.status === 'error'     ? 'text-red-400'
                      : job.status === 'cancelled' ? 'text-white/30'
                      : job.status === 'downloading' ? 'text-brand-400'
                      : 'text-white/30'
                    }`}>
                      {job.status === 'downloading' && job.speed  ? `${job.speed} · ` : ''}
                      {job.status === 'downloading' && job.eta    ? `ETA ${job.eta}s · ` : ''}
                      {job.status === 'downloading' && job.percent > 0 ? `${Math.round(job.percent)}%` : ''}
                      {job.status === 'done'      ? 'Concluído' : ''}
                      {job.status === 'cancelled' ? 'Cancelado' : ''}
                      {job.status === 'queued'    ? 'Na fila'   : ''}
                    </span>
                  </div>
                  {job.status === 'error' && job.error && (
                    <p className="text-xs text-red-300/80 mt-1 break-words">{job.error}</p>
                  )}
                  {job.status === 'downloading' && (
                    <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full transition-all duration-300"
                        style={{ width: `${job.percent || 0}%` }} />
                    </div>
                  )}
                </div>
                {(job.status === 'queued' || job.status === 'downloading') && (
                  <button onClick={() => handleCancel(job.id)}
                    className="shrink-0 btn-ghost p-1 text-white/30 hover:text-red-400 mt-0.5">
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import React, { useState, useEffect, useRef } from 'react'
import {
  Download, X, FolderOpen, Music, Video,
  Loader2, CheckCircle2, AlertCircle, Ban,
  AlertTriangle, CheckCircle, Search, ListMusic,
} from 'lucide-react'

const STATUS_CONFIG = {
  queued:      { icon: Loader2, color: 'text-white/35', spin: true,  label: 'Na fila' },
  downloading: { icon: Loader2, color: 'text-brand-400', spin: true, label: 'Baixando' },
  done:        { icon: CheckCircle2, color: 'text-green-400', spin: false, label: 'Concluído' },
  error:       { icon: AlertCircle,  color: 'text-red-400',   spin: false, label: 'Erro' },
  cancelled:   { icon: Ban,          color: 'text-white/25',  spin: false, label: 'Cancelado' },
}

function StatusIcon({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.queued
  const Icon = cfg.icon
  return <Icon size={14} className={`${cfg.color} ${cfg.spin ? 'animate-spin' : ''}`} />
}

function formatDuration(secs) {
  if (!secs) return ''
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-white/8 bg-surface-700/50">
      {options.map(({ val, label, icon: Icon }) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors
            ${value === val
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-white/45 hover:text-white/75 hover:bg-white/4'
            }`}
        >
          {Icon && <Icon size={12} />}
          {label}
        </button>
      ))}
    </div>
  )
}

function FolderRow({ value, onChange }) {
  const isElectron = !!window.electron
  async function pick() {
    if (!isElectron) return
    const dir = await window.electron.dialog.openFolder()
    if (dir) { onChange(dir); window.electron.settings.set('downloadPath', dir) }
  }
  return (
    <div>
      <label className="text-[11px] text-white/35 font-semibold uppercase tracking-wider mb-1.5 block">
        Pasta de destino
      </label>
      <div className="flex gap-2">
        <input
          type="text" readOnly
          placeholder="Padrão: pasta Downloads do sistema"
          value={value}
          onClick={pick}
          className="input-base flex-1 text-sm cursor-pointer text-white/60"
        />
        <button onClick={pick} className="btn-ghost p-2">
          <FolderOpen size={15} />
        </button>
      </div>
    </div>
  )
}

function ErrorBanner({ msg, onDismiss }) {
  return (
    <div className="flex items-center gap-3 bg-red-500/8 border border-red-500/25 rounded-xl px-4 py-3 text-sm text-red-300">
      <AlertTriangle size={14} className="shrink-0" />
      <span className="flex-1">{msg}</span>
      <button onClick={onDismiss} className="text-red-400/60 hover:text-red-300"><X size={13} /></button>
    </div>
  )
}

// ── Aba: Link / URL ────────────────────────────────────────────────────────────
function UrlTab({ ytdlpReady, sharedOutputDir, onOutputDirChange }) {
  const [url,      setUrl]      = useState('')
  const [format,   setFormat]   = useState('audio')
  const [audioFmt, setAudioFmt] = useState('mp3')
  const [quality,  setQuality]  = useState('1080p')
  const [error,    setError]    = useState('')

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
      {error && <ErrorBanner msg={error} onDismiss={() => setError('')} />}

      <div className="flex gap-2">
        <input
          type="url"
          placeholder="Cole um link do YouTube, playlist ou vídeo..."
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
          <label className="text-[11px] text-white/35 font-semibold uppercase tracking-wider mb-1.5 block">Formato</label>
          <SegmentedControl
            options={[{ val: 'audio', label: 'Áudio', icon: Music }, { val: 'video', label: 'Vídeo', icon: Video }]}
            value={format}
            onChange={setFormat}
          />
        </div>

        {format === 'audio' && (
          <div>
            <label className="text-[11px] text-white/35 font-semibold uppercase tracking-wider mb-1.5 block">Codec</label>
            <SegmentedControl
              options={[{ val: 'mp3', label: 'MP3' }, { val: 'flac', label: 'FLAC' }]}
              value={audioFmt}
              onChange={setAudioFmt}
            />
          </div>
        )}

        {format === 'video' && (
          <div>
            <label className="text-[11px] text-white/35 font-semibold uppercase tracking-wider mb-1.5 block">Qualidade</label>
            <SegmentedControl
              options={['4K', '1080p', '720p', '480p', '360p'].map(q => ({ val: q, label: q }))}
              value={quality}
              onChange={setQuality}
            />
          </div>
        )}

        <div className="flex-1 min-w-40">
          <FolderRow value={sharedOutputDir} onChange={onOutputDirChange} />
        </div>
      </div>
    </div>
  )
}

// ── Aba: Reels ─────────────────────────────────────────────────────────────────
function ReelsTab({ ytdlpReady, outputDir, onOutputDirChange }) {
  const [url,     setUrl]     = useState('')
  const [quality, setQuality] = useState('1080p')
  const [error,   setError]   = useState('')

  function isReelUrl(value) {
    try {
      const parsed  = new URL(value)
      const host    = parsed.hostname.toLowerCase()
      const path    = parsed.pathname.toLowerCase()
      return (
        (host.includes('instagram.com') && (path.includes('/reel/') || path.includes('/reels/'))) ||
        (host.includes('facebook.com')  && path.includes('/reel/'))
      )
    } catch { return false }
  }

  async function handleDownload() {
    const cleanUrl = url.trim()
    if (!cleanUrl) return
    setError('')
    if (!isReelUrl(cleanUrl)) {
      setError('Cole um link de Reel do Instagram ou Facebook.')
      return
    }
    const result = await window.electron.downloader.start({
      url: cleanUrl, format: 'video', quality, source: 'reel',
      outputDir: outputDir || undefined,
    })
    if (result?.error) { setError(result.error); return }
    setUrl('')
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner msg={error} onDismiss={() => setError('')} />}
      <div className="flex gap-2">
        <input
          type="url"
          placeholder="Cole um link de Reel do Instagram ou Facebook..."
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
            : <><Video size={14} /> Baixar Reel</>
          }
        </button>
      </div>
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-[11px] text-white/35 font-semibold uppercase tracking-wider mb-1.5 block">Qualidade</label>
          <SegmentedControl
            options={['1080p', '720p', '480p', '360p'].map(q => ({ val: q, label: q }))}
            value={quality}
            onChange={setQuality}
          />
        </div>
        <div className="flex-1 min-w-40">
          <FolderRow value={outputDir} onChange={onOutputDirChange} />
        </div>
      </div>
      <p className="text-xs text-white/30 leading-relaxed">
        Reels são baixados somente como vídeo. Perfis privados podem exigir cookies configurados em Configurações.
      </p>
    </div>
  )
}

// ── Aba: Busca YouTube ─────────────────────────────────────────────────────────
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

      <div className="flex gap-3 items-center flex-wrap">
        <span className="text-[11px] text-white/35 font-semibold uppercase tracking-wider">Baixar como:</span>
        <SegmentedControl
          options={[{ val: 'audio', label: 'Áudio' }, { val: 'video', label: 'Vídeo' }]}
          value={format}
          onChange={setFormat}
        />
        {format === 'audio' && (
          <SegmentedControl
            options={[{ val: 'mp3', label: 'MP3' }, { val: 'flac', label: 'FLAC' }]}
            value={audioFmt}
            onChange={setAudioFmt}
          />
        )}
      </div>

      {error && <ErrorBanner msg={error} onDismiss={() => setError('')} />}

      {results.length > 0 && (
        <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
          {results.map(item => (
            <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/4 transition-colors">
              {item.thumbnail && (
                <img src={item.thumbnail} alt="" className="w-20 h-12 object-cover rounded-lg shrink-0" />
              )}
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-white/90 truncate leading-tight">{item.title}</p>
                <p className="text-xs text-white/35 mt-0.5">{item.channel}{item.duration ? ` · ${formatDuration(item.duration)}` : ''}</p>
              </div>
              <button
                onClick={() => handleDownload(item)}
                disabled={ytdlpReady === false}
                className="btn-primary flex items-center gap-1.5 text-xs px-3 py-2 shrink-0 disabled:opacity-40"
              >
                <Download size={12} /> Baixar
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && query && !error && (
        <p className="text-center text-white/20 text-sm py-6">Nenhum resultado. Refine sua busca.</p>
      )}
    </div>
  )
}

// ── Aba: Spotify ───────────────────────────────────────────────────────────────
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
      if (ytLower.includes('karaoke'))   penalty += 0.5
    }
    return Math.max(0, nameSim * 0.45 + artistSim * 0.15 + durScore * 0.40 - penalty)
  }

  async function handleDownloadOne(track) {
    if (!window.electron) return
    const searchRes = await window.electron.ytSearch.search(track.query)
    if (!searchRes.results?.length) return
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
    if (best.url && window.electron?.library) {
      window.electron.library.getTracks().then(libTracks => {
        if (!libTracks) return
        const norm = s => (s || '').toLowerCase().trim()
        const n = norm(track.name), a = norm(track.artist)
        const match = libTracks.find(t =>
          norm(t.title) === n || (norm(t.title).includes(n) && (!a || norm(t.artist) === a))
        )
        if (match && !match.yt_url) window.electron.library.updateTrack({ ...match, yt_url: best.url })
      })
    }
    if (fetchLyrics && format === 'audio' && window.electron?.lyrics) {
      window.electron.lyrics.fetch({ title: track.name, artist: track.artist }).then(res => {
        if (res?.lyrics) {
          window.electron.library.getTracks().then(libTracks => {
            const match = libTracks?.find(t =>
              t.title?.toLowerCase().includes(track.name.toLowerCase()) ||
              track.name.toLowerCase().includes(t.title?.toLowerCase() || '')
            )
            if (match && !match.lyrics) window.electron.library.updateTrack({ ...match, lyrics: res.lyrics })
          })
        }
      })
    }
  }

  async function handleDownloadAll() {
    if (!window.electron || tracks.length === 0) return
    for (const track of tracks) await handleDownloadOne(track)
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

      <div className="flex gap-3 items-center flex-wrap">
        <span className="text-[11px] text-white/35 font-semibold uppercase tracking-wider">Baixar como:</span>
        <SegmentedControl
          options={[{ val: 'audio', label: 'Áudio' }, { val: 'video', label: 'Vídeo' }]}
          value={format}
          onChange={setFormat}
        />
        {format === 'audio' && (
          <SegmentedControl
            options={[{ val: 'mp3', label: 'MP3' }, { val: 'flac', label: 'FLAC' }]}
            value={audioFmt}
            onChange={setAudioFmt}
          />
        )}
      </div>

      {format === 'audio' && (
        <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
          <div
            onClick={() => setFetchLyrics(v => !v)}
            className={`w-8 h-4 rounded-full transition-colors relative ${fetchLyrics ? 'bg-brand-600' : 'bg-white/15'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform shadow
                             ${fetchLyrics ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-xs text-white/50">Baixar letra automaticamente</span>
        </label>
      )}

      {error && <ErrorBanner msg={error} onDismiss={() => setError('')} />}

      {tracks.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/40">
              {tracks.length} faixa{tracks.length !== 1 ? 's' : ''} encontrada{tracks.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={handleDownloadAll}
              disabled={ytdlpReady === false || allDone}
              className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-40"
            >
              {allDone
                ? <><CheckCircle size={12} /> Todas na fila</>
                : <><Download size={12} /> Baixar tudo</>
              }
            </button>
          </div>
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {tracks.map((t, i) => (
              <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-white/4">
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium text-white/90 truncate">{t.name}</p>
                  <p className="text-xs text-white/35 truncate">{t.artist}</p>
                </div>
                {queued.has(t.query) ? (
                  <CheckCircle size={13} className="text-green-400 shrink-0" />
                ) : (
                  <button
                    onClick={() => handleDownloadOne(t)}
                    disabled={ytdlpReady === false}
                    className="p-1.5 rounded-lg text-brand-400 hover:text-brand-300 hover:bg-brand-600/15
                               shrink-0 disabled:opacity-40 transition-all"
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

// ── Página principal ───────────────────────────────────────────────────────────
export default function DownloadsPage() {
  const [activeTab,  setActiveTab]  = useState('url')
  const [queue,      setQueue]      = useState([])
  const [ytdlpReady, setYtdlpReady] = useState(null)
  const [outputDir,  setOutputDir]  = useState('')

  const isElectron = !!window.electron
  const unsubRef   = useRef(null)
  const pollRef    = useRef(null)

  useEffect(() => {
    if (!isElectron) return
    window.electron.settings.get('downloadPath').then(p => { if (p) setOutputDir(p) })
  }, [])

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
    unsubRef.current = window.electron.downloader.onProgress(data => {
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
    { id: 'reels',    label: 'Reels' },
    { id: 'ytsearch', label: 'Busca YouTube' },
    { id: 'spotify',  label: 'Spotify' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden p-2.5 pl-3 gap-2.5">

      {/* Banner yt-dlp */}
      {ytdlpReady === false && (
        <div className="flex items-center gap-3 bg-amber-500/8 border border-amber-500/25 rounded-2xl
                        px-4 py-3 text-sm text-amber-300 shrink-0">
          <Loader2 size={14} className="animate-spin shrink-0" />
          <div>
            <span className="font-bold">Preparando yt-dlp...</span>
            <span className="text-amber-300/70 ml-1.5">O binário está sendo baixado (~20 MB). Aguarde.</span>
          </div>
        </div>
      )}

      {/* Painel de criação de download */}
      <div className="panel p-5 flex flex-col gap-5 shrink-0">
        {/* Cabeçalho do painel + abas */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Download size={16} className="text-brand-500" />
            <h2 className="text-sm font-bold text-white/90">Novo Download</h2>
          </div>
          {ytdlpReady === true && (
            <span className="badge badge-accent"><CheckCircle size={9} className="mr-0.5" /> Pronto</span>
          )}
          <div className="ml-auto flex rounded-xl overflow-hidden border border-white/8 bg-surface-700/50">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors
                  ${activeTab === t.id
                    ? 'bg-brand-600 text-white'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/4'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'url'      && <UrlTab      ytdlpReady={ytdlpReady} sharedOutputDir={outputDir} onOutputDirChange={setOutputDir} />}
        {activeTab === 'reels'    && <ReelsTab    ytdlpReady={ytdlpReady} outputDir={outputDir} onOutputDirChange={setOutputDir} />}
        {activeTab === 'ytsearch' && <YtSearchTab ytdlpReady={ytdlpReady} outputDir={outputDir} />}
        {activeTab === 'spotify'  && <SpotifyTab  ytdlpReady={ytdlpReady} outputDir={outputDir} />}
      </div>

      {/* Fila de downloads */}
      <div className="flex-1 overflow-hidden flex flex-col gap-2.5 min-h-0">
        <div className="flex items-center gap-2 px-1">
          <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">Fila de downloads</h3>
          {queue.length > 0 && (
            <span className="badge badge-muted">{queue.length}</span>
          )}
        </div>

        {queue.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 panel rounded-2xl">
            <Download size={36} strokeWidth={0.8} className="text-white/10" />
            <p className="text-sm text-white/20">Nenhum download ainda</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col gap-2">
            {queue.map(job => {
              const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.queued
              return (
                <div key={job.id} className="panel px-4 py-3.5 flex items-start gap-4 rounded-2xl">
                  <div className="shrink-0 mt-0.5">
                    <StatusIcon status={job.status} />
                  </div>
                  <div className="flex-1 overflow-hidden min-w-0">
                    <p className="text-sm font-semibold text-white/90 truncate leading-tight">
                      {job.title || job.url || job.id}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs ${cfg.color}`}>
                        {cfg.label}
                        {job.status === 'downloading' && job.speed   ? ` · ${job.speed}`       : ''}
                        {job.status === 'downloading' && job.eta     ? ` · ETA ${job.eta}s`    : ''}
                        {job.status === 'downloading' && job.percent > 0 ? ` · ${Math.round(job.percent)}%` : ''}
                      </span>
                    </div>
                    {job.status === 'error' && job.error && (
                      <p className="text-xs text-red-300/75 mt-1.5 break-words leading-relaxed">{job.error}</p>
                    )}
                    {job.status === 'downloading' && (
                      <div className="mt-2.5 h-1 bg-white/8 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full transition-all duration-300"
                          style={{ width: `${job.percent || 0}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {(job.status === 'queued' || job.status === 'downloading') && (
                    <button
                      onClick={() => handleCancel(job.id)}
                      className="shrink-0 p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-white/4
                                 transition-all mt-0.5"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

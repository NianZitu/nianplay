import React, { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft, Play, Shuffle, SlidersHorizontal, Plus,
  Trash2, Loader2, CheckCircle2, AlertCircle,
  X, Search, ExternalLink, Pencil, Check, ListPlus, Settings2, Download,
  DownloadCloud, AlertTriangle, FolderOpen, Tag,
} from 'lucide-react'
import { usePlayer } from '../store/PlayerContext'
import MaestroModal from '../components/MaestroModal'

function EqualizeModal({ playlist, tracks, onClose }) {
  const [anchorId,  setAnchorId]  = useState(tracks[0]?.id || '')
  const [running,   setRunning]   = useState(false)
  const [progress,  setProgress]  = useState(null)
  const [result,    setResult]    = useState(null)
  const unsubRef = useRef(null)

  useEffect(() => {
    if (!window.electron) return
    unsubRef.current = window.electron.lufs.onProgress(data => setProgress(data))
    return () => unsubRef.current?.()
  }, [])

  async function handleEqualize() {
    if (!anchorId || !window.electron) return
    setRunning(true)
    setResult(null)
    const res = await window.electron.lufs.equalizePlaylist(anchorId, playlist.id)
    setRunning(false)
    setResult(res)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-800 border border-white/10 rounded-2xl p-6 w-[480px] flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-brand-400" />
            Equalizar Playlist
          </h2>
          <button onClick={onClose} disabled={running} className="btn-ghost p-1 text-white/40"><X size={16} /></button>
        </div>

        <p className="text-xs text-white/40">
          Analisa o volume LUFS de cada faixa e ajusta o ganho de reprodução para que
          todas soem no mesmo nível da faixa âncora. Nenhum arquivo é modificado.
        </p>

        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Faixa âncora (referência de volume)</label>
          <select
            value={anchorId}
            onChange={e => setAnchorId(e.target.value)}
            disabled={running}
            className="input-base w-full text-sm"
          >
            {tracks.map(t => (
              <option key={t.id} value={t.id}>{t.title} — {t.artist}</option>
            ))}
          </select>
        </div>

        {(running || progress) && (
          <div className="bg-surface-700/60 rounded-lg p-3 flex flex-col gap-1.5 text-xs">
            {progress?.phase === 'measuring_anchor' && (
              <p className="text-white/60 flex items-center gap-1.5">
                <Loader2 size={11} className="animate-spin" /> Medindo faixa âncora...
              </p>
            )}
            {progress?.phase === 'measuring' && (
              <>
                <p className="text-white/60 flex items-center gap-1.5">
                  <Loader2 size={11} className="animate-spin" />
                  Analisando: <span className="text-white truncate max-w-xs">{progress.title}</span>
                </p>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-brand-500 transition-all" style={{ width: `${((progress.done) / (progress.total)) * 100}%` }} />
                </div>
                <p className="text-white/30">{progress.done} / {progress.total}</p>
              </>
            )}
            {progress?.phase === 'done' && (
              <p className="text-green-400 flex items-center gap-1.5">
                <CheckCircle2 size={11} /> Concluído — âncora: {progress.anchorLufs?.toFixed(1)} LUFS
              </p>
            )}
          </div>
        )}

        {result && !result.error && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 text-xs text-green-300">
            Ganho ajustado em todas as faixas. Reinicie a reprodução para aplicar.
          </div>
        )}
        {result?.error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-300">
            Erro: {result.error}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} disabled={running} className="btn-ghost px-4 py-2 text-sm disabled:opacity-40">
            {result ? 'Fechar' : 'Cancelar'}
          </button>
          {!result && (
            <button onClick={handleEqualize} disabled={running || !anchorId} className="btn-primary px-4 py-2 text-sm disabled:opacity-40 flex items-center gap-2">
              {running ? <><Loader2 size={13} className="animate-spin" /> Analisando...</> : 'Equalizar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function AddTracksModal({ playlistId, currentTrackIds, onClose, onAdded }) {
  const [allTracks, setAllTracks] = useState([])
  const [search,    setSearch]    = useState('')
  const [added,     setAdded]     = useState(new Set(currentTrackIds)) // persists adds during session
  const [adding,    setAdding]    = useState(new Set())

  useEffect(() => {
    if (!window.electron) return
    window.electron.library.getTracks().then(t => setAllTracks(t || []))
  }, [])

  const filtered = allTracks.filter(t =>
    (t.title + t.artist).toLowerCase().includes(search.toLowerCase())
  )

  async function handleAdd(track) {
    if (!window.electron || added.has(track.id)) return
    setAdding(prev => new Set(prev).add(track.id))
    await window.electron.playlists.addTrack(playlistId, track.id)
    setAdding(prev => { const s = new Set(prev); s.delete(track.id); return s })
    setAdded(prev => new Set(prev).add(track.id))
    onAdded()
  }

  async function handleAddAll() {
    if (!window.electron) return
    const toAdd = filtered.filter(t => !added.has(t.id))
    for (const t of toAdd) {
      setAdding(prev => new Set(prev).add(t.id))
      await window.electron.playlists.addTrack(playlistId, t.id)
      setAdding(prev => { const s = new Set(prev); s.delete(t.id); return s })
      setAdded(prev => new Set(prev).add(t.id))
    }
    onAdded()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-800 border border-white/10 rounded-2xl w-[520px] max-h-[70vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-base font-semibold text-white">Adicionar Faixas</h2>
          <div className="flex items-center gap-2">
            {filtered.some(t => !added.has(t.id)) && (
              <button onClick={handleAddAll} className="btn-ghost text-xs px-3 py-1.5 text-brand-400 hover:text-brand-300">
                + Adicionar todas visíveis
              </button>
            )}
            <button onClick={onClose} className="btn-ghost p-1 text-white/40"><X size={16} /></button>
          </div>
        </div>
        <div className="px-5 pb-3 shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              autoFocus
              type="text"
              placeholder="Buscar na biblioteca..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-base w-full pl-8 text-sm"
            />
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-5 pb-5 flex flex-col gap-1">
          {filtered.length === 0 && (
            <p className="text-center text-white/20 text-sm py-8">Nenhuma faixa encontrada</p>
          )}
          {filtered.map(t => {
            const isAdded   = added.has(t.id)
            const isAdding  = adding.has(t.id)
            return (
              <div key={t.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <div className="w-9 h-9 rounded overflow-hidden bg-surface-600 shrink-0">
                  {t.cover_path
                    ? <img src={/^https?:\/\//.test(t.cover_path) ? t.cover_path : `file://${t.cover_path}`} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-white/20">♪</div>
                  }
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm text-white truncate">{t.title}</p>
                  <p className="text-xs text-white/40 truncate">{t.artist}</p>
                </div>
                {/* Checkmark badge if already in playlist */}
                {isAdded ? (
                  <span className="flex items-center gap-1 text-xs text-green-400 shrink-0">
                    <Check size={13} /> Na playlist
                  </span>
                ) : (
                  <button
                    onClick={() => handleAdd(t)}
                    disabled={isAdding}
                    className="btn-ghost p-1.5 text-brand-400 hover:text-brand-300 disabled:opacity-40"
                  >
                    {isAdding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Score a YouTube result vs a track
function scoreYt(ytResult, track) {
  // Unicode-aware word similarity — keeps Japanese/accented chars intact
  function wordSim(a, b) {
    // Normalize: lowercase, remove punctuation but keep unicode letters/numbers
    a = (a || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim()
    b = (b || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim()
    if (!a || !b) return 0
    if (a === b) return 1
    // Exact substring match is a strong signal
    if (b.includes(a) || a.includes(b)) return 0.85
    const aWords = new Set(a.split(/\s+/).filter(Boolean))
    const bWords = b.split(/\s+/).filter(Boolean)
    if (!aWords.size || !bWords.length) return 0
    const overlap = bWords.filter(w => aWords.has(w)).length
    // Jaccard-style: shared / union
    return overlap / Math.max(aWords.size, bWords.length)
  }

  const nameSim = wordSim(track.title, ytResult.title)

  const UNKNOWN = new Set(['desconhecido', 'unknown', 'desconocido', ''])
  const artistClean = (track.artist || '').toLowerCase().trim()
  const artistSim = UNKNOWN.has(artistClean) ? 0.5 : wordSim(track.artist, ytResult.title)

  // Duration score — weighted 40% (main tiebreaker when titles are similar)
  let durScore = 0.5
  if (track.duration && ytResult.duration) {
    const diff = Math.abs(track.duration - ytResult.duration)
    durScore = diff <= 3 ? 1 : diff <= 8 ? 0.9 : diff <= 20 ? 0.6 : diff <= 45 ? 0.25 : diff <= 90 ? 0.05 : 0
  }

  const ytLower = (ytResult.title || '').toLowerCase()
  const titleLower = (track.title || '').toLowerCase()
  let penalty = 0
  if (!titleLower.includes('cover') && ytLower.includes('cover'))     penalty += 0.35
  if (!titleLower.includes('nightcore') && ytLower.includes('nightcore')) penalty += 0.6
  if (!titleLower.includes('karaoke') && ytLower.includes('karaoke'))   penalty += 0.6
  if (!titleLower.includes('remix') && ytLower.includes('remix'))      penalty += 0.2

  return Math.max(0, nameSim * 0.45 + artistSim * 0.15 + durScore * 0.4 - penalty)
}

const UNKNOWN_ARTISTS = new Set(['desconhecido', 'unknown', 'desconocido', ''])

function DownloadMissingModal({ tracks, onClose, onLinked }) {
  const [outputDir,  setOutputDir]  = useState('')
  const [audioFmt,   setAudioFmt]   = useState('mp3')
  const [statuses,   setStatuses]   = useState({})  // trackId → status string
  const [percents,   setPercents]   = useState({})  // trackId → 0-100
  const [errors,     setErrors]     = useState({})  // trackId → error message string
  const [expanded,   setExpanded]   = useState({})  // trackId → bool (show full error)
  const [running,    setRunning]    = useState(false)
  const unsubRef   = useRef(null)
  const jobToTrack = useRef({}) // downloadJobId → trackId

  useEffect(() => {
    if (window.electron) {
      window.electron.settings.get('downloadPath').then(p => { if (p) setOutputDir(p) })
    }
    unsubRef.current = window.electron?.downloader.onProgress(data => {
      const trackId = data.trackId || jobToTrack.current[data.id]
      if (!trackId) return
      if (data.status === 'done') {
        setStatuses(prev => ({ ...prev, [trackId]: 'done' }))
        onLinked?.(trackId)
      } else if (data.status === 'error') {
        setStatuses(prev => ({ ...prev, [trackId]: 'error' }))
        setErrors(prev => ({ ...prev, [trackId]: data.error || 'Erro desconhecido' }))
      } else {
        setStatuses(prev => ({ ...prev, [trackId]: 'downloading' }))
        if (data.percent != null) setPercents(prev => ({ ...prev, [trackId]: data.percent }))
      }
    })
    return () => unsubRef.current?.()
  }, [])

  async function chooseDir() {
    if (!window.electron) return
    const d = await window.electron.dialog.openFolder()
    if (d) { setOutputDir(d); window.electron.settings.set('downloadPath', d) }
  }

  function setError(trackId, msg) {
    setStatuses(prev => ({ ...prev, [trackId]: 'error' }))
    setErrors(prev => ({ ...prev, [trackId]: msg }))
  }

  // Sanitize a query string for yt-dlp (remove chars that confuse the search)
  function sanitizeQuery(q) {
    return (q || '')
      .replace(/[<>"|?*]/g, ' ')   // filesystem-unsafe chars
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  // Search YouTube with multiple query strategies, pick best scored result
  async function findYtUrl(track) {
    const artistClean = UNKNOWN_ARTISTS.has((track.artist || '').toLowerCase().trim())
      ? ''
      : (track.artist || '').trim()

    // Try queries in order: "artist - title" → "title artist" → "title only"
    const queries = artistClean
      ? [
          sanitizeQuery(`${artistClean} - ${track.title}`),
          sanitizeQuery(`${track.title} ${artistClean}`),
          sanitizeQuery(track.title),
        ]
      : [sanitizeQuery(track.title)]

    let bestResults = []
    for (const q of queries) {
      if (!q) continue
      const res = await window.electron.ytSearch.search(q)
      if (res?.results?.length) {
        bestResults = res.results
        break
      }
    }
    if (!bestResults.length) return null

    // Score all results; always fall back to first result
    const scored = bestResults
      .map(r => ({ ...r, _score: scoreYt(r, track) }))
      .sort((a, b) => b._score - a._score)

    return scored[0].url
  }

  async function downloadTrack(track) {
    if (!window.electron) return
    setStatuses(prev => ({ ...prev, [track.id]: 'searching' }))
    setErrors(prev => { const n = { ...prev }; delete n[track.id]; return n })

    let url = track.yt_url || ''

    if (!url) {
      try {
        url = await findYtUrl(track)
      } catch (e) {
        setError(track.id, `Busca falhou: ${e.message}`)
        return
      }
      if (!url) {
        setError(track.id, 'Nenhum resultado encontrado no YouTube')
        return
      }
    }

    const result = await window.electron.downloader.startForTrack({
      url,
      format:      'audio',
      audioFormat: audioFmt,
      outputDir:   outputDir || undefined,
      trackId:     track.id,
      trackTitle:  track.title,
      trackArtist: track.artist,
    })

    if (result?.id) {
      jobToTrack.current[result.id] = track.id
      setStatuses(prev => ({ ...prev, [track.id]: 'queued' }))
    } else {
      setError(track.id, result?.error || 'Falha ao iniciar download')
    }
  }

  async function downloadAll() {
    setRunning(true)
    const pending = tracks.filter(t => !statuses[t.id] || statuses[t.id] === 'error')
    for (const t of pending) {
      await downloadTrack(t)
      await new Promise(r => setTimeout(r, 600)) // rate-limit guard
    }
    setRunning(false)
  }

  const doneCount  = tracks.filter(t => statuses[t.id] === 'done').length
  const errorCount = tracks.filter(t => statuses[t.id] === 'error').length
  const allDone    = doneCount === tracks.length
  const hasPending = tracks.some(t => !statuses[t.id] || statuses[t.id] === 'error')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-800 border border-white/10 rounded-2xl w-[560px] max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <DownloadCloud size={15} className="text-brand-400" />
              Baixar faixas faltantes
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              {tracks.length} sem arquivo
              {doneCount > 0 && <span className="text-green-400 ml-2">· {doneCount} baixadas</span>}
              {errorCount > 0 && <span className="text-red-400 ml-2">· {errorCount} com erro</span>}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1 text-white/40"><X size={16} /></button>
        </div>

        {/* Settings row */}
        <div className="px-5 pb-3 flex items-center gap-3 shrink-0">
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {['mp3', 'flac'].map(f => (
              <button key={f} onClick={() => setAudioFmt(f)}
                className={`px-3 py-1.5 text-xs uppercase transition-colors ${audioFmt === f ? 'bg-brand-600 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                {f}
              </button>
            ))}
          </div>
          <div className="flex-1 flex gap-1">
            <input readOnly value={outputDir} placeholder="Pasta padrão (Downloads)" onClick={chooseDir}
              className="input-base flex-1 text-xs cursor-pointer" />
            <button onClick={chooseDir} className="btn-ghost p-2"><FolderOpen size={14} /></button>
          </div>
        </div>

        {/* Summary banner */}
        {doneCount > 0 && (
          <div className="mx-5 mb-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 text-xs text-green-300 shrink-0">
            {doneCount}/{tracks.length} baixadas e vinculadas. Reabra a playlist para ver as atualizações.
          </div>
        )}

        {/* Track list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-0.5">
          {tracks.map(t => {
            const st  = statuses[t.id]
            const pct = percents[t.id] || 0
            const err = errors[t.id]
            const isExp = expanded[t.id]
            return (
              <div key={t.id} className={`flex flex-col px-3 py-2.5 rounded-xl transition-colors ${st === 'error' ? 'bg-red-500/5 border border-red-500/10' : 'hover:bg-white/5'}`}>
                <div className="flex items-center gap-3">
                  {/* Cover placeholder */}
                  <div className="w-8 h-8 rounded bg-surface-600 shrink-0 flex items-center justify-center text-white/20 text-xs">♪</div>

                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm text-white truncate">{t.title}</p>
                    <p className="text-xs text-white/40 truncate">
                      {UNKNOWN_ARTISTS.has((t.artist || '').toLowerCase().trim()) ? 'Artista desconhecido' : t.artist}
                      {t.yt_url && <span className="ml-2 text-brand-400/60">· URL salva</span>}
                      {t.duration ? <span className="ml-2 text-white/20">{Math.floor(t.duration/60)}:{String(Math.floor(t.duration%60)).padStart(2,'0')}</span> : null}
                    </p>
                    {st === 'downloading' && (
                      <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>

                  {/* Status icon / action */}
                  <div className="shrink-0 flex items-center gap-1">
                    {!st && (
                      <button onClick={() => downloadTrack(t)} className="btn-ghost p-1.5 text-brand-400 hover:text-brand-300" title="Baixar">
                        <Download size={14} />
                      </button>
                    )}
                    {(st === 'searching' || st === 'queued') && (
                      <div className="flex items-center gap-1.5">
                        <Loader2 size={13} className="animate-spin text-white/40" />
                        <span className="text-xs text-white/30">{st === 'searching' ? 'Buscando…' : 'Na fila'}</span>
                      </div>
                    )}
                    {st === 'downloading' && (
                      <div className="flex items-center gap-1.5">
                        <Loader2 size={13} className="animate-spin text-brand-400" />
                        <span className="text-xs text-brand-400">{Math.round(pct)}%</span>
                      </div>
                    )}
                    {st === 'done' && <CheckCircle2 size={15} className="text-green-400" />}
                    {st === 'error' && (
                      <button onClick={() => downloadTrack(t)} className="btn-ghost p-1 text-red-400 hover:text-red-300" title="Tentar novamente">
                        <AlertCircle size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Error message */}
                {st === 'error' && err && (
                  <div className="mt-1.5 ml-11">
                    <p
                      className={`text-xs text-red-300/80 cursor-pointer ${isExp ? '' : 'truncate'}`}
                      onClick={() => setExpanded(prev => ({ ...prev, [t.id]: !isExp }))}
                      title={isExp ? 'Clique para recolher' : 'Clique para ver completo'}
                    >
                      {err}
                    </p>
                    {!isExp && err.length > 70 && (
                      <button className="text-xs text-red-400/60 hover:text-red-400 mt-0.5" onClick={() => setExpanded(prev => ({ ...prev, [t.id]: true }))}>
                        Ver mais ↓
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/5 flex justify-between items-center shrink-0">
          <button onClick={onClose} className="btn-ghost text-sm px-4 py-2">Fechar</button>
          {hasPending && !allDone && (
            <button
              onClick={downloadAll}
              disabled={running}
              className="btn-primary text-sm px-4 py-2 flex items-center gap-2 disabled:opacity-40"
            >
              {running
                ? <><Loader2 size={14} className="animate-spin" /> Baixando…</>
                : <><DownloadCloud size={14} /> {errorCount > 0 ? `Tentar novamente (${errorCount} erro${errorCount > 1 ? 's' : ''}) + pendentes` : 'Baixar todas'}</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function formatTotalDuration(secs) {
  if (!secs) return ''
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default function PlaylistDetailPage({ playlist, onBack }) {
  const [tracks,         setTracks]         = useState([])
  const [search,         setSearch]         = useState('')
  const [showEqualize,   setShowEqualize]   = useState(false)
  const [showAdd,        setShowAdd]        = useState(false)
  const [editingCover,   setEditingCover]   = useState(false)
  const [coverInput,     setCoverInput]     = useState(playlist.cover_url || '')
  const [maestroTrack,   setMaestroTrack]   = useState(null)
  const [exporting,      setExporting]      = useState(false)
  const [exportToast,    setExportToast]    = useState(null)
  const [showMissing,    setShowMissing]    = useState(false)
  // Groups state
  const [groups,         setGroups]         = useState([])
  const [groupsEnabled,  setGroupsEnabled]  = useState(playlist.groups_enabled || false)
  const [showGroupPanel, setShowGroupPanel] = useState(false)
  const [newGroupName,   setNewGroupName]   = useState('')
  const [assigningTrack, setAssigningTrack] = useState(null) // track.id whose dropdown is open
  const { playTrack, playNext, setShuffle, currentTrack, isPlaying, setQueue, queue,
          setGroupsEnabled: setPlayerGroupsEnabled } = usePlayer()

  useEffect(() => { loadTracks() }, [playlist.id])
  useEffect(() => { loadGroups() }, [playlist.id])
  // Sync player groups setting whenever we enter this playlist page
  useEffect(() => {
    setPlayerGroupsEnabled(playlist.groups_enabled || false)
  }, [playlist.id])

  // Close group assignment dropdown on outside click
  useEffect(() => {
    if (!assigningTrack) return
    function onDown() { setAssigningTrack(null) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [assigningTrack])

  async function loadTracks() {
    if (!window.electron) return
    const t = await window.electron.playlists.getTracks(playlist.id)
    setTracks(t || [])
  }

  async function loadGroups() {
    if (!window.electron) return
    const g = await window.electron.playlists.getGroups(playlist.id)
    setGroups(g || [])
  }

  async function handleRemove(trackId) {
    if (!window.electron) return
    await window.electron.playlists.removeTrack(playlist.id, trackId)
    setTracks(prev => prev.filter(t => t.id !== trackId))
  }

  function handlePlay(track) { setPlayerGroupsEnabled(groupsEnabled); playTrack(track, tracks) }
  function handlePlayAll() {
    if (!tracks.length) return
    setPlayerGroupsEnabled(groupsEnabled)
    playTrack(tracks[0], tracks)
  }
  function handleShuffle() {
    if (!tracks.length) return
    setPlayerGroupsEnabled(groupsEnabled)
    setShuffle(true)
    playTrack(tracks[Math.floor(Math.random() * tracks.length)], tracks)
  }

  async function handleToggleGroups() {
    if (!window.electron) return
    const updated = await window.electron.playlists.toggleGroups(playlist.id)
    const newEnabled = updated?.groups_enabled || false
    playlist.groups_enabled = newEnabled
    setGroupsEnabled(newEnabled)
    setPlayerGroupsEnabled(newEnabled)
  }

  async function handleCreateGroup() {
    if (!window.electron || !newGroupName.trim()) return
    const g = await window.electron.playlists.createGroup(playlist.id, newGroupName.trim())
    setGroups(prev => [...prev, g])
    setNewGroupName('')
  }

  async function handleDeleteGroup(groupId) {
    if (!window.electron) return
    await window.electron.playlists.deleteGroup(groupId)
    setGroups(prev => prev.filter(g => g.id !== groupId))
    setTracks(prev => prev.map(t => t.group_id === groupId ? { ...t, group_id: null, group_position: 0 } : t))
  }

  async function handleSetTrackGroup(trackId, groupId) {
    if (!window.electron) return
    await window.electron.playlists.setTrackGroup(playlist.id, trackId, groupId)
    let updatedTracks
    if (!groupId) {
      updatedTracks = tracks.map(t => t.id === trackId ? { ...t, group_id: null, group_position: 0 } : t)
    } else {
      const maxPos = tracks.filter(t => t.group_id === groupId).reduce((m, t) => Math.max(m, t.group_position ?? -1), -1)
      updatedTracks = tracks.map(t => t.id === trackId ? { ...t, group_id: groupId, group_position: maxPos + 1 } : t)
    }
    setTracks(updatedTracks)
    // Sync to player queue if this playlist is currently loaded
    if (queue.some(qt => qt.id === trackId)) {
      const upd = updatedTracks.find(t => t.id === trackId)
      setQueue(queue.map(qt => qt.id === trackId ? upd : qt))
    }
    setAssigningTrack(null)
  }

  async function handleExport() {
    if (!window.electron) return
    setExporting(true)
    const res = await window.electron.playlists.export(playlist.id)
    setExporting(false)
    if (res?.ok) {
      setExportToast(`Exportada — ${res.trackCount} faixas`)
      setTimeout(() => setExportToast(null), 3000)
    } else if (!res?.canceled) {
      setExportToast(res?.error || 'Erro ao exportar')
      setTimeout(() => setExportToast(null), 3000)
    }
  }

  async function handleCoverSave() {
    if (!window.electron) return
    await window.electron.playlists.update({ id: playlist.id, name: playlist.name, cover_url: coverInput })
    playlist.cover_url = coverInput
    setEditingCover(false)
  }

  async function handleChooseCoverFile() {
    if (!window.electron) return
    const p = await window.electron.playlists.chooseCover()
    if (p) setCoverInput(`file://${p}`)
  }

  const coverSrc    = coverInput || playlist.cover_url
  const currentIds  = tracks.map(t => t.id)

  const filteredTracks = search.trim()
    ? tracks.filter(t => (t.title + t.artist).toLowerCase().includes(search.toLowerCase()))
    : tracks

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Back nav */}
      <div className="shrink-0 px-4 pt-3 pb-0">
        <button onClick={onBack} className="btn-ghost px-2 py-1.5 text-white/60 hover:text-white flex items-center gap-1.5 text-sm">
          <ArrowLeft size={15} /> Voltar
        </button>
      </div>

      {/* Header */}
      <div className="shrink-0 p-6 pt-3 flex items-end gap-5">

        {/* Cover */}
        <div className="group relative w-28 h-28 rounded-xl overflow-hidden bg-surface-700 shrink-0 cursor-pointer" onClick={() => setEditingCover(e => !e)}>
          {coverSrc
            ? <img src={coverSrc} alt={playlist.name} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-white/10">♫</div>
          }
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Pencil size={18} className="text-white" />
          </div>
        </div>

        {editingCover && (
          <div className="absolute left-48 top-14 z-40 bg-surface-800 border border-white/10 rounded-xl p-4 w-80 flex flex-col gap-2 shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-xs text-white/50 font-medium">URL ou caminho da capa</p>
            <input autoFocus value={coverInput} onChange={e => setCoverInput(e.target.value)} className="input-base text-xs" placeholder="https://... ou file://..." />
            <div className="flex gap-2">
              <button onClick={handleChooseCoverFile} className="btn-ghost text-xs px-2 py-1 flex items-center gap-1">
                <Search size={10} /> Arquivo
              </button>
              <button onClick={() => window.electron?.playlists.searchImageBrowser(playlist.name)} className="btn-ghost text-xs px-2 py-1 flex items-center gap-1">
                <ExternalLink size={10} /> Google
              </button>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingCover(false)} className="btn-ghost text-xs px-3 py-1">Cancelar</button>
              <button onClick={handleCoverSave} className="btn-primary text-xs px-3 py-1">Salvar</button>
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0 mt-2">
          <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Playlist</p>
          <h1 className="text-2xl font-bold text-white truncate">{playlist.name}</h1>
          <p className="text-sm text-white/40 mt-1">
            {tracks.length} faixa{tracks.length !== 1 ? 's' : ''}
            {tracks.length > 0 && (
              <span className="ml-2 text-white/25">· {formatTotalDuration(tracks.reduce((s, t) => s + (t.duration || 0), 0))}</span>
            )}
          </p>

          <div className="flex items-center gap-2 mt-4">
            <button onClick={handlePlayAll} disabled={!tracks.length} className="btn-primary flex items-center gap-2 text-sm px-4 py-2 disabled:opacity-40">
              <Play size={14} fill="white" /> Reproduzir
            </button>
            <button onClick={handleShuffle} disabled={!tracks.length} className="btn-ghost flex items-center gap-2 text-sm px-4 py-2 disabled:opacity-40">
              <Shuffle size={14} /> Aleatório
            </button>
            <button onClick={() => setShowEqualize(true)} disabled={tracks.length < 2} className="btn-ghost flex items-center gap-2 text-sm px-4 py-2 disabled:opacity-40">
              <SlidersHorizontal size={14} /> Equalizar
            </button>
            <button onClick={() => setShowAdd(true)} className="btn-ghost flex items-center gap-2 text-sm px-4 py-2">
              <Plus size={14} /> Adicionar
            </button>
            <button onClick={handleExport} disabled={exporting || !tracks.length} className="btn-ghost flex items-center gap-2 text-sm px-4 py-2 disabled:opacity-40" title="Exportar playlist">
              <Download size={14} /> {exporting ? 'Exportando...' : 'Exportar'}
            </button>
            <button
              onClick={handleToggleGroups}
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors ${
                groupsEnabled
                  ? 'bg-brand-600/20 border border-brand-500/40 text-brand-300 hover:bg-brand-600/30'
                  : 'btn-ghost text-white/60'
              }`}
              title={groupsEnabled ? 'Grupos ativados — clique para desativar' : 'Ativar grupos de sequência'}
            >
              <Tag size={14} /> Grupos{groupsEnabled ? ' ●' : ''}
            </button>
            {(() => {
              const missing = tracks.filter(t => !t.file_path)
              return missing.length > 0 ? (
                <button
                  onClick={() => setShowMissing(true)}
                  className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition-colors"
                >
                  <DownloadCloud size={14} /> Baixar faltantes ({missing.length})
                </button>
              ) : null
            })()}
          </div>
        </div>
      </div>

      {/* Export toast */}
      {exportToast && (
        <div className="fixed bottom-24 right-6 z-50 px-4 py-2.5 rounded-xl text-sm shadow-xl bg-green-600/90 text-white">
          {exportToast}
        </div>
      )}

      {/* Groups panel */}
      {groupsEnabled && (
        <div className="px-6 pb-3 shrink-0">
          <div className="bg-surface-700/50 border border-white/8 rounded-xl p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-brand-300 flex items-center gap-1.5">
                <Tag size={11} /> Grupos de sequência
              </p>
              <button
                onClick={() => setShowGroupPanel(p => !p)}
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                {showGroupPanel ? 'Fechar ↑' : 'Gerenciar ↓'}
              </button>
            </div>

            {/* Group chips */}
            <div className="flex flex-wrap gap-1.5">
              {groups.map(g => (
                <div
                  key={g.id}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border"
                  style={{ borderColor: g.color + '50', backgroundColor: g.color + '18', color: g.color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                  <span>{g.name}</span>
                  <span className="text-white/30 ml-0.5">
                    {tracks.filter(t => t.group_id === g.id).length}
                  </span>
                  {showGroupPanel && (
                    <button
                      onClick={() => handleDeleteGroup(g.id)}
                      className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              ))}
              {groups.length === 0 && (
                <p className="text-xs text-white/25 py-0.5">Nenhum grupo criado</p>
              )}
            </div>

            {/* Create group input — only when panel is open */}
            {showGroupPanel && (
              <div className="flex gap-2 pt-0.5">
                <input
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
                  placeholder="Nome do novo grupo..."
                  className="input-base flex-1 text-xs py-1.5"
                />
                <button
                  onClick={handleCreateGroup}
                  disabled={!newGroupName.trim()}
                  className="btn-primary px-3 text-xs disabled:opacity-40 flex items-center gap-1"
                >
                  <Plus size={12} /> Criar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="px-6 pb-3 shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Buscar na playlist..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-base w-full pl-8 text-sm"
          />
        </div>
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {filteredTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-white/20 gap-3">
            <p className="text-sm">{tracks.length === 0 ? 'Playlist vazia' : 'Nenhum resultado'}</p>
            {tracks.length === 0 && (
              <button onClick={() => setShowAdd(true)} className="btn-ghost text-xs px-3 py-1.5 mt-1 text-white/40">
                Adicionar faixas
              </button>
            )}
          </div>
        ) : (() => {
          const groupsMap = groups.reduce((m, g) => { m[g.id] = g; return m }, {})
          return (
            <div className="flex flex-col gap-0.5">
              {filteredTracks.map((track, i) => {
                const active = currentTrack?.id === track.id
                const trackGroup = track.group_id ? groupsMap[track.group_id] : null
                return (
                  <div key={track.id} className="relative">
                    {/* Colored left stripe for group */}
                    {trackGroup && (
                      <div
                        className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full"
                        style={{ backgroundColor: trackGroup.color }}
                      />
                    )}
                    <div
                      onDoubleClick={() => handlePlay(track)}
                      className={`flex items-center gap-3 py-2.5 rounded-lg transition-colors group cursor-pointer
                        ${trackGroup ? 'pl-4 pr-3' : 'px-3'}
                        ${active ? 'bg-brand-600/10' : 'hover:bg-white/5'}`}
                    >
                      {/* Play button — left side, replaces number on hover */}
                      <div className="w-5 shrink-0 flex items-center justify-center">
                        <span className={`text-xs text-white/20 group-hover:hidden ${active ? 'hidden' : ''}`}>{i + 1}</span>
                        <button
                          onClick={() => handlePlay(track)}
                          className={`hidden group-hover:flex items-center justify-center text-brand-400 ${active ? '!flex' : ''}`}
                        >
                          {active && isPlaying
                            ? <span className="text-brand-400 text-xs">▮▮</span>
                            : <Play size={13} fill="currentColor" />
                          }
                        </button>
                      </div>

                      <div className="w-9 h-9 rounded overflow-hidden bg-surface-600 shrink-0">
                        {track.cover_path
                          ? <img src={/^https?:\/\//.test(track.cover_path) ? track.cover_path : `file://${track.cover_path}`} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">♪</div>
                        }
                      </div>

                      <div className="flex-1 overflow-hidden">
                        <p className={`text-sm font-medium truncate ${active ? 'text-brand-300' : 'text-white'}`}>
                          {track.title}
                        </p>
                        <p className="text-xs text-white/40 truncate flex items-center gap-1.5">
                          <span className="truncate">{track.artist}</span>
                          {!track.file_path && <span className="text-amber-400/70 shrink-0">· sem arquivo</span>}
                          {trackGroup && (
                            <span className="shrink-0 text-xs px-1.5 py-0 rounded-full border"
                              style={{ borderColor: trackGroup.color + '50', color: trackGroup.color, backgroundColor: trackGroup.color + '15' }}>
                              {trackGroup.name}
                            </span>
                          )}
                        </p>
                      </div>

                      {track.gain != null && track.gain !== 0 && (
                        <span className="text-xs text-brand-400/60 shrink-0">{track.gain > 0 ? '+' : ''}{track.gain}dB</span>
                      )}

                      {/* Play next */}
                      <button
                        onClick={e => { e.stopPropagation(); playNext(track) }}
                        className="opacity-0 group-hover:opacity-100 btn-ghost p-1 text-white/30 hover:text-brand-400 transition-all shrink-0"
                        title="Tocar a seguir"
                      >
                        <ListPlus size={13} />
                      </button>

                      {/* Group assignment — only when groups enabled */}
                      {groupsEnabled && (
                        <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            onMouseDown={e => {
                              e.preventDefault()
                              e.stopPropagation()
                              setAssigningTrack(prev => prev === track.id ? null : track.id)
                            }}
                            className={`btn-ghost p-1 transition-all ${
                              trackGroup ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                            style={trackGroup ? { color: trackGroup.color } : {}}
                            title={trackGroup ? `Grupo: ${trackGroup.name}` : 'Adicionar ao grupo'}
                          >
                            <Tag size={12} />
                          </button>
                          {assigningTrack === track.id && (
                            <div
                              className="absolute right-0 bottom-full mb-1 z-30 bg-surface-700 border border-white/10 rounded-xl shadow-2xl min-w-40 py-1 overflow-hidden"
                              onMouseDown={e => e.stopPropagation()}
                            >
                              {groups.map(g => (
                                <button
                                  key={g.id}
                                  onClick={() => handleSetTrackGroup(track.id, g.id === track.group_id ? null : g.id)}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 text-left text-xs"
                                  style={{ color: g.color }}
                                >
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                                  <span className="flex-1">{g.name}</span>
                                  {track.group_id === g.id && <Check size={10} className="shrink-0" />}
                                </button>
                              ))}
                              {track.group_id && (
                                <button
                                  onClick={() => handleSetTrackGroup(track.id, null)}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 text-left text-xs text-white/40 border-t border-white/5 mt-1 pt-2"
                                >
                                  <X size={11} /> Remover do grupo
                                </button>
                              )}
                              {groups.length === 0 && (
                                <p className="px-3 py-2 text-xs text-white/30">Crie um grupo primeiro</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Maestro */}
                      <button
                        onClick={e => { e.stopPropagation(); setMaestroTrack(track) }}
                        className="opacity-0 group-hover:opacity-100 btn-ghost p-1 text-white/30 hover:text-white transition-all shrink-0"
                        title="Painel do Maestro"
                      >
                        <Settings2 size={13} />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={e => { e.stopPropagation(); handleRemove(track.id) }}
                        className="opacity-0 group-hover:opacity-100 btn-ghost p-1 text-white/30 hover:text-red-400 transition-all shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {maestroTrack && (
        <MaestroModal
          track={maestroTrack}
          onClose={() => setMaestroTrack(null)}
          onSave={async (updated) => {
            if (window.electron) await window.electron.library.updateTrack(updated)
            setTracks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
            setMaestroTrack(null)
          }}
        />
      )}
      {showEqualize && <EqualizeModal playlist={playlist} tracks={tracks} onClose={() => setShowEqualize(false)} />}
      {showMissing && (
        <DownloadMissingModal
          tracks={tracks.filter(t => !t.file_path)}
          onClose={() => setShowMissing(false)}
          onLinked={() => loadTracks()}
        />
      )}
      {showAdd && (
        <AddTracksModal
          playlistId={playlist.id}
          currentTrackIds={currentIds}
          onClose={() => setShowAdd(false)}
          onAdded={loadTracks}
        />
      )}
    </div>
  )
}

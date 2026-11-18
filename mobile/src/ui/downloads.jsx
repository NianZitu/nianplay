// YouTube downloads UI (Android): result rows with a download button that shows progress, the
// "Downloads" screen (queue, cancel, retry, yt-dlp version/update) and small hooks.
import React, { useEffect, useMemo, useState } from 'react'
import { Download, Check, X, RotateCcw, Loader2, ListMusic, Youtube, RefreshCw, ChevronLeft, Trash2, AlertCircle, Link2 } from 'lucide-react'
import {
  getJobs, subscribeJobs, startDownload, cancelDownload, retryDownload, clearFinished, activeCount,
  ytdlpStatus, updateYtdlp, youtubeAvailable, playlistDownloads,
} from '../platform/youtube'
import { urlKey } from '../../../src/renderer/utils/mediaUrl'
import { EmptyState, formatTime, useLibrary, isPlayable, ANDROID } from './common'
import { useShell } from './shell'

export const YT_ENABLED = youtubeAvailable()

export function useDownloadJobs() {
  const [jobs, setJobs] = useState(getJobs)
  useEffect(() => subscribeJobs(setJobs), [])
  return jobs
}

export function useActiveDownloads() {
  return activeCount(useDownloadJobs())
}

// Library tracks by link → whether that song is already on the phone
export function useLibraryByUrl() {
  const [library] = useLibrary()
  return useMemo(() => {
    const map = new Map()
    for (const t of library) {
      const k = urlKey(t.yt_url)
      if (k && (!map.has(k) || isPlayable(t))) map.set(k, t)
    }
    return map
  }, [library])
}

// Round progress (amber) used on download buttons
function Ring({ percent = 0, size = 30 }) {
  const r = size / 2 - 2.5, c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#f59e0b" strokeWidth="2.5" fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, percent)) / 100)} />
    </svg>
  )
}

/** Download button for one YouTube link: ⬇ → progress ring → ✓ (already in the library). */
export function DownloadButton({ url, title, artist = '', trackId = null, onStarted }) {
  const shell = useShell()
  const jobs = useDownloadJobs()
  const byUrl = useLibraryByUrl()
  const key = urlKey(url)
  const job = jobs.find(j => urlKey(j.url) === key)
  const inLibrary = isPlayable(byUrl.get(key))
  const running = job && (job.status === 'queued' || job.status === 'downloading')

  if (inLibrary && !running) {
    return <span className="w-10 h-10 flex items-center justify-center text-brand-400 shrink-0" aria-label="Já está na biblioteca"><Check size={20} /></span>
  }
  if (running) {
    return (
      <button onClick={e => { e.stopPropagation(); cancelDownload(job.id); shell.toast('Download cancelado') }} aria-label="Cancelar download"
        className="relative w-10 h-10 flex items-center justify-center shrink-0">
        {job.status === 'queued' || !job.percent ? <Loader2 size={20} className="animate-spin text-brand-400" /> : <Ring percent={job.percent} />}
        {job.percent > 0 && <span className="absolute text-[9px] font-bold text-brand-300 tabular-nums">{Math.round(job.percent)}</span>}
      </button>
    )
  }
  return (
    <button onClick={async e => {
        e.stopPropagation()
        await startDownload({ url, title, artist, trackId })
        onStarted?.()
        shell.toast(`Baixando "${title || 'música'}"`)
      }}
      aria-label="Baixar" className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/[0.05] border border-white/8 text-white/70 active:bg-white/10">
      {job?.status === 'error' ? <AlertCircle size={18} className="text-red-400" /> : <Download size={18} />}
    </button>
  )
}

/** One YouTube search result (block row: 16:9 thumbnail, title, channel · duration, download). */
export function YoutubeRow({ item }) {
  return (
    <div className="m-row flex items-center gap-3 p-2">
      <div className="w-[92px] h-[52px] rounded-lg overflow-hidden bg-surface-700 shrink-0 relative">
        {item.thumbnail && <img src={item.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover" />}
        {item.duration > 0 && (
          <span className="absolute right-1 bottom-1 px-1 rounded bg-black/75 text-[10px] text-white/90 tabular-nums">{formatTime(item.duration)}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-white/90 leading-snug line-clamp-2">{item.title}</p>
        <p className="text-[12px] text-white/35 truncate mt-0.5">{item.channel}</p>
      </div>
      <DownloadButton url={item.url} title={item.title} artist={item.channel} />
    </div>
  )
}

/** "Baixar este link" card when the search box holds a YouTube link. */
export function LinkCard({ url, isPlaylist }) {
  const shell = useShell()
  const hasVideo = /[?&]v=|youtu\.be\//.test(url)
  const go = async playlist => {
    await startDownload({ url, playlist })
    shell.toast(playlist ? 'Baixando a playlist' : 'Baixando a música')
    shell.navigate({ type: 'downloads' })
  }
  return (
    <div className="mx-3 mt-3 panel p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Link2 size={14} className="text-accent-400" />
        <p className="m-label !text-accent-400/80">Link do YouTube</p>
      </div>
      <p className="text-[13px] text-white/50 break-all line-clamp-2">{url}</p>
      {isPlaylist && !hasVideo && !playlistDownloads() && (
        <p className="text-[12.5px] text-amber-200/80 leading-relaxed">No iPhone dá para baixar uma música por vez. Abra um vídeo da playlist e cole o link dele.</p>
      )}
      <div className="flex gap-2">
        {hasVideo && <button onClick={() => go(false)} className="m-btn-primary"><Download size={17} /> Baixar a música</button>}
        {isPlaylist && playlistDownloads() && <button onClick={() => go(true)} className={hasVideo ? 'm-btn-ghost' : 'm-btn-primary'}><ListMusic size={17} /> {hasVideo ? 'Playlist inteira' : 'Baixar a playlist'}</button>}
      </div>
    </div>
  )
}

const STATUS = {
  queued: ['Na fila', 'text-white/40'],
  downloading: ['Baixando', 'text-brand-300'],
  done: ['Concluído', 'text-accent-400'],
  error: ['Erro', 'text-red-400'],
  cancelled: ['Cancelado', 'text-white/30'],
}

function JobRow({ job }) {
  const [label, color] = STATUS[job.status] || STATUS.queued
  const running = job.status === 'queued' || job.status === 'downloading'
  const eta = job.eta > 0 ? ` · ${formatTime(job.eta)} restantes` : ''
  return (
    <div className={`${running ? 'm-row-active' : 'm-row'} p-3 flex flex-col gap-2`}>
      <div className="flex items-start gap-3">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${job.playlist ? 'bg-accent-600/15 text-accent-400' : 'bg-white/[0.05] text-white/50'}`}>
          {job.playlist ? <ListMusic size={17} /> : <Youtube size={17} />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-white/90 truncate">{job.title || job.url}</p>
          <p className={`text-[12px] ${color} truncate`}>
            {label}
            {job.status === 'downloading' && job.percent > 0 ? ` · ${Math.round(job.percent)}%${eta}` : ''}
            {job.files.length > 0 ? ` · ${job.files.length} música${job.files.length !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        {running ? (
          <button onClick={() => cancelDownload(job.id)} aria-label="Cancelar" className="m-icon-btn -mr-1"><X size={18} /></button>
        ) : (job.status === 'error' || job.status === 'cancelled') ? (
          <button onClick={() => retryDownload(job.id)} aria-label="Tentar de novo" className="m-icon-btn -mr-1"><RotateCcw size={17} /></button>
        ) : null}
      </div>
      {running && (
        <div className="h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
          <div className={`h-full bg-brand-500 rounded-full transition-[width] ${job.status === 'queued' ? 'progress-pulse w-[8%]' : ''}`}
            style={job.status === 'downloading' ? { width: `${Math.max(3, job.percent || 0)}%` } : undefined} />
        </div>
      )}
      {job.error && <p className="text-[12px] text-red-300/80 leading-snug break-words">{job.error}</p>}
      {job.files.length > 0 && job.playlist && (
        <p className="text-[11.5px] text-white/30 leading-snug line-clamp-2">{job.files.map(f => f.title).join(' · ')}</p>
      )}
    </div>
  )
}

function YtdlpCard() {
  const shell = useShell()
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { ytdlpStatus().then(setInfo) }, [])
  async function update() {
    setBusy(true)
    try {
      const r = await updateYtdlp()
      setInfo(i => ({ ...i, version: r.version, ready: true }))
      shell.toast(r.status === 'ALREADY_UP_TO_DATE' ? 'O yt-dlp já está atualizado' : `yt-dlp atualizado (${r.version})`)
    } catch (err) {
      shell.toast(`Não deu para atualizar: ${err?.message || err}`, false, 5000)
    }
    setBusy(false)
  }
  return (
    <div className="mx-3 mt-4 panel p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <RefreshCw size={14} className="text-accent-400" />
        <h2 className="text-sm font-bold text-white/85 flex-1">{ANDROID ? 'yt-dlp' : 'Downloads no iPhone'}</h2>
        <span className={info?.ready ? 'badge-accent !normal-case' : 'badge-muted !normal-case'}>
          {info == null ? 'verificando…' : info.ready ? (info.version || 'pronto') : 'indisponível'}
        </span>
      </div>
      <p className="text-[12.5px] text-white/35 leading-relaxed">
        {ANDROID
          ? 'O programa que baixa do YouTube roda no próprio celular. Se os downloads começarem a falhar, atualize — o YouTube muda com frequência.'
          : 'As músicas são baixadas em M4A (AAC), com capa e nome. Se os downloads começarem a falhar, o YouTube mudou algo: a correção vem numa versão nova do app.'}
      </p>
      {info?.error && <p className="text-[12px] text-red-300/80">{info.error}</p>}
      {ANDROID && (
        <button onClick={update} disabled={busy} className="m-btn-ghost">
          {busy ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={16} />} Atualizar o yt-dlp
        </button>
      )}
    </div>
  )
}

/** Downloads screen (opened from Biblioteca / Buscar / Perfil). */
export default function Downloads() {
  const shell = useShell()
  const jobs = useDownloadJobs()
  const running = jobs.filter(j => j.status === 'queued' || j.status === 'downloading')
  const finished = jobs.filter(j => !(j.status === 'queued' || j.status === 'downloading'))
  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="sticky top-0 z-10 bg-surface-900/95 backdrop-blur-md border-b border-white/[0.05] flex items-center gap-2 px-2 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 6px)' }}>
        <button onClick={shell.back} aria-label="Voltar"
          className="h-9 pl-1.5 pr-3 rounded-xl flex items-center gap-0.5 text-[13px] font-medium text-white/70 border border-white/8 bg-white/[0.04] active:scale-95 transition-transform">
          <ChevronLeft size={20} /> Voltar
        </button>
        <p className="flex-1 text-[15px] font-bold text-white text-center">Downloads</p>
        <button onClick={clearFinished} disabled={!finished.length} aria-label="Limpar concluídos" className="m-icon-btn"><Trash2 size={17} /></button>
      </div>

      {!jobs.length ? (
        <EmptyState icon={Download} title="Nenhum download"
          desc="Procure músicas na aba Buscar → YouTube, cole um link, ou baixe as que faltam nas suas playlists." />
      ) : (
        <>
          {running.length > 0 && (
            <section className="mt-3">
              <p className="m-label px-4 pb-2">Em andamento · {running.length}</p>
              <div className="px-2 flex flex-col gap-1.5">{running.map(j => <JobRow key={j.id} job={j} />)}</div>
            </section>
          )}
          {finished.length > 0 && (
            <section className="mt-4">
              <p className="m-label px-4 pb-2">Terminados · {finished.length}</p>
              <div className="px-2 flex flex-col gap-1.5">{finished.map(j => <JobRow key={j.id} job={j} />)}</div>
            </section>
          )}
        </>
      )}
      <YtdlpCard />
      <div style={{ height: 'calc(env(safe-area-inset-bottom) + 170px)' }} />
    </div>
  )
}

/** Header icon with the number of running downloads (Biblioteca / Buscar). */
export function DownloadsIcon() {
  const shell = useShell()
  const active = useActiveDownloads()
  if (!YT_ENABLED) return null
  return (
    <button onClick={() => shell.navigate({ type: 'downloads' })} aria-label="Downloads"
      className="relative w-9 h-9 rounded-xl flex items-center justify-center text-white/60 border border-white/8 bg-white/[0.04] active:bg-white/10 shrink-0">
      <Download size={17} />
      {active > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">{active}</span>
      )}
    </button>
  )
}

export { startDownload }

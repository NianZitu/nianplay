// iPhone app shell — Spotify-style navigation: 3 tabs (Início, Buscar, Sua Biblioteca), each with
// its own page stack; floating mini player; full-screen player; account opened from the avatar.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { PlayerProvider, usePlayer, usePlayerProgress } from '../../../src/renderer/store/PlayerContext'
import { AuthProvider } from '../../../src/renderer/contexts/AuthContext'
import { importFiles as importAudioFiles, scanDocuments, AUDIO_EXT } from '../platform/media'
import { notifyLibraryChanged } from '../platform/api'
import { mediaUrl } from '../platform/paths'
import { ShellContext } from './shell'
import { Toast, useToast, PromptSheet, Sheet } from './common'
import { MiniPlayer, TabBar } from './MiniPlayer'
import { loadRecent } from './playContext'
import NowPlaying from './NowPlaying'
import Home from './screens/Home'
import Search from './screens/Search'
import Library from './screens/Library'
import Collection from './screens/Collection'
import Account from './screens/Account'

function summaryText(s) {
  const parts = []
  if (s.added) parts.push(`${s.added} nova${s.added > 1 ? 's' : ''}`)
  if (s.linked) parts.push(`${s.linked} ligada${s.linked > 1 ? 's' : ''} às suas playlists`)
  if (s.duplicate) parts.push(`${s.duplicate} já estava${s.duplicate > 1 ? 'm' : ''} na biblioteca`)
  if (s.missing) parts.push(`${s.missing} removida${s.missing > 1 ? 's' : ''} da pasta`)
  if (s.failed) parts.push(`${s.failed} com erro`)
  return parts.length ? `Músicas: ${parts.join(', ')}.` : 'Nenhuma música nova encontrada.'
}

function HelpSheet({ onClose }) {
  const Step = ({ n, children }) => (
    <div className="flex gap-3"><span className="w-6 h-6 rounded-full bg-brand-500 text-surface-900 text-xs font-bold flex items-center justify-center shrink-0">{n}</span><p className="text-sm text-white/75 leading-relaxed">{children}</p></div>
  )
  return (
    <Sheet title="Colocar músicas no iPhone" onClose={onClose} tall>
      <div className="px-5 pb-6 flex flex-col gap-4">
        <p className="text-sm font-bold text-white">Pelo computador (Windows)</p>
        <Step n={1}>Conecte o iPhone no PC e abra o app <b>Dispositivos Apple</b> (ou o iTunes).</Step>
        <Step n={2}>Entre no iPhone → <b>Arquivos</b> → <b>NianPlay</b>.</Step>
        <Step n={3}>Arraste a sua pasta de músicas (MP3) para lá.</Step>
        <Step n={4}>Abra o NianPlay: as músicas entram sozinhas na biblioteca e são ligadas às playlists que vieram da nuvem.</Step>
        <p className="text-sm font-bold text-white pt-2">Pelo próprio iPhone</p>
        <Step n={1}>No app <b>Arquivos</b>, copie as músicas para <b>No meu iPhone › NianPlay</b>, ou</Step>
        <Step n={2}>use <b>Importar do app Arquivos</b> em Todas as músicas para escolher arquivos de qualquer lugar (iCloud Drive, Google Drive…).</Step>
        <p className="text-xs text-white/40 leading-relaxed pt-2">
          Dica: entre na sua conta e use "Baixar da nuvem" antes — assim cada arquivo é ligado à música certa das suas playlists.
        </p>
      </div>
    </Sheet>
  )
}

// Lock screen / Control Center controls
function useMediaSession() {
  const { currentTrack, isPlaying, togglePlay, skipNext, skipPrev, seek } = usePlayer()
  const { duration } = usePlayerProgress()
  const refs = useRef({})
  refs.current = { isPlaying, togglePlay, skipNext, skipPrev, seek, duration }
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const ms = navigator.mediaSession
    const set = (a, fn) => { try { ms.setActionHandler(a, fn) } catch {} }
    set('play', () => { if (!refs.current.isPlaying) refs.current.togglePlay() })
    set('pause', () => { if (refs.current.isPlaying) refs.current.togglePlay() })
    set('nexttrack', () => refs.current.skipNext())
    set('previoustrack', () => refs.current.skipPrev())
    set('seekto', d => { if (refs.current.duration) refs.current.seek(d.seekTime / refs.current.duration) })
  }, [])
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack || typeof MediaMetadata === 'undefined') return
    const art = currentTrack.cover_path ? mediaUrl(currentTrack.cover_path) : ''
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title || '', artist: currentTrack.artist || '', album: currentTrack.album || '',
      artwork: art ? [{ src: art, sizes: '600x600', type: 'image/jpeg' }] : [],
    })
  }, [currentTrack?.id, currentTrack?.cover_path])
  useEffect(() => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
  }, [isPlaying])
}

function Shell() {
  const [tab, setTab] = useState('home')
  const [stacks, setStacks] = useState({ home: [], search: [], library: [] })
  const [nowOpen, setNowOpen] = useState(false)
  const [toast, showToast] = useToast()
  const [prompt, setPrompt] = useState(null)
  const [help, setHelp] = useState(false)
  const [progress, setProgress] = useState(null)
  const [showMissing, setShowMissingState] = useState(true)
  const fileInput = useRef(null)
  const busy = useRef(false)
  useMediaSession()

  useEffect(() => {
    loadRecent()
    window.electron.settings.get('mobileShowMissing').then(v => { if (v === false) setShowMissingState(false) })
    // Music the user dropped in the app's folder since last time
    scanDocuments().then(s => { if (s.added || s.linked) showToast(summaryText(s)) }).catch(() => {})
  }, [showToast])

  const navigate = useCallback(page => setStacks(s => ({ ...s, [tab]: [...s[tab], page] })), [tab])
  const back = useCallback(() => setStacks(s => ({ ...s, [tab]: s[tab].slice(0, -1) })), [tab])
  const onTab = id => {
    if (id === tab) setStacks(s => ({ ...s, [id]: [] }))   // tap the active tab → back to its start
    else setTab(id)
  }

  async function runImport(fn) {
    if (busy.current) return
    busy.current = true
    setProgress({ done: 0, total: 0, name: '' })
    try { showToast(summaryText(await fn(p => setProgress(p))), true, 4500) }
    catch (err) { showToast(`Erro: ${err.message}`, false) }
    finally { busy.current = false; setProgress(null) }
  }

  const shell = useMemo(() => ({
    navigate, back,
    toast: showToast,
    prompt: opts => setPrompt(opts),
    showHelp: () => setHelp(true),
    importFiles: () => fileInput.current?.click(),
    scanDocs: () => runImport(scanDocuments),
    notifyLibrary: notifyLibraryChanged,
    showMissing,
    setShowMissing: v => { setShowMissingState(v); window.electron.settings.set('mobileShowMissing', v) },
  }), [navigate, back, showToast, showMissing])

  const top = stacks[tab][stacks[tab].length - 1]
  let screen
  if (top?.type === 'account') screen = <Account />
  else if (top) screen = <Collection key={`${top.type}-${top.id || top.name || ''}`} page={top} />
  else screen = tab === 'home' ? <Home /> : tab === 'search' ? <Search /> : <Library />

  return (
    <ShellContext.Provider value={shell}>
      <div className="fixed inset-0 bg-surface-900 text-white">
        <div className="absolute inset-0">{screen}</div>

        {/* Bottom: import progress, mini player, tabs */}
        <div className="absolute left-0 right-0 bottom-0 z-30">
          {progress && (
            <div className="mx-2 mb-1.5 rounded-lg bg-surface-700/95 border border-white/10 px-3 py-2.5 flex items-center gap-3">
              <Loader2 size={18} className="animate-spin text-brand-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-white">Adicionando músicas{progress.total ? ` ${Math.min(progress.done + 1, progress.total)} de ${progress.total}` : '…'}</p>
                {progress.name && <p className="text-[11px] text-white/45 truncate">{progress.name}</p>}
              </div>
            </div>
          )}
          <MiniPlayer onOpen={() => setNowOpen(true)} />
          <TabBar tab={tab} onTab={onTab} />
        </div>

        {nowOpen && <NowPlaying onClose={() => setNowOpen(false)} />}
        {prompt && <PromptSheet {...prompt} onClose={() => setPrompt(null)} />}
        {help && <HelpSheet onClose={() => setHelp(false)} />}
        <Toast toast={toast} />

        <input ref={fileInput} type="file" multiple accept={[...AUDIO_EXT].join(',') + ',audio/*'} className="hidden"
          onChange={e => {
            const files = [...e.target.files]
            e.target.value = ''
            if (files.length) runImport(p => importAudioFiles(files, p))
          }} />
      </div>
    </ShellContext.Provider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <PlayerProvider>
        <Shell />
      </PlayerProvider>
    </AuthProvider>
  )
}

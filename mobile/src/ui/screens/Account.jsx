// Perfil e ajustes (opened from the avatar, like Spotify).
//
// Cloud: only "Baixar da nuvem". The desktop's "Enviar para nuvem" REPLACES everything in the cloud
// with the local library — from a phone that may hold only part of the music it would wipe the
// playlists built on the PC, so sending stays a desktop action.
import React, { useEffect, useState } from 'react'
import { ChevronLeft, User, DownloadCloud, Loader2, LogOut, Download, FolderSearch, HelpCircle, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '../../../../src/renderer/contexts/AuthContext'
import { usePlayer } from '../../../../src/renderer/store/PlayerContext'
import { notifyLibraryChanged } from '../../platform/api'
import { useShell } from '../shell'

const FRAME_COLOR = { classic: '#d97706', neon: '#22d3ee', sunset: '#fb7185', mint: '#34d399' }

export function Avatar({ size = 32 }) {
  const { user, accountProfile } = useAuth() || {}
  const name = accountProfile?.displayName || user?.displayName || user?.email || ''
  const img = accountProfile?.avatarDataUrl
  const ring = FRAME_COLOR[accountProfile?.frame] || FRAME_COLOR.classic
  return (
    <span className="rounded-full overflow-hidden flex items-center justify-center shrink-0 font-bold text-surface-900"
      style={{ width: size, height: size, backgroundColor: user ? ring : 'rgba(255,255,255,0.15)', fontSize: size * 0.45 }}>
      {img ? <img src={img} alt="" className="w-full h-full object-cover" />
        : user ? (name[0] || '?').toUpperCase() : <User size={size * 0.55} className="text-white/80" />}
    </span>
  )
}

const AUTH_ERRORS = {
  'auth/invalid-email': 'E-mail inválido.',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'Não existe conta com esse e-mail.',
  'auth/email-already-in-use': 'Já existe uma conta com esse e-mail.',
  'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  'auth/network-request-failed': 'Sem conexão com a internet.',
  'auth/too-many-requests': 'Muitas tentativas. Espere um pouco e tente de novo.',
}
const authMessage = e => AUTH_ERRORS[e?.code] || e?.message || 'Não foi possível entrar.'

function LoginForm() {
  const { login, register, sendPasswordReset } = useAuth()
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function submit() {
    setError(''); setInfo(''); setBusy(true)
    const timeout = new Promise((_, rej) => setTimeout(() => rej({ code: 'nianplay/timeout' }), 20000))
    try {
      await Promise.race([
        mode === 'login' ? login(email.trim(), password) : register(email.trim(), password, name.trim()),
        timeout,
      ])
    } catch (e) { setError(e?.code === 'nianplay/timeout' ? 'O servidor não respondeu. Confira a internet e tente de novo.' : authMessage(e)) }
    setBusy(false)
  }
  async function reset() {
    if (!email.trim()) { setError('Digite seu e-mail para receber o link.'); return }
    try { await sendPasswordReset(email.trim()); setInfo('Enviamos um link para redefinir a senha.') } catch (e) { setError(authMessage(e)) }
  }

  return (
    <div className="px-5 flex flex-col gap-3">
      <p className="text-2xl font-black text-white tracking-tight">{mode === 'login' ? 'Entrar no NianPlay' : 'Criar conta'}</p>
      <p className="text-sm text-white/55 leading-relaxed -mt-1">Use a mesma conta do computador para trazer suas playlists.</p>
      {mode === 'register' && <input className="m-input" placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />}
      <input className="m-input" placeholder="E-mail" type="email" inputMode="email" autoCapitalize="none" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
      <input className="m-input" placeholder="Senha" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password}
        onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      {info && <p className="text-sm text-green-400">{info}</p>}
      <button onClick={submit} disabled={busy || !email || !password} className="m-btn-primary">
        {busy ? <Loader2 size={18} className="animate-spin mx-auto" /> : mode === 'login' ? 'Entrar' : 'Criar conta'}
      </button>
      {mode === 'login' && <button onClick={reset} className="text-sm text-white/60 py-1">Esqueci minha senha</button>}
      <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }} className="text-sm text-white py-1 font-semibold">
        {mode === 'login' ? 'Não tem conta? Criar conta' : 'Já tem conta? Entrar'}
      </button>
      <p className="text-xs text-white/35 leading-relaxed">O login com Google não está disponível no iPhone — use e-mail e senha.</p>
    </div>
  )
}

function Row({ icon: Icon, label, sub, onPress, right }) {
  return (
    <button onClick={onPress} className="w-full flex items-center gap-4 px-5 py-3.5 text-left active:bg-white/5">
      {Icon && <Icon size={22} strokeWidth={1.75} className="text-white/60 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] text-white">{label}</p>
        {sub && <p className="text-[13px] text-white/45 mt-0.5 leading-snug">{sub}</p>}
      </div>
      {right}
    </button>
  )
}

const Title = ({ children }) => <p className="px-5 pt-6 pb-1 text-base font-bold text-white">{children}</p>

export default function Account() {
  const shell = useShell()
  const { user, accountProfile, syncFromCloud, syncStatus, logout } = useAuth()
  const [version, setVersion] = useState('')
  const [webAudio, setWebAudio] = useState(window.nianplayPlatform?.webAudio !== false)
  const [savedWebAudio] = useState(webAudio)

  useEffect(() => { window.electron.app.getVersion().then(setVersion) }, [])

  // Firebase normally answers "logged in or not" in under a second. If it doesn't (no internet,
  // blocked request), show the form with a notice instead of spinning forever.
  const [authSlow, setAuthSlow] = useState(false)
  useEffect(() => {
    if (user !== undefined) { setAuthSlow(false); return }
    const t = setTimeout(() => setAuthSlow(true), 10000)
    return () => clearTimeout(t)
  }, [user])

  async function download() {
    await syncFromCloud()
    notifyLibraryChanged()
  }
  useEffect(() => {
    if (syncStatus?.lastSync && !syncStatus.downloading && !syncStatus.error) shell.toast('Biblioteca atualizada com a nuvem')
  }, [syncStatus?.lastSync])

  // Applies immediately: the next gain update of the current song uses the new level
  const { currentTrack, updateQueuedTrack } = usePlayer()
  const [outputGain, setOutputGain] = useState(Number(window.nianplayPlatform?.outputGain ?? 0.5))
  async function setOutput(v) {
    setOutputGain(v)
    window.nianplayPlatform.outputGain = v
    if (currentTrack) updateQueuedTrack(currentTrack)
    await window.electron.settings.set('mobileVolume', v)
  }

  async function toggleWebAudio() {
    const next = !webAudio
    setWebAudio(next)
    await window.electron.settings.set('mobileWebAudio', next)
  }

  const name = accountProfile?.displayName || user?.displayName || user?.email?.split('@')[0]

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="sticky top-0 z-10 bg-surface-900 flex items-center gap-2 px-2 pb-2" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 6px)' }}>
        <button onClick={shell.back} aria-label="Voltar" className="w-10 h-10 flex items-center justify-center text-white"><ChevronLeft size={26} /></button>
        <p className="text-base font-bold text-white">Perfil e ajustes</p>
      </div>

      {user === undefined && !authSlow ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-white/50" /></div>
      ) : user === undefined ? (
        <div className="pt-4">
          <p className="mx-5 mb-4 rounded-lg bg-amber-500/10 border border-amber-400/30 px-4 py-3 text-sm text-amber-200 leading-relaxed">
            A conta está demorando para responder. Confira a internet — você pode tentar entrar mesmo assim.
          </p>
          <LoginForm />
        </div>
      ) : !user ? (
        <div className="pt-4"><LoginForm /></div>
      ) : (
        <>
          <div className="flex items-center gap-4 px-5 pt-3 pb-2">
            <Avatar size={60} />
            <div className="min-w-0">
              <p className="text-xl font-bold text-white truncate">{name}</p>
              <p className="text-[13px] text-white/50 truncate">{user.email}</p>
            </div>
          </div>

          <Title>Nuvem</Title>
          <Row icon={syncStatus?.downloading ? Loader2 : DownloadCloud}
            label={syncStatus?.downloading ? 'Baixando da nuvem…' : 'Baixar da nuvem'}
            sub="Traz suas playlists, links, ganhos e letras salvos pelo computador. Músicas sem arquivo neste iPhone aparecem esmaecidas até você importar os arquivos."
            onPress={syncStatus?.downloading ? undefined : download} />
          {syncStatus?.error && <p className="px-5 text-sm text-red-400">Erro: {syncStatus.error}</p>}
          <p className="px-5 pt-1 text-xs text-white/35 leading-relaxed">Para enviar alterações para a nuvem, use o NianPlay no computador.</p>
        </>
      )}

      <Title>Músicas neste iPhone</Title>
      <Row icon={Download} label="Importar do app Arquivos" sub="Copia os arquivos escolhidos para dentro do NianPlay." onPress={shell.importFiles} />
      <Row icon={FolderSearch} label="Procurar na pasta do NianPlay" sub='Lê as músicas colocadas em "No meu iPhone › NianPlay".' onPress={shell.scanDocs} />
      <Row icon={HelpCircle} label="Como copiar músicas pelo computador" onPress={shell.showHelp} />

      <Title>Reprodução</Title>
      <Row icon={SlidersHorizontal} label="Equalização de volume (LUFS)"
        sub={`Aplica o ganho de cada música calculado no computador.${webAudio !== savedWebAudio ? ' Vale ao reabrir o app.' : ' Se a música parar quando a tela bloqueia, desligue.'}`}
        onPress={toggleWebAudio}
        right={<span className={`w-12 h-7 rounded-full p-0.5 transition-colors shrink-0 ${webAudio ? 'bg-brand-500' : 'bg-white/20'}`}>
          <span className={`block w-6 h-6 rounded-full bg-white transition-transform ${webAudio ? 'translate-x-5' : ''}`} />
        </span>} />

      <div className="px-5 py-3.5">
        <p className="text-[15px] text-white">Volume do NianPlay</p>
        <p className="text-[13px] text-white/45 mt-0.5 leading-snug">
          {webAudio ? 'Deixa todas as músicas mais baixas, para controlar melhor pelo volume do iPhone.'
            : 'Só funciona com a equalização de volume ligada.'}
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[0.25, 0.5, 0.75, 1].map(v => (
            <button key={v} disabled={!webAudio} onClick={() => setOutput(v)}
              className={`h-10 rounded-full text-sm font-bold border transition-colors disabled:opacity-35
                ${Math.abs(outputGain - v) < 0.01 ? 'bg-brand-500 border-brand-500 text-surface-900' : 'border-white/25 text-white'}`}>
              {Math.round(v * 100)}%
            </button>
          ))}
        </div>
      </div>

      <Title>Sobre</Title>
      <Row label="Versão" sub={`NianPlay para iPhone ${version}`} />
      {user && <Row icon={LogOut} label="Sair da conta" onPress={logout} />}
      <div style={{ height: 'calc(env(safe-area-inset-bottom) + 160px)' }} />
    </div>
  )
}

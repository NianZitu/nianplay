// Perfil e ajustes (opened from the avatar, like Spotify).
//
// Cloud: only "Baixar da nuvem". The desktop's "Enviar para nuvem" REPLACES everything in the cloud
// with the local library — from a phone that may hold only part of the music it would wipe the
// playlists built on the PC, so sending stays a desktop action.
import React, { useEffect, useState } from 'react'
import { ChevronLeft, User, DownloadCloud, Loader2, LogOut, Download, FolderSearch, HelpCircle, SlidersHorizontal, Cloud, Smartphone, Disc3, Info, Volume2 } from 'lucide-react'
import { useAuth } from '../../../../src/renderer/contexts/AuthContext'
import { usePlayer } from '../../../../src/renderer/store/PlayerContext'
import { notifyLibraryChanged } from '../../platform/api'
import { useShell } from '../shell'

// Same frames as the desktop NavRail avatar (ring color + glow)
const FRAME_STYLE = {
  classic: { border: '#d97706', glow: '0 0 8px rgba(217,119,6,0.35)' },
  neon:    { border: '#22d3ee', glow: '0 0 8px rgba(34,211,238,0.5)' },
  sunset:  { border: '#fb7185', glow: '0 0 8px rgba(251,113,133,0.4)' },
  mint:    { border: '#34d399', glow: '0 0 8px rgba(52,211,153,0.4)' },
}

export function Avatar({ size = 32 }) {
  const { user, accountProfile } = useAuth() || {}
  const name = accountProfile?.displayName || user?.displayName || user?.email || ''
  const img = accountProfile?.avatarDataUrl
  const frame = FRAME_STYLE[accountProfile?.frame] || FRAME_STYLE.classic
  if (!user) {
    return (
      <span className="rounded-xl flex items-center justify-center shrink-0 border border-white/10 bg-white/[0.04] text-white/40"
        style={{ width: size, height: size }}>
        <User size={Math.round(size * 0.45)} />
      </span>
    )
  }
  return (
    <span className="rounded-full p-[2px] shrink-0 flex" style={{ width: size, height: size, border: `2px solid ${frame.border}`, boxShadow: frame.glow }}>
      <span className="w-full h-full rounded-full bg-surface-600 overflow-hidden flex items-center justify-center font-bold text-brand-400"
        style={{ fontSize: size * 0.38 }}>
        {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : (name[0] || '?').toUpperCase()}
      </span>
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
    <div className="mx-3 mt-3 panel p-5 flex flex-col gap-3">
      <p className="m-label">Conta NianPlay</p>
      <p className="text-xl font-black text-white tracking-tight -mt-1.5">{mode === 'login' ? 'Entrar' : 'Criar conta'}</p>
      <p className="text-sm text-white/45 leading-relaxed -mt-1">Use a mesma conta do computador para trazer suas playlists.</p>
      {mode === 'register' && <input className="m-input" placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />}
      <input className="m-input" placeholder="E-mail" type="email" inputMode="email" autoCapitalize="none" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
      <input className="m-input" placeholder="Senha" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password}
        onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      {info && <p className="text-sm text-green-400">{info}</p>}
      <button onClick={submit} disabled={busy || !email || !password} className="m-btn-primary">
        {busy ? <Loader2 size={18} className="animate-spin mx-auto" /> : mode === 'login' ? 'Entrar' : 'Criar conta'}
      </button>
      {mode === 'login' && <button onClick={reset} className="text-sm text-white/45 py-1">Esqueci minha senha</button>}
      <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }} className="m-btn-ghost">
        {mode === 'login' ? 'Não tem conta? Criar conta' : 'Já tem conta? Entrar'}
      </button>
      <p className="text-xs text-white/30 leading-relaxed">O login com Google não está disponível no iPhone — use e-mail e senha.</p>
    </div>
  )
}

function Row({ icon: Icon, label, sub, onPress, right, accent = false }) {
  const Tag = onPress ? 'button' : 'div'
  return (
    <Tag onClick={onPress} className={`w-full flex items-center gap-3.5 px-4 py-3 text-left ${onPress ? 'active:bg-white/5' : ''}`}>
      {Icon && (
        <span className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.05] flex items-center justify-center shrink-0">
          <Icon size={17} strokeWidth={1.75} className={accent ? 'text-accent-400' : 'text-white/55'} />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] text-white/90">{label}</p>
        {sub && <p className="text-[12.5px] text-white/35 mt-0.5 leading-snug">{sub}</p>}
      </div>
      {right}
    </Tag>
  )
}

// A settings section (desktop SettingsPage: panel with an icon + bold title header)
function Section({ icon: Icon, title, color = 'text-brand-500', children }) {
  return (
    <section className="mx-3 mt-3 panel overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6">
        <Icon size={14} className={`shrink-0 ${color}`} />
        <h2 className="text-sm font-bold text-white/85">{title}</h2>
      </div>
      <div className="py-1 divide-y divide-white/[0.04]">{children}</div>
    </section>
  )
}

export default function Account() {
  const shell = useShell()
  const { user, accountProfile, syncFromCloud, syncStatus, logout } = useAuth()
  const [version, setVersion] = useState('')
  // Native player: the LUFS toggle applies at once and the volume always works.
  // Web fallback (old builds / browser): it needs Web Audio, changed only on the next app start.
  const native = Boolean(window.nianplayPlatform?.nativePlayer)
  const [webAudio, setWebAudio] = useState(native ? window.nianplayPlatform.lufs !== false : window.nianplayPlatform?.webAudio !== false)
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
    if (native) {
      window.nianplayPlatform.lufs = next
      if (currentTrack) updateQueuedTrack(currentTrack)
    }
    await window.electron.settings.set('mobileWebAudio', next)
  }

  const name = accountProfile?.displayName || user?.displayName || user?.email?.split('@')[0]

  const toggle = on => (
    <span className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${on ? 'bg-brand-600' : 'bg-white/15'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </span>
  )

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="sticky top-0 z-10 bg-surface-900/95 backdrop-blur-md border-b border-white/[0.05] flex items-center gap-2 px-2 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 6px)' }}>
        <button onClick={shell.back} aria-label="Voltar"
          className="h-9 pl-1.5 pr-3 rounded-xl flex items-center gap-0.5 text-[13px] font-medium text-white/70 border border-white/8 bg-white/[0.04] active:scale-95 transition-transform">
          <ChevronLeft size={20} /> Voltar
        </button>
        <p className="flex-1 text-[15px] font-bold text-white text-center pr-[76px]">Perfil e ajustes</p>
      </div>

      {user === undefined && !authSlow ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-brand-500/70" /></div>
      ) : user === undefined ? (
        <div className="pt-1">
          <p className="mx-3 mt-3 rounded-xl bg-amber-500/10 border border-amber-400/25 px-4 py-3 text-sm text-amber-200/90 leading-relaxed">
            A conta está demorando para responder. Confira a internet — você pode tentar entrar mesmo assim.
          </p>
          <LoginForm />
        </div>
      ) : !user ? (
        <LoginForm />
      ) : (
        <>
          {/* Profile card */}
          <div className="mx-3 mt-3 panel p-4 flex items-center gap-4">
            <Avatar size={58} />
            <div className="min-w-0 flex-1">
              <p className="m-label mb-0.5">Conectado</p>
              <p className="text-lg font-bold text-white truncate">{name}</p>
              <p className="text-[12.5px] text-white/35 truncate">{user.email}</p>
            </div>
          </div>

          <Section icon={Cloud} title="Nuvem" color="text-accent-400">
            <Row icon={syncStatus?.downloading ? Loader2 : DownloadCloud} accent
              label={syncStatus?.downloading ? 'Baixando da nuvem…' : 'Baixar da nuvem'}
              sub="Traz playlists, links, ganhos e letras salvos pelo computador. Músicas sem arquivo neste iPhone aparecem esmaecidas até você importar os arquivos."
              onPress={syncStatus?.downloading ? undefined : download} />
            {syncStatus?.error && <p className="px-4 py-2 text-sm text-red-400">Erro: {syncStatus.error}</p>}
            <p className="px-4 py-2.5 text-xs text-white/30 leading-relaxed">Para enviar alterações para a nuvem, use o NianPlay no computador.</p>
          </Section>
        </>
      )}

      <Section icon={Smartphone} title="Músicas neste iPhone">
        <Row icon={Download} label="Importar do app Arquivos" sub="Copia os arquivos escolhidos para dentro do NianPlay." onPress={shell.importFiles} />
        <Row icon={FolderSearch} label="Procurar na pasta do NianPlay" sub='Lê as músicas colocadas em "No meu iPhone › NianPlay".' onPress={shell.scanDocs} />
        <Row icon={HelpCircle} label="Como copiar músicas pelo computador" onPress={shell.showHelp} />
      </Section>

      <Section icon={Disc3} title="Reprodução">
        <Row icon={SlidersHorizontal} label="Equalização de volume (LUFS)"
          sub={`Aplica o ganho de cada música calculado no computador.${native ? '' : webAudio !== savedWebAudio ? ' Vale ao reabrir o app.' : ' Se a música parar quando a tela bloqueia, desligue.'}`}
          onPress={toggleWebAudio}
          right={toggle(webAudio)} />
        <div className="px-4 py-3">
          <div className="flex items-center gap-3.5">
            <span className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.05] flex items-center justify-center shrink-0">
              <Volume2 size={17} strokeWidth={1.75} className="text-white/55" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] text-white/90">Volume do NianPlay</p>
              <p className="text-[12.5px] text-white/35 mt-0.5 leading-snug">
                {native || webAudio ? 'Deixa todas as músicas mais baixas, para controlar melhor pelo volume do iPhone.'
                  : 'Só funciona com a equalização de volume ligada.'}
              </p>
            </div>
          </div>
          {/* Segmented control */}
          <div className="mt-3 grid grid-cols-4 p-1 gap-1 rounded-xl bg-surface-900/70 border border-white/[0.06]">
            {[0.25, 0.5, 0.75, 1].map(v => {
              const on = Math.abs(outputGain - v) < 0.01
              return (
                <button key={v} disabled={!native && !webAudio} onClick={() => setOutput(v)}
                  className={`h-9 rounded-lg text-sm font-semibold tabular-nums transition-colors disabled:opacity-35
                    ${on ? 'bg-brand-600 text-white shadow-md shadow-black/30' : 'text-white/45 active:bg-white/5'}`}>
                  {Math.round(v * 100)}%
                </button>
              )
            })}
          </div>
        </div>
      </Section>

      <Section icon={Info} title="Sobre" color="text-white/40">
        <Row label="Versão" sub={`NianPlay para iPhone ${version}`} right={<span className="badge-muted">iOS</span>} />
        {user && (
          <button onClick={logout} className="w-full flex items-center gap-3.5 px-4 py-3 text-left text-red-400 active:bg-white/5">
            <span className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0"><LogOut size={17} /></span>
            <span className="text-[15px]">Sair da conta</span>
          </button>
        )}
      </Section>
      <div style={{ height: 'calc(env(safe-area-inset-bottom) + 160px)' }} />
    </div>
  )
}

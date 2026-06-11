import React, { useState } from 'react'
import { X, LogIn, UserPlus, Loader2, Mail, Lock, User, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export default function LoginModal({ onClose }) {
  const { login, register, loginWithGoogle, sendPasswordReset } = useAuth()

  const [tab,      setTab]      = useState('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  function friendlyError(code) {
    const map = {
      'auth/invalid-email':           'E-mail inválido.',
      'auth/user-not-found':          'Usuário não encontrado.',
      'auth/wrong-password':          'Senha incorreta.',
      'auth/email-already-in-use':    'Este e-mail já está cadastrado.',
      'auth/weak-password':           'A senha deve ter pelo menos 6 caracteres.',
      'auth/too-many-requests':       'Muitas tentativas. Aguarde e tente novamente.',
      'auth/network-request-failed':  'Sem conexão. Verifique sua internet.',
      'auth/invalid-credential':      'E-mail ou senha incorretos.',
      'auth/operation-not-allowed':   'Este método de login não está ativado.',
      'auth/configuration-not-found': 'Firebase não configurado corretamente.',
      'auth/argument-error':          'Login com Google não conseguiu abrir. Atualize o app.',
      'auth/unauthorized-domain':     'Domínio não autorizado no Firebase.',
      'auth/popup-closed-by-user':    'Login com Google cancelado.',
      'auth/cancelled-popup-request': 'Login com Google cancelado.',
      'auth/popup-blocked':           'Popup bloqueado. Tente novamente.',
    }
    return map[code] || `Erro (${code || 'desconhecido'}). Verifique os dados e tente novamente.`
  }

  function switchTab(t) {
    setTab(t)
    setError('')
    setSuccess('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      if (tab === 'forgot') {
        await sendPasswordReset(email)
        setSuccess('Link enviado! Verifique sua caixa de entrada.')
      } else if (tab === 'login') {
        await login(email, password)
        onClose()
      } else {
        await register(email, password, name)
        onClose()
      }
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setLoading(true)
    try {
      await loginWithGoogle()
      onClose()
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  const isForgot   = tab === 'forgot'
  const isRegister = tab === 'register'

  return (
    <div className="modal-overlay">
      <div className="modal-box w-full max-w-sm mx-4">

        {/* Cabeçalho */}
        <div className="modal-header">
          <div>
            <h2 className="text-white font-bold text-base">
              {isForgot ? 'Recuperar senha' : isRegister ? 'Criar conta' : 'Entrar na conta'}
            </h2>
            <p className="text-white/35 text-xs mt-0.5">
              {isForgot
                ? 'Enviaremos um link de redefinição por e-mail'
                : 'Sincronize sua biblioteca em qualquer dispositivo'
              }
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1 text-white/35"><X size={16} /></button>
        </div>

        {/* Abas (login / cadastro) */}
        {!isForgot && (
          <div className="flex gap-1.5 px-5 pt-4">
            {[{ id: 'login', label: 'Entrar' }, { id: 'register', label: 'Cadastrar' }].map(t => (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all
                  ${tab === t.id
                    ? 'bg-brand-600 text-white shadow-md shadow-black/20'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-3">

          {isForgot && (
            <button
              type="button"
              onClick={() => switchTab('login')}
              className="flex items-center gap-1.5 text-xs text-white/35 hover:text-brand-400 transition-colors self-start"
            >
              <ArrowLeft size={11} /> Voltar
            </button>
          )}

          {isRegister && (
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="input-base w-full pl-9"
              />
            </div>
          )}

          <div className="relative">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus={isForgot}
              className="input-base w-full pl-9"
            />
          </div>

          {!isForgot && (
            <div>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                <input
                  type="password"
                  placeholder="Senha"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="input-base w-full pl-9"
                />
              </div>
              {!isRegister && (
                <button
                  type="button"
                  onClick={() => switchTab('forgot')}
                  className="text-xs text-white/30 hover:text-brand-400 transition-colors mt-1.5 ml-1"
                >
                  Esqueci minha senha
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2.5 text-red-400 text-xs">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 bg-green-500/8 border border-green-500/20 rounded-xl px-3 py-2.5 text-green-400 text-xs">
              <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
              {success}
            </div>
          )}

          {!success && (
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center justify-center gap-2 py-2.5 w-full mt-1"
            >
              {loading
                ? <Loader2 size={14} className="animate-spin" />
                : isForgot   ? <Mail size={14} />
                : isRegister ? <UserPlus size={14} />
                :              <LogIn size={14} />
              }
              {loading       ? 'Aguarde...'
                : isForgot   ? 'Enviar link de recuperação'
                : isRegister ? 'Criar conta'
                :              'Entrar'}
            </button>
          )}

          {!isForgot && !success && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-white/20 text-xs">ou</span>
                <div className="flex-1 h-px bg-white/8" />
              </div>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="flex items-center justify-center gap-2.5 bg-white/4 hover:bg-white/8
                           border border-white/8 disabled:opacity-50 text-white/80 font-medium
                           py-2.5 rounded-xl text-sm transition-colors"
              >
                <GoogleIcon />
                Continuar com Google
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}

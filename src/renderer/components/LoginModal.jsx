import React, { useState } from 'react'
import { X, LogIn, UserPlus, Loader2, Mail, Lock, User, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

// Google "G" colorido
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export default function LoginModal({ onClose }) {
  const { login, register, loginWithGoogle, sendPasswordReset } = useAuth()

  // 'login' | 'register' | 'forgot'
  const [tab,      setTab]      = useState('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  function friendlyError(code) {
    const map = {
      'auth/invalid-email':            'E-mail inválido.',
      'auth/user-not-found':           'Usuário não encontrado.',
      'auth/wrong-password':           'Senha incorreta.',
      'auth/email-already-in-use':     'Este e-mail já está cadastrado.',
      'auth/weak-password':            'A senha deve ter pelo menos 6 caracteres.',
      'auth/too-many-requests':        'Muitas tentativas. Aguarde e tente novamente.',
      'auth/network-request-failed':   'Sem conexão. Verifique sua internet.',
      'auth/invalid-credential':       'E-mail ou senha incorretos.',
      'auth/operation-not-allowed':    'Este método de login não está ativado. Verifique Firebase Console → Authentication → Sign-in method.',
      'auth/configuration-not-found':  'Firebase não configurado corretamente.',
      'auth/popup-closed-by-user':     'Login com Google cancelado.',
      'auth/cancelled-popup-request':  'Login com Google cancelado.',
      'auth/popup-blocked':            'Popup bloqueado. Tente novamente.',
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
        setSuccess('Link enviado! Verifique sua caixa de entrada para redefinir a senha.')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface-800 border border-white/10 rounded-2xl w-full max-w-sm mx-4 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <div>
            <h2 className="text-white font-semibold text-lg">
              {isForgot ? 'Recuperar senha' : isRegister ? 'Criar conta' : 'Entrar na conta'}
            </h2>
            <p className="text-white/40 text-xs mt-0.5">
              {isForgot
                ? 'Enviaremos um link de redefinição para o seu e-mail'
                : 'Sincronize sua biblioteca em qualquer dispositivo'}
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Tabs — somente para login / cadastro */}
        {!isForgot && (
          <div className="flex p-4 gap-2">
            {['login', 'register'].map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t
                    ? 'bg-brand-600 text-white'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                {t === 'login' ? 'Entrar' : 'Cadastrar'}
              </button>
            ))}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-4 pb-5 flex flex-col gap-3">

          {/* Voltar (forgot) */}
          {isForgot && (
            <button
              type="button"
              onClick={() => switchTab('login')}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-brand-400 transition-colors self-start mt-1"
            >
              <ArrowLeft size={12} /> Voltar para entrar
            </button>
          )}

          {/* Nome (cadastro) */}
          {isRegister && (
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full bg-surface-700 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-500/60"
              />
            </div>
          )}

          {/* E-mail */}
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus={isForgot}
              className="w-full bg-surface-700 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-500/60"
            />
          </div>

          {/* Senha (não aparece no "esqueci") */}
          {!isForgot && (
            <div>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="password"
                  placeholder="Senha"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-surface-700 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-500/60"
                />
              </div>
              {!isRegister && (
                <button
                  type="button"
                  onClick={() => switchTab('forgot')}
                  className="text-xs text-white/35 hover:text-brand-400 transition-colors mt-1.5 ml-0.5"
                >
                  Esqueci minha senha
                </button>
              )}
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-red-400 text-xs">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Sucesso (esqueci senha) */}
          {success && (
            <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2.5 text-green-400 text-xs">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
              {success}
            </div>
          )}

          {/* Botão principal */}
          {!success && (
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition-colors mt-1"
            >
              {loading
                ? <Loader2 size={15} className="animate-spin" />
                : isForgot     ? <Mail size={15} />
                : isRegister   ? <UserPlus size={15} />
                :                <LogIn size={15} />
              }
              {loading        ? 'Aguarde...'
                : isForgot    ? 'Enviar link de recuperação'
                : isRegister  ? 'Criar conta'
                :               'Entrar'}
            </button>
          )}

          {/* Divisor + Botão Google — apenas login/register */}
          {!isForgot && !success && (
            <>
              <div className="flex items-center gap-3 my-0.5">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-white/25 text-xs">ou</span>
                <div className="flex-1 h-px bg-white/8" />
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="flex items-center justify-center gap-2.5 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
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

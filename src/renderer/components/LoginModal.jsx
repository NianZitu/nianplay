import React, { useState } from 'react'
import { X, LogIn, UserPlus, Loader2, Mail, Lock, User, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function LoginModal({ onClose }) {
  const { login, register } = useAuth()
  const [tab,      setTab]      = useState('login')  // 'login' | 'register'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

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
    }
    return map[code] || 'Erro ao autenticar. Verifique os dados e tente novamente.'
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (tab === 'login') {
        await login(email, password)
      } else {
        await register(email, password, name)
      }
      onClose()
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface-800 border border-white/10 rounded-2xl w-full max-w-sm mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <div>
            <h2 className="text-white font-semibold text-lg">
              {tab === 'login' ? 'Entrar na conta' : 'Criar conta'}
            </h2>
            <p className="text-white/40 text-xs mt-0.5">
              Sincronize sua biblioteca em qualquer dispositivo
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-4 gap-2">
          {['login', 'register'].map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError('') }}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-4 pb-5 flex flex-col gap-3">
          {tab === 'register' && (
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={e => setName(e.target.value)}
                required={tab === 'register'}
                className="w-full bg-surface-700 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-500/60"
              />
            </div>
          )}

          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-surface-700 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-500/60"
            />
          </div>

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

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-red-400 text-xs">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition-colors mt-1"
          >
            {loading
              ? <Loader2 size={15} className="animate-spin" />
              : tab === 'login' ? <LogIn size={15} /> : <UserPlus size={15} />
            }
            {loading ? 'Aguarde...' : tab === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
      </div>
    </div>
  )
}

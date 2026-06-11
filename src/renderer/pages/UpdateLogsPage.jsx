import React, { useEffect, useState } from 'react'
import { CheckCircle2, Sparkles } from 'lucide-react'
import { UPDATE_LOGS } from '../data/updateLogs'

export default function UpdateLogsPage() {
  const [currentVersion, setCurrentVersion] = useState('')

  useEffect(() => {
    window.electron?.app?.getVersion?.().then(setCurrentVersion).catch(() => {})
  }, [])

  return (
    <div className="h-full overflow-y-auto p-2.5 pl-3">
      <div className="max-w-3xl mx-auto flex flex-col gap-4 pb-6">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between pt-3">
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">Histórico de atualizações</h1>
            <p className="text-xs text-white/35 mt-0.5">Veja o que mudou em cada versão do NianPlay.</p>
          </div>
          <div className="rounded-xl bg-brand-600/15 border border-brand-500/25 px-3.5 py-2 text-right">
            <p className="text-[10px] uppercase tracking-widest text-brand-400/70 font-bold">Versão atual</p>
            <p className="text-sm font-bold text-brand-300">v{currentVersion || UPDATE_LOGS[0].version}</p>
          </div>
        </div>

        {/* Lista de versões */}
        <div className="flex flex-col gap-3">
          {UPDATE_LOGS.map((log, index) => {
            const isCurrent = currentVersion === log.version || (!currentVersion && index === 0)
            return (
              <section
                key={log.version}
                className={`rounded-2xl p-5 border transition-colors
                  ${isCurrent
                    ? 'bg-brand-600/8 border-brand-500/20'
                    : 'bg-surface-800/70 border-white/5'
                  }`}
              >
                <div className="flex items-start gap-3">
                  {/* Indicador de versão */}
                  <div className="shrink-0 mt-0.5">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${isCurrent ? 'bg-brand-500' : 'bg-white/15'}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-bold text-brand-400">v{log.version}</span>
                      <h2 className="text-sm font-semibold text-white/90">{log.title}</h2>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-600/20
                                         border border-brand-400/20 px-2 py-0.5 text-[10px] text-brand-300 font-semibold">
                          <Sparkles size={9} /> Instalada
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/30 mb-3">{log.date}</p>

                    <ul className="flex flex-col gap-2">
                      {log.changes.map(change => (
                        <li key={change} className="flex items-start gap-2.5 text-sm text-white/65 leading-relaxed">
                          <CheckCircle2 size={13} className={`shrink-0 mt-0.5 ${isCurrent ? 'text-brand-500' : 'text-white/25'}`} />
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

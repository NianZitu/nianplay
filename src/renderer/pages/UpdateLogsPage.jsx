import React, { useEffect, useState } from 'react'
import { CheckCircle2, History, Sparkles } from 'lucide-react'
import { UPDATE_LOGS } from '../data/updateLogs'

export default function UpdateLogsPage() {
  const [currentVersion, setCurrentVersion] = useState('')

  useEffect(() => {
    window.electron?.app?.getVersion?.().then(setCurrentVersion).catch(() => {})
  }, [])

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-5">
        <div className="wallpaper-panel rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <History size={20} className="text-brand-400" />
              Logs de atualizacao
            </h1>
            <p className="text-sm text-white/45 mt-1">
              Veja o que mudou em cada versao do NianPlay.
            </p>
          </div>
          <div className="rounded-xl bg-brand-600/20 border border-brand-500/30 px-3 py-2 text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-brand-200/70">Versao atual</p>
            <p className="text-sm font-semibold text-brand-100">v{currentVersion || UPDATE_LOGS[0].version}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {UPDATE_LOGS.map((log, index) => {
            const isCurrent = currentVersion === log.version || (!currentVersion && index === 0)
            return (
              <section key={log.version} className="wallpaper-panel rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-brand-300">v{log.version}</span>
                      <h2 className="text-base font-semibold text-white">{log.title}</h2>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-600/25 border border-brand-400/25 px-2 py-0.5 text-[10px] text-brand-100">
                          <Sparkles size={10} /> Atual
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/35 mt-1">{log.date}</p>
                  </div>
                </div>

                <ul className="mt-4 flex flex-col gap-2">
                  {log.changes.map(change => (
                    <li key={change} className="flex items-start gap-2 text-sm text-white/70 leading-relaxed">
                      <CheckCircle2 size={14} className="text-brand-400 shrink-0 mt-0.5" />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
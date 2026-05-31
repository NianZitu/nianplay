import React, { useEffect, useState } from 'react'
import { CheckCircle2, History, Sparkles } from 'lucide-react'

const UPDATE_LOGS = [
  {
    version: '1.1.17',
    title: 'Sessao do player persistente',
    date: '31/05/2026',
    changes: [
      'Ao fechar e abrir o app, a fila do player agora e restaurada automaticamente.',
      'A musica atual volta no mesmo ponto em que foi interrompida.',
      'Tambem restaura volume, shuffle e ordem da fila embaralhada da sessao anterior.',
    ],
  },
  {
    version: '1.1.16',
    title: 'Tempo limpo dos cortes',
    date: '13/05/2026',
    changes: [
      'Trechos cortados deixam de contar na duração e no progresso exibidos pelo player.',
      'Corrige o botão de voltar quando a interrupção cortada está no início da música.',
      'Buscar na barra de progresso passa a usar o tempo da música sem os cortes.',
    ],
  },
  {
    version: '1.1.15',
    title: 'Logs de atualização',
    date: '12/05/2026',
    changes: [
      'Adiciona uma nova aba Logs no menu lateral.',
      'Mostra uma lista de versões com as mudanças de cada atualização.',
      'Destaca a versão atual instalada.',
    ],
  },
  {
    version: '1.1.14',
    title: 'Cortes de música',
    date: '08/05/2026',
    changes: [
      'Adiciona cortes não destrutivos no Painel do Maestro para pular interrupções.',
      'O player pula automaticamente os trechos marcados sem alterar o arquivo original.',
      'Recortes são salvos na biblioteca, playlists, comunidade e sincronização com a nuvem.',
      'A faixa em reprodução é atualizada imediatamente ao salvar cortes ou ganho.',
    ],
  },
  {
    version: '1.1.13',
    title: 'Correção da nuvem',
    date: '07/05/2026',
    changes: [
      'Corrige a camada do menu de sincronização da conta.',
      'Botões de enviar e baixar da nuvem voltam a receber clique corretamente.',
    ],
  },
  {
    version: '1.1.12',
    title: 'Playlists sobre wallpaper',
    date: '07/05/2026',
    changes: [
      'Adiciona fundo escuro arredondado atrás da lista de faixas dentro das playlists.',
      'Aplica fundo translúcido nas faixas normais, pesquisadas e agrupadas.',
      'Melhora o contraste dos estados ativo, hover e arrastar em playlists com wallpaper.',
    ],
  },
  {
    version: '1.1.11',
    title: 'Visual e sincronização',
    date: '07/05/2026',
    changes: [
      'Melhora a leitura da biblioteca com wallpaper personalizado.',
      'Deixa biblioteca, barra lateral e player mais arredondados.',
      'Corrige identidade de músicas na importação, exportação e sincronização para evitar faixas trocadas.',
      'Salva mais metadados das faixas sincronizadas, incluindo YouTube, álbum, duração, capa e posição.',
    ],
  },
  {
    version: '1.1.10',
    title: 'Login persistente e changelog',
    date: '29/04/2026',
    changes: [
      'Mantém a conta logada ao fechar e reabrir o aplicativo.',
      'Corrige a origem usada pelo login do Google no app instalado.',
      'Adiciona notas de atualização no banner e na tela de configurações.',
    ],
  },
  {
    version: '1.1.9',
    title: 'Google Auth no app instalado',
    date: '29/04/2026',
    changes: [
      'Serve o app empacotado por localhost para evitar domínio não autorizado no Firebase.',
      'Ajusta o fluxo de autenticação do Google no aplicativo instalado.',
    ],
  },
  {
    version: '1.1.8',
    title: 'Reels e login',
    date: '29/04/2026',
    changes: [
      'Adiciona download de Reels como vídeo.',
      'Corrige o fluxo de popup do login com Google.',
    ],
  },
  {
    version: '1.1.7',
    title: 'Wallpaper persistente',
    date: '28/04/2026',
    changes: [
      'Corrige seleção e salvamento de wallpapers personalizados.',
      'Mantém o modo do wallpaper ao reiniciar o app.',
    ],
  },
  {
    version: '1.1.6',
    title: 'Wallpaper personalizado',
    date: '28/04/2026',
    changes: [
      'Adiciona wallpaper personalizado com imagem ou vídeo.',
      'Inclui modos normal, borrado e transparente.',
    ],
  },
  {
    version: '1.1.5',
    title: 'Conta personalizada',
    date: '28/04/2026',
    changes: [
      'Adiciona customização de conta com nome, foto de perfil e moldura.',
      'Sincroniza informações do perfil com a nuvem.',
    ],
  },
  {
    version: '1.1.4',
    title: 'YouTube e metadados',
    date: '28/04/2026',
    changes: [
      'Melhora o vínculo de músicas baixadas com links do YouTube nos metadados.',
      'Ajusta exportação de playlists para YouTube usando os links salvos.',
    ],
  },
]

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
              Logs de atualização
            </h1>
            <p className="text-sm text-white/45 mt-1">
              Veja o que mudou em cada versão do NianPlay.
            </p>
          </div>
          <div className="rounded-xl bg-brand-600/20 border border-brand-500/30 px-3 py-2 text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-brand-200/70">Versão atual</p>
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

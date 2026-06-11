export const UPDATE_LOGS = [
  {
    version: '1.1.19',
    title: 'Nova identidade visual',
    date: '11/06/2026',
    changes: [
      'Redesign completo da interface com nova navegacao, player, paineis, paginas e modais.',
      'Melhora a hierarquia visual, a densidade das listas e a adaptacao da interface a diferentes tamanhos de janela.',
      'Corrige o menu de opcoes das playlists para abrir acima das capas e dos demais conteudos.',
    ],
  },
  {
    version: '1.1.18',
    title: 'Notas de atualizacao mais claras',
    date: '31/05/2026',
    changes: [
      'Quando a release vier com nota generica, o app agora mostra automaticamente o changelog interno da versao.',
      'Corrige o texto exibido em Atualizacoes para sempre mostrar o que mudou de forma util.',
    ],
  },
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
      'Trechos cortados deixam de contar na duracao e no progresso exibidos pelo player.',
      'Corrige o botao de voltar quando a interrupcao cortada esta no inicio da musica.',
      'Buscar na barra de progresso passa a usar o tempo da musica sem os cortes.',
    ],
  },
  {
    version: '1.1.15',
    title: 'Logs de atualizacao',
    date: '12/05/2026',
    changes: [
      'Adiciona uma nova aba Logs no menu lateral.',
      'Mostra uma lista de versoes com as mudancas de cada atualizacao.',
      'Destaca a versao atual instalada.',
    ],
  },
  {
    version: '1.1.14',
    title: 'Cortes de musica',
    date: '08/05/2026',
    changes: [
      'Adiciona cortes nao destrutivos no Painel do Maestro para pular interrupcoes.',
      'O player pula automaticamente os trechos marcados sem alterar o arquivo original.',
      'Recortes sao salvos na biblioteca, playlists, comunidade e sincronizacao com a nuvem.',
      'A faixa em reproducao e atualizada imediatamente ao salvar cortes ou ganho.',
    ],
  },
  {
    version: '1.1.13',
    title: 'Correcao da nuvem',
    date: '07/05/2026',
    changes: [
      'Corrige a camada do menu de sincronizacao da conta.',
      'Botoes de enviar e baixar da nuvem voltam a receber clique corretamente.',
    ],
  },
  {
    version: '1.1.12',
    title: 'Playlists sobre wallpaper',
    date: '07/05/2026',
    changes: [
      'Adiciona fundo escuro arredondado atras da lista de faixas dentro das playlists.',
      'Aplica fundo translucido nas faixas normais, pesquisadas e agrupadas.',
      'Melhora o contraste dos estados ativo, hover e arrastar em playlists com wallpaper.',
    ],
  },
  {
    version: '1.1.11',
    title: 'Visual e sincronizacao',
    date: '07/05/2026',
    changes: [
      'Melhora a leitura da biblioteca com wallpaper personalizado.',
      'Deixa biblioteca, barra lateral e player mais arredondados.',
      'Corrige identidade de musicas na importacao, exportacao e sincronizacao para evitar faixas trocadas.',
      'Salva mais metadados das faixas sincronizadas, incluindo YouTube, album, duracao, capa e posicao.',
    ],
  },
  {
    version: '1.1.10',
    title: 'Login persistente e changelog',
    date: '29/04/2026',
    changes: [
      'Mantem a conta logada ao fechar e reabrir o aplicativo.',
      'Corrige a origem usada pelo login do Google no app instalado.',
      'Adiciona notas de atualizacao no banner e na tela de configuracoes.',
    ],
  },
  {
    version: '1.1.9',
    title: 'Google Auth no app instalado',
    date: '29/04/2026',
    changes: [
      'Serve o app empacotado por localhost para evitar dominio nao autorizado no Firebase.',
      'Ajusta o fluxo de autenticacao do Google no aplicativo instalado.',
    ],
  },
  {
    version: '1.1.8',
    title: 'Reels e login',
    date: '29/04/2026',
    changes: [
      'Adiciona download de Reels como video.',
      'Corrige o fluxo de popup do login com Google.',
    ],
  },
  {
    version: '1.1.7',
    title: 'Wallpaper persistente',
    date: '28/04/2026',
    changes: [
      'Corrige selecao e salvamento de wallpapers personalizados.',
      'Mantem o modo do wallpaper ao reiniciar o app.',
    ],
  },
  {
    version: '1.1.6',
    title: 'Wallpaper personalizado',
    date: '28/04/2026',
    changes: [
      'Adiciona wallpaper personalizado com imagem ou video.',
      'Inclui modos normal, borrado e transparente.',
    ],
  },
  {
    version: '1.1.5',
    title: 'Conta personalizada',
    date: '28/04/2026',
    changes: [
      'Adiciona customizacao de conta com nome, foto de perfil e moldura.',
      'Sincroniza informacoes do perfil com a nuvem.',
    ],
  },
  {
    version: '1.1.4',
    title: 'YouTube e metadados',
    date: '28/04/2026',
    changes: [
      'Melhora o vinculo de musicas baixadas com links do YouTube nos metadados.',
      'Ajusta exportacao de playlists para YouTube usando os links salvos.',
    ],
  },
]

export function getUpdateLogByVersion(version) {
  if (!version) return null
  return UPDATE_LOGS.find(v => v.version === version) || null
}

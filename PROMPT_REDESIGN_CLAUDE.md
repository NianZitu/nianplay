# Prompt para redesign completo do NianPlay

Você é um product designer e frontend engineer sênior trabalhando diretamente neste repositório. Sua tarefa é analisar o código existente e executar um redesign completo do NianPlay, preservando todas as funcionalidades atuais e melhorando profundamente identidade visual, hierarquia, usabilidade, consistência e qualidade de acabamento.

Não entregue apenas sugestões, wireframes ou um plano. Trabalhe no código real, implemente o redesign, execute o projeto, verifique visualmente as telas e corrija os problemas encontrados. Antes de editar, leia os arquivos relevantes para entender os fluxos e os estados já existentes.

## 1. O produto

O NianPlay é um aplicativo desktop para Windows que combina:

- player de música local;
- biblioteca e gerenciamento de metadados;
- criação e organização avançada de playlists;
- download de áudio e vídeo dentro do aplicativo;
- busca no YouTube;
- importação de faixas, álbuns e playlists do Spotify, com busca do conteúdo correspondente no YouTube;
- download de Reels do Instagram e Facebook;
- ferramentas de áudio, como normalização perceptiva por LUFS e ganho individual;
- cortes não destrutivos de trechos de músicas;
- letras, capas e links de origem;
- autenticação, sincronização em nuvem e comunidade de playlists;
- atualização automática pelo GitHub.

O diferencial do produto é ser, ao mesmo tempo, um player pessoal, um organizador de coleção, um downloader e uma pequena estação de preparação de playlists.

## 2. Stack e arquitetura existentes

- Electron 34 com janela desktop sem moldura nativa.
- React 18 + Vite.
- Tailwind CSS.
- Lucide React para ícones.
- Radix UI disponível para dialog, progress, select, slider, tabs e tooltip.
- Processo principal em `src/main`.
- Interface em `src/renderer`.
- IPC seguro exposto por `src/main/preload.js` através de `window.electron`.
- Persistência local em arquivos JSON no diretório `userData` do Electron.
- Firebase Authentication e Firestore para conta, sincronização e comunidade.
- yt-dlp e ffmpeg para busca, download, conversão e análise de áudio.
- Auto-update com `electron-updater` e releases do GitHub.

Não troque a stack, não migre o projeto para outro framework e não quebre os contratos IPC. O redesign deve ser feito principalmente na camada React/CSS, com alterações funcionais apenas quando forem necessárias para suportar uma interação visual melhor.

## 3. Estrutura atual da janela

A janela tem tamanho inicial de 1400x900 e mínimo de 1000x650. A composição atual é:

1. Title bar customizada no topo, com marca NianPlay e controles de minimizar, maximizar e fechar.
2. Banner opcional de atualização.
3. Sidebar à esquerda.
4. Conteúdo da página no centro.
5. Player persistente no rodapé.
6. Modais e painéis sobrepostos para login, reprodução expandida, edição e ações avançadas.

A navegação principal contém:

- Biblioteca;
- Playlists;
- Comunidade;
- Downloads;
- Logs;
- Configurações.

A sidebar também contém conta, avatar, moldura, sincronização para/de nuvem, logout e versão instalada.

## 4. Funcionalidades que não podem ser perdidas

### Player global

- Exibir capa, título e artista da faixa atual.
- Play/pause, anterior, próxima, shuffle, volume e mute.
- Barra de progresso com seek por clique e arraste.
- Tempo atual e duração ajustados aos cortes não destrutivos.
- Abrir tela/modal de “tocando agora”.
- Abrir fila e selecionar uma faixa futura para tocar imediatamente.
- Inserir músicas em “tocar a seguir”.
- Persistir fila, faixa atual, tempo, volume e shuffle ao fechar e reabrir.
- Aplicar ganho individual da faixa durante a reprodução.

### Tocando agora

- Visualização ampliada da capa em formato de vinil animado.
- Controles completos de reprodução e progresso.
- Exibição de letras.
- Alteração de capa por URL ou arquivo local.
- Acesso aos metadados relevantes da faixa.

### Biblioteca

- Escanear uma pasta recursivamente.
- Suportar MP3, FLAC, WAV, AAC, OGG, M4A, OPUS e WMA.
- Ler título, artista, álbum, duração, gênero, ano e capa embutida.
- Buscar músicas.
- Selecionar uma ou várias músicas.
- Tocar, tocar a seguir, adicionar a playlist, editar no Painel do Maestro e remover.
- Limpar biblioteca com confirmação.
- Importar e exportar arquivos `.nianlibrary`.
- Mostrar estados vazios, carregamento, erro e feedback de sucesso.

### Painel do Maestro

- Editar ganho em dB.
- Criar, listar e remover cortes não destrutivos por início, fim e rótulo.
- Editar link do YouTube.
- Editar letra manualmente.
- Adicionar a faixa a playlists, mostrando em quais ela já está.
- Salvar alterações e atualizar imediatamente a faixa que estiver na fila/player.

### Playlists

- Visualização em grade com capa, nome e quantidade de faixas.
- Criar playlist com nome e capa por URL ou arquivo.
- Pesquisar capa externamente.
- Renomear, duplicar, excluir, importar e exportar playlist.
- Unir várias playlists, removendo duplicatas.
- Abrir detalhes da playlist.

### Detalhes da playlist

- Cabeçalho com capa editável, nome, número de faixas e duração total.
- Tocar tudo e tocar em ordem aleatória.
- Adicionar faixas da biblioteca.
- Equalizar volume por LUFS usando uma faixa âncora.
- Exportar para `.nianplaylist`.
- Criar playlist no YouTube com privacidade privada, não listada ou pública.
- Detectar faixas virtuais sem arquivo local e oferecer “baixar faltantes”.
- Buscar e filtrar dentro da playlist.
- Remover faixa, tocar a seguir e abrir Painel do Maestro.
- Ativar grupos de sequência.
- Criar e excluir grupos coloridos.
- Atribuir ou remover músicas de grupos.
- Reordenar faixas dentro de grupos por drag and drop.
- Reproduzir um grupo isoladamente.
- Exibir claramente faixas sem arquivo local, ganho aplicado e grupo associado.

### Downloads

Existem quatro fluxos em abas:

1. Link/URL: YouTube individual ou playlist, áudio ou vídeo.
2. Reels: Instagram ou Facebook, somente vídeo.
3. Busca YouTube: até 15 resultados, com miniatura, canal e duração.
4. Spotify: resolver faixa, álbum ou playlist, buscar equivalentes no YouTube e baixar individualmente ou em lote.

O redesign deve manter:

- formatos MP3 e FLAC para áudio;
- vídeo em 4K, 1080p, 720p, 480p ou 360p quando aplicável;
- pasta de destino compartilhada entre os fluxos;
- opção de buscar letra automaticamente no fluxo Spotify;
- estado de preparação do yt-dlp;
- fila persistente de downloads;
- status queued, downloading, done, error e cancelled;
- progresso, velocidade, ETA, mensagem de erro e cancelamento.

### Comunidade

- Listar playlists publicadas por usuários.
- Buscar por nome da playlist ou criador.
- Mostrar capa, criador, avatar, moldura e quantidade de faixas.
- Atualizar a listagem.
- Importar/adicionar uma playlist à biblioteca local.
- Comunicar claramente quando login é necessário ou quando o Firebase está indisponível.

### Conta e nuvem

- Login e cadastro com e-mail/senha.
- Login com Google.
- Recuperação de senha.
- Nome público, avatar e moldura de perfil.
- Sincronização local para nuvem e nuvem para local.
- Status de sincronização, horário da última sincronização e erros.

### Configurações

- Perfil: nome, avatar e molduras Classic, Neon, Sunset e Mint.
- Wallpaper por imagem ou vídeo.
- Modos de wallpaper normal, borrado e transparente.
- Pasta padrão da biblioteca.
- Opção de auto-scan ao iniciar.
- Pasta padrão de downloads.
- Cookies do YouTube via `cookies.txt` ou navegador.
- Alertas sobre DPAPI em Chrome/Edge e recomendação de Firefox.
- Client ID, Client Secret e Refresh Token para exportação ao YouTube.
- Versão instalada e tecnologias utilizadas.
- Verificação, download e instalação de atualizações.
- Notas reais da nova versão, usando o changelog interno como fallback.

### Logs de atualização

- Listar versões, data, título e mudanças.
- Destacar a versão atualmente instalada.

## 5. Dados e comportamentos importantes

Uma faixa pode ser local ou virtual. Faixas virtuais possuem metadados e possivelmente `yt_url`, mas não possuem `file_path`. Não apresente uma faixa virtual como reproduzível sem antes haver arquivo local.

Campos importantes de faixa incluem:

- `id`, `title`, `artist`, `album`, `duration`;
- `file_path`, `cover_path`, `cover_url`;
- `genre`, `year`;
- `gain`;
- `cut_segments`;
- `lyrics`;
- `yt_url`.

Playlists podem ter `groups_enabled`. A relação playlist/faixa também guarda `position`, `group_id` e `group_position`.

O player trabalha com uma fila global, índice atual, ordem embaralhada, progresso, duração virtual descontando cortes e ganho via Web Audio API.

## 6. Problemas visuais atuais a resolver

O visual atual funciona, mas ainda parece uma coleção de painéis utilitários. O redesign deve resolver:

- hierarquia visual pouco expressiva;
- excesso de botões pequenos com peso semelhante;
- densidade alta em telas complexas;
- repetição de cartões escuros muito parecidos;
- pouca diferenciação entre ações primárias, secundárias e destrutivas;
- tipografia genérica baseada em Inter/system;
- identidade muito dependente de índigo/roxo sobre fundo escuro;
- modais com composição repetitiva;
- estados vazios pouco memoráveis;
- pouca personalidade nas capas, listas, cabeçalhos e transições;
- responsividade limitada quando a janela se aproxima de 1000x650;
- inconsistências de acentuação/encoding em textos legados, que devem ser corrigidas para português brasileiro correto.

## 7. Direção criativa esperada

Crie uma identidade própria para o NianPlay, com atmosfera de “arquivo musical pessoal + estúdio de audição”. O resultado deve parecer um produto desktop premium e autoral, não uma cópia de Spotify, Apple Music ou YouTube Music.

Escolha uma direção visual clara e sustente-a em toda a interface. Sugestão de território criativo:

- base escura sofisticada, inspirada em equipamento de áudio e capas físicas;
- superfícies com profundidade controlada, sem transformar tudo em glassmorphism;
- uma cor de destaque viva e reconhecível, evitando o padrão genérico roxo sobre preto;
- cor secundária funcional para downloads, nuvem, LUFS e grupos;
- tipografia expressiva para títulos e uma fonte altamente legível para dados e controles;
- capas como elemento dominante e não apenas miniaturas decorativas;
- detalhes editoriais, ritmos de grid e divisores que lembrem encartes, catálogos ou mesas de som;
- animações discretas e intencionais: entrada de página, mudança de faixa, expansão da fila, progresso e feedback de ações;
- foco visível, contraste adequado e áreas clicáveis confortáveis.

Evite:

- aparência genérica de dashboard SaaS;
- gradientes roxo/azul sem propósito;
- blur excessivo;
- bordas em todos os elementos;
- cartões dentro de cartões sem necessidade;
- microanimações em tudo;
- ícones sem rótulo em ações pouco óbvias;
- esconder funções importantes apenas em hover;
- sacrificar legibilidade por estética.

## 8. Sistema visual a criar

Centralize no CSS/Tailwind:

- tokens de cor semânticos;
- escala de superfícies e elevação;
- tipografia e escala de títulos;
- espaçamento;
- raios;
- estados hover, active, focus, selected e disabled;
- estilos para ações primary, secondary, ghost, destructive e icon button;
- inputs, selects, sliders, tabs, badges, tooltips, menus, toasts e modais;
- padrões de lista de música, cartão de playlist, cabeçalho de página e estado vazio.

Reduza classes improvisadas repetidas. Extraia componentes compartilhados somente quando isso reduzir duplicação real e mantiver o código fácil de entender.

## 9. Expectativas por área

### Shell

- Title bar integrada à identidade do produto.
- Sidebar que funcione bem no mínimo de 1000px e possa usar modo compacto se necessário.
- Conteúdo com hierarquia e respiro.
- Player inferior mais forte visualmente, mas sem roubar espaço da coleção.
- Wallpaper deve continuar funcionando sem comprometer contraste.

### Biblioteca e listas

- Cabeçalho com título, resumo e ações organizadas por prioridade.
- Busca evidente.
- Seleção múltipla com barra contextual clara.
- Lista fácil de escanear, com colunas úteis e ações acessíveis por teclado/mouse.
- Estado vazio que ensine o primeiro passo: escanear uma pasta.

### Playlists

- Grade mais editorial e responsiva.
- Detalhe da playlist com hero compacto e capa protagonista.
- Grupos de sequência devem parecer uma ferramenta musical real, não apenas tags coloridas.
- Drag and drop deve ter indicador visual claro.

### Downloads

- Transformar os quatro fluxos em uma experiência coesa.
- Separar “criar download” de “atividade de downloads”.
- Tornar formato, qualidade, destino e estado do yt-dlp fáceis de entender.
- Fila deve funcionar como monitor de tarefas, com erros legíveis e ações de recuperação.

### Configurações

- Dividir a página longa em navegação interna ou seções bem demarcadas.
- Não exibir credenciais sensíveis de forma descuidada.
- Alertas técnicos devem ser claros sem dominar a tela.
- Atualizações devem mostrar versão, mudanças, progresso e ação principal.

### Modais

- Padronizar largura, cabeçalho, rodapé, ação primária, cancelamento, scroll e fechamento.
- Modais complexos podem virar drawers ou painéis maiores quando isso melhorar a tarefa.
- “Tocando agora” pode ser uma experiência mais imersiva que um modal utilitário comum.

## 10. Responsividade desktop

O app é desktop, não mobile-first, mas precisa funcionar perfeitamente entre 1000x650 e telas grandes.

- Não deixar botões essenciais desaparecerem ou serem cortados.
- Usar grids fluidos para playlists e comunidade.
- Permitir que barras de ação quebrem linha de modo elegante.
- Fazer listas e modais respeitarem a altura disponível.
- Manter o player utilizável em largura mínima.
- Evitar scroll horizontal involuntário.

## 11. Acessibilidade e qualidade

- Manter contraste suficiente em texto e controles.
- Criar estados de foco visíveis.
- Adicionar `aria-label` a botões apenas com ícone.
- Não depender apenas de cor para status.
- Respeitar `prefers-reduced-motion`.
- Manter textos em português brasileiro correto.
- Garantir que ações destrutivas tenham confirmação quando necessário.
- Preservar feedback para loading, sucesso, erro, vazio e indisponibilidade.

## 12. Restrições técnicas

- Não remover nem renomear canais IPC usados em `preload.js`.
- Não alterar formatos `.nianlibrary` e `.nianplaylist` de forma incompatível.
- Não quebrar sincronização Firebase, comunidade, auto-updater, yt-dlp ou ffmpeg.
- Não remover `drag-region`/`no-drag` necessários à janela frameless.
- Não usar URLs remotas obrigatórias para fontes ou recursos essenciais; o app deve continuar robusto offline para funções locais.
- Não introduzir uma biblioteca UI grande sem necessidade.
- Não criar dados falsos permanentes no app.
- Não reduzir recursos para simplificar o redesign.
- Preserve a lógica do `PlayerContext`, incluindo cortes, ganho, fila e restauração de sessão.

## 13. Processo de trabalho esperado

1. Leia o código e faça um inventário dos componentes e padrões repetidos.
2. Defina em poucas linhas a direção visual escolhida e os tokens principais.
3. Implemente primeiro o shell e o sistema visual compartilhado.
4. Redesenhe todas as páginas e modais, sem deixar telas antigas misturadas com novas.
5. Corrija textos com encoding quebrado encontrados durante o trabalho.
6. Execute build/lint disponível e corrija erros.
7. Rode o aplicativo e faça inspeção visual nas resoluções 1400x900 e 1000x650.
8. Teste estados representativos: biblioteca vazia e preenchida, playlist com grupos, faixa virtual, download em progresso/erro, usuário logado/deslogado e atualização disponível.
9. Entregue um resumo objetivo do que mudou, arquivos principais e verificações realizadas.

## 14. Critérios de aceite

O redesign só está concluído quando:

- todas as páginas principais compartilham a mesma linguagem visual;
- todas as funcionalidades listadas continuam acessíveis;
- ações primárias e secundárias são visualmente distintas;
- listas densas permanecem legíveis;
- a janela mínima de 1000x650 é utilizável;
- wallpaper em imagem e vídeo não prejudica leitura;
- player, fila e tocando agora parecem parte do mesmo sistema;
- modais e feedbacks estão consistentes;
- não há textos com caracteres corrompidos;
- o build de produção passa;
- não há regressões óbvias nos fluxos IPC.

Comece explorando os arquivos reais. Use este documento como mapa funcional, mas confirme os detalhes no código antes de editar. Tome decisões de design com convicção e mantenha o resultado autoral, coeso e pronto para uso real.

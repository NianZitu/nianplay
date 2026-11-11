# NianPlay — Registro de Progresso

Histórico das mudanças feitas no programa, da mais recente para a mais antiga.
Cada entrada: versão, data, o que mudou, por quê, arquivos e status.
(Versões anteriores a 1.1.22 estão resumidas em `src/renderer/data/updateLogs.js`.)

---

## iPhone 0.1.0 — 11/11/2026 — Primeira versão mobile (.ipa para AltStore)

**Pedido do usuário:** portar o NianPlay para o iPhone (ele instalou o AltStore) e gerar um `.ipa`. Durante o
trabalho, pediu que a interface funcionasse **como a do Spotify mobile**, mantendo as cores e blocos do NianPlay.

### Decisões
- **Capacitor 8** reaproveitando o React do desktop; build do iOS no **GitHub Actions (macOS)** porque não existe
  Xcode no Windows; `.ipa` **sem assinatura** (o AltStore assina). Tudo no branch **`mobile`** — `main` e as releases
  do desktop não foram tocados.
- Mantido do desktop: player (ganho LUFS, cortes, grupos de sequência), login e "Baixar da nuvem", regras de nomes
  de playlist e de casamento de faixas. Fora: yt-dlp, medição LUFS, Spotify, export YouTube, comunidade,
  "Enviar para nuvem" (substituiria a nuvem com a biblioteca parcial do celular), login Google.
- Detalhes da arquitetura em `CONTEXTO.md` → "App para iPhone".

### Testes
- `id3.js` × music-metadata nos **302 MP3 reais** do usuário (só leitura): título, artista, álbum e capa idênticos em
  300/300 capas; ID3 v2.3 e v2.4 ✅
- Navegador (375×812, dados simulados + arquivos WAV reais pelo fluxo de importação): Início, Buscar, Sua Biblioteca,
  playlist com grupo, "Todas as músicas", conta; importação liga "Fresh" (título+artista) e "Pico" (sem tag de artista,
  título único) às faixas da nuvem mantendo id e ganho (−2,5 dB); reimportar = duplicata; tocar pela playlist respeita
  os grupos e pula faixas sem arquivo; mini player, "Tocando agora" com tempo avançando e "Volume equalizado
  −2,5 dB"; menu ⋯ → Adicionar à playlist; tocar na aba ativa volta ao início; nome de playlist duplicado recusado;
  sem erros no console ✅
- Desktop continua compilando com os 2 ajustes compartilhados (covers.js, PlayerContext.jsx) ✅
- **Não testado (sem iPhone/Mac aqui):** execução no aparelho, áudio em segundo plano/tela bloqueada com o Web Audio
  ligado, controles da tela de bloqueio, Firebase no WKWebView, escaneamento da pasta Documentos e cópia de arquivos
  grandes. Ajuste "Equalização de volume (LUFS)" pode ser desligado se a música parar ao bloquear a tela.

---

## Bot — 08/11/2026 — Instalação na VPS falhava no `npm ci`

**Problema:** na VPS (Ubuntu 24.04, npm 10.9) o `install.sh` parava em `npm ci`: "Missing: opusscript@0.0.8 from lock
file". O lock foi gerado com npm 11, que aceita `opusscript@0.1.1` mesmo com o `prism-media` pedindo `^0.0.8` (peer
opcional); o npm 10 recusa. Com `set -e`, o script parava antes de criar o serviço (`nianplay-bot.service not found`).
**Correção:** `opusscript` fixado em `^0.0.8` (a versão que o `prism-media` suporta) e lock regenerado; testado com
`npx npm@10.9.9 ci` (ok, `generateDependencyReport` mostra `@discordjs/opus` e `opusscript`). `install.sh` e `update.sh`
usam `npm install` se o `npm ci` falhar. Testes: 8/8.
**Segunda falha (reinstalação):** `git fetch` como root em `/opt/nianplay` (dono `nianplay`) → "detected dubious
ownership". Os comandos git dos dois scripts agora usam `git -c safe.directory="$APP_DIR"` (commit cd5ad1e).
**Resultado:** bot online na VPS (NianPlay#3432, 22 comandos no servidor).
**YouTube na VPS:** primeiro "confirme que não é robô" → resolvido com `YTDLP_COOKIES`. Depois "Requested format is
not available": o yt-dlp 2026 precisa de um interpretador JavaScript para os desafios do YouTube ("JS runtimes: none";
com cookies ele usa clientes web que exigem isso). O bot agora passa `--js-runtimes node:<process.execPath>` (o próprio
Node do bot; `YTDLP_JS_RUNTIME` no `.env` troca ou desliga com "none"). Testado localmente: `JS runtimes: node-24`,
`streamUrl` ok; testes 8/8. Mensagem amigável para "Requested format is not available".
**Botões do "Tocando agora":** 6 botões numa linha → Discord recusava ("components[0].components: Must be between 1
and 5"), quebrando `/nowplaying` e a mensagem com botões. `ui.controls()` agora devolve 2 linhas (⏮️ ⏯️ ⏭️ ⏹️ / 🔀 🔁);
novo `test/ui.test.js` confere os limites. Testes 10/10.
**Silêncio longo antes/entre músicas:** cada chamada ao yt-dlp leva ~4,5 s (medido no PC; mais na VPS) e o bot só
preparava a próxima faixa depois que a anterior acabava (faixas sem link ainda fazem uma busca antes). Correções:
- `GuildPlayer.prefetchNext()`: quando uma faixa começa, a próxima (respeitando loop faixa/fila) já busca o link e o
  endereço do áudio em segundo plano; também depois de `/playnext`, `/shuffle`, `/move`, `/remove` e troca de loop.
  `_ensurePlayable` compartilha a busca em andamento (`item._pending`), sem chamar o yt-dlp duas vezes.
- `/play`: `ytdlp.info(..., { format })` devolve detalhes + endereço do áudio numa chamada só (`audioUrlOf`); antes eram
  duas (info/busca + `-g`). Busca por nome: ~5,7 s; link: ~4,8 s, já com o áudio pronto.
- ffmpeg medido: ~70 ms até o primeiro áudio — não é gargalo.
Testes 13/13 (yt-dlp simulado nos testes do player).

---

## 1.1.29 — 07/11/2026 — Entrada da 1.1.28 no histórico do app

**Problema (relatado pelo usuário):** a tela "Histórico de atualizações" da 1.1.28 não mostrava a 1.1.28.
**Causa:** o script que inseriu a entrada em `src/renderer/data/updateLogs.js` procurava o texto com `\n`, mas a cópia
de trabalho do repositório usa **CRLF** (`\r\n`) → `String.replace` não achou nada e não avisou; a entrada nunca foi
gravada e o resultado não foi conferido. As notas da release no GitHub (`release-notes/1.1.28.md`) estavam corretas —
o aviso de atualização mostrava as mudanças; faltava só o histórico embutido no app.
**Correção:** entradas 1.1.28 e 1.1.29 inseridas com a ferramenta de edição (mantém CRLF); conferido no arquivo, no bundle
(`dist/assets`) e na tela "Atualizações" do navegador (v1.1.29, v1.1.28 com 6 itens, v1.1.27). As demais edições
feitas por script na 1.1.28 foram auditadas e estão corretas.
**Regra a partir daqui:** em scripts de edição, sempre falhar se o trecho procurado não existir e conferir o resultado.
**Status:** ✅ publicada em 07/11/2026 — https://github.com/NianZitu/nianplay/releases/tag/v1.1.29 (commit 6882f1f;
4 arquivos; `latest.yml` publicado idêntico ao local; marcada como latest).

---

## 1.1.28 — 07/11/2026 — Playlists sem duplicatas na nuvem + nomes únicos + link do bot

**Pedido do usuário:** a nuvem estava duplicando playlists; playlists de mesmo nome do mesmo usuário devem se
sobrepor na nuvem, e o app deve impedir nomes repetidos na conta para não se misturarem.

### Causa
- `playlistCloudId` = hash(nome + **data de criação**) → recriar/renomear gerava outro documento.
- `syncToCloud` limpava só `users/{uid}`; os docs de `communityPlaylists` **nunca eram apagados** (18 docs na nuvem
  para 6 playlists reais do usuário).
- Nada impedia duas playlists com o mesmo nome na conta.

### Correção
- `renderer/firebase.js`: `playlistCloudId(playlist, ownerUid)` = **conta + nome normalizado**, 64 bits (djb2 +
  FNV-1a, `p_` + 14 caracteres) porque `communityPlaylists` é compartilhada entre contas. `normalizePlaylistName`
  (NFC, trim, espaços colapsados, minúsculas; acentos contam) — idêntica a `main/playlistNames.js`.
- `AuthContext.syncToCloud`: usa o id novo; grava a comunidade **sem merge** (substitui); depois apaga os docs da
  comunidade com `owner_uid == uid` que não estão mais publicados (cópias antigas e playlists apagadas/renomeadas);
  recusa enviar se houver nomes repetidos. `syncFromCloud` casa playlists pelo nome normalizado.
- Novo `main/playlistNames.js`: `findByName`, `uniqueName` ("Nome (2)"), `dedupePlaylistNames`.
  `playlists:create/update/merge` recusam nome em uso (`{ error }`); `duplicate` e imports (arquivo/comunidade) geram
  nome único e informam `renamedFrom`; novo IPC `playlists:isNameTaken`. Ao abrir o app, nomes repetidos existentes são
  renomeados (a mais antiga mantém o nome).
- UI (`PlaylistsPage`): criar/unir mostram aviso ao vivo, borda vermelha e botão bloqueado; renomear mostra borda
  vermelha, bloqueia ✓ e não fecha a edição se o main recusar; toasts de import informam a renomeação.
- Botão 🤖 "Copiar link do bot" passa a exigir login (o id depende da conta).
- **O link do bot muda se a playlist for renomeada** (id = nome) — copiar de novo depois de reenviar.

### Testes
- 29 verificações com os handlers reais (electron simulado): "Games"/"games"/"  GAMES  " recusados, "Música" ≠ "Musica",
  nome vazio recusado, espaços limpos, renomear para nome em uso recusado (nome mantido), salvar capa com o mesmo nome e
  mudar só maiúsculas do próprio nome permitidos, duplicar 2× → "X (Cópia)", "X (Cópia) (2)", unir com nome em uso
  recusado, import com nome em uso → "Mix (2)" + `renamedFrom`, correção das duplicadas (a mais antiga mantém), id de
  nuvem: mesma conta+nome → mesmo id (data ignorada), outra conta/outro nome → outro id, formato aceito pelo bot,
  100 mil ids sem colisão ✅
- UI no navegador: aviso + borda + "Criar" bloqueado para "  GAMES ", "Musica" liberado, "Road Trip" criado ✅
- **Não verificável daqui:** se as regras do Firestore permitem ao dono apagar seus docs de `communityPlaylists` (a limpeza
  faz try/catch e só registra no console se falhar). Verificar depois do 1º "Enviar para nuvem" com a 1.1.28: a API pública
  deve mostrar 1 doc por playlist do usuário.
- **Publicado ✅** https://github.com/NianZitu/nianplay/releases/tag/v1.1.28 — commit `4bd591c` (junto com o código do bot).
  Conferido pela API pública: "latest", 4 arquivos, `latest.yml` idêntico ao local.

 — 07/11/2026 (em desenvolvimento, não publicado)

**Pedido do usuário:** bot para a VPS da Hostinger que toque YouTube e Spotify como os bots comuns, e playlists da
nuvem do NianPlay: `/nianplay` (link gerado no app ou nome), `/group` (com grupos na ordem do app), `/shuffle` que no
modo grupo embaralha só a ordem dos grupos intercalando as avulsas, e os comandos padrão.

### Feito
- Pasta `bot/` (ver CONTEXTO → "Bot de Discord"): 22 comandos — `/play /playnext /nianplay /group /pause /resume /skip
  /previous /stop /leave /queue /nowplaying /shuffle /loop /volume /seek /remove /move /skipto /clear /lyrics /help`,
  autocomplete de playlists do NianPlay (nome — faixas · dono · data), botões ⏮⏯⏭🔀🔁⏹ no "Tocando agora".
- App: botão 🤖 **Copiar link do bot** no detalhe da playlist (`PlaylistDetailPage.jsx`, `handleCopyBotLink`).
- Deploy: `install.sh`, `update.sh`, unidades systemd, `.env.example`, `README.md` (passo a passo em PT-BR).

### Testado (sem Discord — o token é do usuário)
- Fontes ao vivo: nuvem do NianPlay (18 docs públicos; link `p_1e876cv` → "ALL FNF" 166 faixas, 143 em grupo, 163 com
  ganho), busca por nome; YouTube busca/vídeo/playlist (182); Spotify álbum sem credenciais (13) → YouTube correto;
  faixa sem link → busca correta.
- Áudio (ffmpeg real, vídeo de 19 s): sem filtro 19,01 s; ganho −3,5 dB = pico ×0,668; seek 5 s → 14,01 s; corte 8–12 →
  15,01 s; seek + 2 cortes → 10,01 s (todos exatos). ffmpeg ausente não derruba o bot.
- `npm test`: ordem e shuffle por grupos **idênticos ao algoritmo do app** em 600 playlists aleatórias; fila do player.
  Os testes acharam e corrigiram 2 bugs: adicionar música durante o carregamento pulava a atual; a 1ª música pedida
  depois do fim da fila era ignorada.
- Token ausente/inválido → mensagem clara e saída 78 (sem loop no systemd).
- Os IDs das 6 playlists locais batem com docs da nuvem (o botão gera links válidos).

### Pendente
- Código publicado no GitHub com a 1.1.28 ✅ (`install.sh` acessível em raw.githubusercontent.com, sem ``, sintaxe ok).
- Teste real no Discord (precisa do token do usuário) e instalação na VPS.

---

## 1.1.27 — 22/10/2026 — Link personalizado no "Verificar links"

**Pedido do usuário:** campo para inserir um link customizado quando o certo não aparece entre as sugestões.
Autorizou publicar direto.

- `LinkCheckModal` (`PlaylistDetailPage.jsx`): em cada faixa, uma opção de rádio com campo de texto "Colar link do
  YouTube…", **disponível sem pesquisar**. Digitar seleciona a opção; apagar o texto desfaz a seleção. Validação ao vivo
  com `youtubeVideoId` ("link válido" / "não é um vídeo do YouTube" — link de playlist é recusado); só conta como
  escolhido (e para "Salvar N links") quando válido; salvo com `canonicalUrl`; botão para abrir no YouTube.
  Estado: `choices[trackId] = CUSTOM` (sentinela) + `customs[trackId]` = texto; `chosen` resolve para a URL final.
- Teste (navegador, dados simulados): campo presente antes da busca e sem disparar busca; link de playlist recusado e
  Salvar desativado; `youtu.be/ID?si=...` aceito e salvo como `watch?v=ID`; digitar troca da opção listada para a
  personalizada e voltar para a opção mantém o texto; limpar o campo tira a seleção; salvou exatamente as 2 escolhas;
  sem erros no console ✅ · `vite build` ✅
- **Publicado ✅** https://github.com/NianZitu/nianplay/releases/tag/v1.1.27 — commit `975a753`. Conferido pela API
  pública: "latest", 4 arquivos, `latest.yml` idêntico ao local.

---

## 1.1.26 — 22/10/2026 — Links das músicas corretos + "Verificar links"

**Pedido do usuário:** músicas baixadas (mesmo depois da atualização que deveria salvar o link) vinham com link errado
ou sem link, prejudicando sync da nuvem e "baixar playlist". Achar a causa e corrigir; e um botão nas playlists que
liste faixas sem link e, com permissão, busque no YouTube até 3 opções para o usuário escolher.

### Diagnóstico (dados reais: 305 faixas com arquivo, 191 sem link; 10 delas vinham de downloads do próprio app)
1. **Aba Downloads (URL, busca YouTube, Spotify) nunca gravava o link na faixa.** `downloader:start` só baixava; o
   `library:scan` posterior criava a faixa com `yt_url: ''`. O link ficava só em `downloads.json` (com `title` = nome do
   1º arquivo intermediário, ex. `.webm`).
2. **Aba Spotify associava por nome — a causa dos links ERRADOS.** Logo após iniciar o download, procurava na
   biblioteca `title === nome` (ignorando artista) ou `title.includes(nome)` e gravava o link nela. O arquivo nem
   existia ainda na biblioteca.
3. **`startForTrack` / `linkDownloadedFile` (Baixar faixas faltantes) adivinhava o arquivo:** o mais recente da pasta
   (últimos 5 min) com nome parecido → com downloads simultâneos ligava arquivos/links trocados; e rodava **mesmo
   quando o download falhava** (`runDownload` resolvia em erro).
4. **`youtube.js` (exportar para o YouTube)** copiava links do histórico para faixas com título ≥ 72% parecido.
5. **Links comparados como texto exato** em todo o app: `youtu.be/ID`, `watch?v=ID&list=..`, `?si=` eram "links
   diferentes" → caía no casamento por nome.
6. Bônus: saída do yt-dlp lida como cp1252 e cortada entre chunks → nomes com acento corrompidos.

### Correção
- Novo `main/mediaUrl.js` (+ `renderer/utils/mediaUrl.js`, mesmas regras): `youtubeVideoId`, `canonicalUrl`
  (`https://www.youtube.com/watch?v=ID`), `urlKey` (comparação), `isPlaylistUrl`.
- `downloader.js`: yt-dlp roda com `--print before_dl:NIANPLAY_TITLE\t%(title)s`,
  `--print after_move:NIANPLAY_FILE\t%(webpage_url)s\t%(filepath)s`, `--no-simulate`, `--encoding utf-8`
  (+ `PYTHONIOENCODING`/`PYTHONUTF8`, `stdout.setEncoding('utf8')`). Cada vídeo vira `download.files = [{url, path}]`
  (caminho FINAL, após conversão). Ao terminar: `linkFilesToLibrary` (faixas já existentes com aquele caminho).
  `startForTrack` só liga em sucesso e liga o **arquivo exato** reportado (sem fallback por nome) e o link usado.
- Novo `main/urlRepair.js` — `repairTrackUrls()` preenche `yt_url` vazio **só com evidência exata**: caminho
  exato em `download.files`, ou (downloads antigos) nome de arquivo idêntico ao `title` registrado (sem extensão e sem
  sufixo `.fNNN`) apontando para **um único** link de vídeo (playlists e ambíguos ignorados). Roda ao abrir o app,
  após `library:scan` e no export para YouTube (substitui o casamento por 72%). `scanDirectory` já cria a faixa com o
  link do histórico.
- Comparação por `urlKey` em `trackMatch.js` (findTrackMatch/TrackIndex), `library:importVirtualTrack`,
  `AuthContext` (findTrackMatch, localUrlSet); gravação canônica em `library:updateTrack`, imports de playlist,
  faixas virtuais, upload para a nuvem e `trackCloudId` (mesmo vídeo → mesmo id na nuvem).
- Aba Spotify: removida a associação por nome (o link chega pelo histórico quando o arquivo entra na biblioteca).
- **"Verificar links"** (botão 🔗 no detalhe da playlist, `LinkCheckModal` em `PlaylistDetailPage.jsx`): lista faixas
  sem link ou com link inválido (link do YouTube sem vídeo, ex. playlist); busca **só após clique** (por faixa ou
  todas, com "Parar"); até 3 candidatos por faixa (consultas "artista - título" → "título artista" → "título",
  ordenados por `scoreYt`, com miniatura, canal, duração e diferença de duração colorida, selo "mais provável" se
  score ≥ 0,6, botão para abrir no YouTube via novo IPC `app:openYoutube` que só aceita vídeos do YouTube); **nada
  pré-selecionado**, "Nenhuma destas", salva só os escolhidos (`library:updateTrack` parcial) e atualiza lista e fila.

### Testes
- Lógica (Node, electron simulado): variantes de link → mesmo id/canônico/chave; playlist/outro site não viram vídeo;
  url vence nome no casamento; reparo: caminho exato (case-insensitive) ✅, nome idêntico antigo ✅, ambíguo ✗,
  playlist ✗, download com erro ✗, faixa que já tinha link intocada, **nome parecido ("Antiga Remix") ✗**;
  `updateTrack` grava canônico; `importVirtualTrack` reconhece o mesmo vídeo em outro formato ✅ (6/6)
- **Cópia dos dados reais:** reparo recupera **9 links** (115 → 124), todos de arquivos baixados pelo app
  (Bopeebo, Dadbattle, Fresh, Tutorial…); 1 caso ambíguo deixado sem link.
- **Download real (Electron + yt-dlp, pasta "Músicas #ção 100%")**: startForTrack liga o `.mp3` final exato e o link
  canônico (entrada `youtu.be/..?si=`) ✅; download pela aba + escanear pasta → faixa nova já com link ✅; download que
  falha não liga nenhum arquivo ✅; caminho com acento/#/% íntegro ✅
- UI (navegador, dados simulados): 3 de 4 detectadas (inclui link de playlist como inválido), nenhuma busca antes do
  clique, ordem correta (original > cover/nightcore), "Nenhum vídeo encontrado", Salvar desabilitado sem escolha,
  salva só a escolhida com link canônico, sem erros novos no console ✅
- `vite build` ✅ · sintaxe main ✅
- Instalador gerado ✅ `dist-electron\NianPlay Setup 1.1.26.exe` + portátil.
- **Publicado ✅** (a pedido do usuário) https://github.com/NianZitu/nianplay/releases/tag/v1.1.26 — commit `9ed9285`.
  Conferido pela API pública: é a "latest", 4 arquivos, `latest.yml` idêntico ao local, notas no topo.
  O usuário autorizou a publicação sem relatar teste manual da 1.1.26 no app instalado.

### Observações / não feito
- Faixas sem link que **não** vieram de downloads do app (≈180, adicionadas por escaneamento de arquivos de outras
  fontes) não têm como ser recuperadas automaticamente → usar "Verificar links".
- A aba Spotify ainda associa a **letra** por nome parecido (mesmo padrão do bug do link). Não foi pedido; candidato a correção.
- "Baixar faixas faltantes" sem link ainda usa sempre o 1º resultado da busca. Recomendação: rodar "Verificar links" antes.

---

## Publicação da 1.1.25 + benchmark antes/depois — 22/10/2026

**Pedido do usuário:** instalar o Git, publicar a release e colocar no log, com números, tudo o que mudou na otimização.

### Benchmark 1.1.21 (antes) × 1.1.25 (depois)
- Método: o portátil `dist-electron\NianPlay 1.1.21.exe` foi extraído e comparado com `win-unpacked` da 1.1.25,
  cada um com `--user-data-dir` apontando para uma **cópia** da biblioteca real do usuário (319 faixas; maior
  playlist "ALL FNF", 166 faixas; 1.1.21 recebeu a mesma fila no formato antigo), `--mute-audio` e
  `--remote-debugging-port`. Roteiro automatizado via CDP: abrir → 15 s parado → tocar a 1ª faixa (duplo clique)
  → medir 30 s → abrir a maior playlist e rolar até o fim. RAM = soma de todos os processos do exe
  (working set e privada); CPU = tempo de processador somado; renderização = `Performance.getMetrics`.
  4 execuções por versão, intercaladas (CPU total: 2 por versão — a 1ª rodada teve bug de vírgula decimal).
  Dados reais do usuário conferidos antes/depois: **não alterados**.
- Script: `scratchpad\bench\bench.js` (fora do repositório).

| Medição | 1.1.21 | 1.1.25 | Diferença |
|---|---|---|---|
| RAM com a maior playlist aberta (working set) | 1.198 MB | 662 MB | −45% |
| RAM com a maior playlist aberta (privada) | 906 MB | 407 MB | −55% |
| RAM tocando música (working set) | 734 MB | 602 MB | −18% |
| RAM tocando música (privada) | 446 MB | 354 MB | −21% |
| RAM parado na Biblioteca (working set) | 698 MB | 585 MB | −16% |
| CPU tocando (todos os processos, % de 1 núcleo) | 61% | 28% | −54% |
| Thread da interface ocupada (30 s tocando) | 8,07 s | 1,57 s | −81% |
| Tempo de JavaScript (30 s tocando) | 1,54 s | 0,08 s | −95% |
| Recálculos de layout (30 s tocando) | 1.828 | 119 | −94% |
| Recálculos de estilo (30 s tocando) | 1.828 | 1.512 | −17% |
| Elementos no DOM — Biblioteca | 12.803 | 1.770 | −86% |
| Elementos no DOM — playlist rolada | 8.484 | 3.351 | −61% |
| Heap JS — Biblioteca | 10,8 MB | 5,1 MB | −53% |
| Abertura até a lista aparecer | 1,88 s | 1,47 s | −22% (mais variável) |

Observação: os recálculos de estilo caíram pouco porque a animação do VU e a barra de progresso continuam
atualizando estilo a cada frame (é barato); o ganho real está em layout, JavaScript e DOM.

### Changelog
- `src/renderer/data/updateLogs.js`: as entradas 1.1.22–1.1.25 (nunca publicadas) viraram **uma entrada 1.1.25**
  com números e todas as mudanças — quem atualizar vem direto da 1.1.21.
- `release-notes/1.1.25.md` (novo): corpo da release no GitHub, com as 5 linhas mais importantes no topo (o banner
  de atualização das versões antigas mostra até 6 linhas) e a tabela de números.

### Publicação
- Git 2.55 instalado via winget. A pasta é de backup com dono "SISTEMA" → `git config --global --add safe.directory`.
- **Correção:** o repositório tem histórico (último commit "Release 1.1.21", remoto `NianZitu/nianplay`); a
  afirmação anterior de que "não tinha commits" estava errada — o Git só não estava instalado.
- `release.bat` não foi usado: envia só o instalador (sem `latest.yml`, `.blockmap` e portátil, que as releases
  1.1.20/1.1.21 têm e que o auto-updater precisa), manda nota genérica e depende de `python3` (nesta máquina é só o
  atalho da Microsoft Store — quebraria depois do push). Novo `release.ps1` faz o mesmo fluxo com verificações antes do push.
- A build publicada difere da testada pelo usuário apenas no texto do changelog.
- Problemas no caminho (todos resolvidos, nenhum publicou nada pela metade):
  1. `release.ps1` com travessão "—" em UTF-8 sem BOM → PowerShell 5.1 leu como ANSI e não conseguiu analisar o
     script (nada executou). Script agora é só ASCII.
  2. `git push` sem login (máquina formatada) → usuário fez login pelo Git Credential Manager no navegador.
  3. **`.release-token` expirado/revogado** (GitHub respondeu 401). O script antigo não parava nesse erro. O
     `release.ps1` passou a usar o **GitHub CLI** (`gh`, instalado via winget; usuário logado com `gh auth login --web`,
     escopo `repo`) e para em qualquer falha. O `.release-token` não é mais usado.
- **Publicado ✅** https://github.com/NianZitu/nianplay/releases/tag/v1.1.25 — commits `e67c901` (Release 1.1.25)
  e `f608065` (release.ps1 com gh). Conferido pela API pública: é a "latest", 4 arquivos com tamanhos iguais aos
  locais, `latest.yml` servido idêntico ao local (SHA-512 do instalador confere), notas com os números no topo.

---

## 1.1.25 — 22/10/2026 — `webSecurity` ligado (protocolo `nianmedia://`)

**Motivo:** item 1 de "Problemas conhecidos" (adiado nas fases 1–3 por risco). Com `webSecurity: false` a página
podia ler qualquer arquivo do disco e fazer requisições a qualquer site sem CORS.

### O que mudou
- Novo `main/mediaProtocol.js`: esquema `nianmedia://` registrado com `registerSchemesAsPrivileged`
  (`standard, secure, stream, supportFetchAPI, corsEnabled`) antes do `ready` e servido com `protocol.handle`.
  - Formato: `nianmedia://local/<encodeURIComponent(caminho absoluto)>[?v=...]` — o caminho inteiro é **um segmento
    codificado**, então `#`, `%`, `?`, espaços e acentos funcionam e a normalização de URL não mexe no caminho.
  - **Range:** `bytes=a-b`, `bytes=a-`, `bytes=-n` → 206 + `Content-Range` + `Content-Length`; fora do arquivo → 416;
    sem Range → 200. Sempre `Accept-Ranges: bytes`. Corpo via `fs.createReadStream({ start, end })` embrulhado em
    `ReadableStream` com backpressure e `destroy()` quando o renderer cancela (seek/troca de faixa). `HEAD` suportado.
  - **CORS:** `Access-Control-Allow-Origin` = origem da UI (`http://localhost:17654` em produção, `:5173` em dev).
    Se a requisição tiver `Origin` de uma das duas, ecoa; **sem `Origin` usa a origem padrão** — no teste, o Chromium
    **não** repassa `Origin` ao handler nem para o `<audio crossOrigin>`, então esse padrão é essencial.
  - **Restrições:** host precisa ser `local`; caminho absoluto; sem UNC/rede (`\\servidor\...`); sem `\0`; apenas
    arquivos regulares com extensão de mídia conhecida (áudio, imagem, vídeo — MIME por extensão). Qualquer outra
    coisa → 403 (ex.: `settings.json`, que tem tokens). Inexistente → 404. `..` no caminho é resolvido, mas ainda
    só serve mídia.
- `main.js`: `webSecurity: false` **removido** (padrão = ligado); `handleMediaProtocol([...origens])` antes de criar a janela.
- `handlers/appearance.js`: wallpaper novo salvo como `nianmedia://...?v=` (antes `pathToFileURL`).
- Renderer — `utils/covers.js`: `fileUrl` substituído por `mediaUrl(p)` (caminho → `nianmedia://`) e `mediaSrc(p)`
  (http/data/blob/nianmedia intactos; caminhos e `file://` legados convertidos). `coverSrc`/`listCoverSrc` usam isso.
  - Valores `file://` **salvos** continuam válidos: capas de playlist (`cover_url = "file://C:\..."`, caminho cru —
    não é decodificado) e wallpaper antigo (`file:///C:/a%20b.mp4?v=` — decodificado, `?v=` preservado).
    O formato salvo pelos seletores de capa **não mudou** (sync da nuvem filtra não-http em `publicMediaUrl`).
- `PlayerContext.jsx`: `audio.crossOrigin = 'anonymous'` ao criar o `Audio` + `audio.src = mediaUrl(file_path)` nos 3 lugares.
- Trocados todos os pontos que montavam `file://`: `StudioPanel` e `NowPlayingModal` (`buildCoverUrl` removido →
  `coverSrc`), `CommunityPage`, `App.jsx` e `SettingsPage` (wallpaper → `mediaSrc`), capas de playlist em
  `LibraryPage`, `PlaylistsPage` (3), `PlaylistDetailPage`, `MaestroModal`, e `PlayerBar` (sem uso, por consistência).

### Verificação do item 5 (nada depende de cross-origin sem CORS)
- Renderer não faz `fetch`/XHR direto (letras, YouTube etc. passam por IPC no main). Firebase (Auth/Firestore) usa
  endpoints com CORS, como em qualquer navegador; o popup do Google já roda com `webSecurity` padrão.
- Imagens remotas (miniaturas do YouTube, avatares, capas da comunidade) são `<img>` simples — não precisam de CORS.
- Único `canvas` (`SettingsPage.resizeImage`) desenha uma imagem `data:` do `FileReader` (mesma origem). Sem CSP no `index.html`.

### Testes
- **Protocolo no Electron 34 real** (página em `http://localhost`, `webSecurity` ligado, pasta com `# 100%` e acentos):
  Range 206 com bytes idênticos ao arquivo, sufixo, 416, HEAD, 403 para `.json`/UNC/relativo/host errado, 404
  inexistente ✅ · **Web Audio** `MediaElementSource → GainNode(0,5)` com `crossOrigin='anonymous'`: RMS 0,042
  (esperado ≈0,044 para o tom gerado) = **não é silêncio** ✅ · seek para 20 s audível ✅ · `<img>` e `<img ?v=>` ✅ ·
  `<video>` carrega e faz seek ✅ · `file://` bloqueado ✅ (21/21).
  - Observação: neste Chromium, sem `crossOrigin` também tocou (não ficou mudo). O `crossOrigin` foi mantido por ser
    o comportamento correto pela especificação e à prova de mudanças do Chromium.
- **App real** (`main.js` + `dist/` com userData temporário: faixa de 10 min com capa 600 px, playlist com capa
  `file://C:\...` crua, wallpaper em vídeo no formato **antigo**, fila salva em 0:12): capa grande, miniatura 96 px,
  capa de playlist e wallpaper em vídeo carregados via `nianmedia://` ✅ · play no painel **retoma em 0:12** e avança ✅ ·
  clicar em 75% da barra → 7:30, com nova requisição `Range: bytes=17891328-` → 206 ✅ · nenhum erro no console além do
  `file://` testado de propósito ✅
- `vite build` ✅ · sintaxe dos arquivos do main ✅
- Instalador gerado ✅ `dist-electron\NianPlay Setup 1.1.25.exe` + portátil `NianPlay 1.1.25.exe` (não publicado;
  `mediaProtocol.js` conferido dentro do `app.asar`)

### Teste manual (usuário, no app instalado)
- Testado pelo usuário no app real ✅ ("tudo está funcionando").

Roteiro usado como referência:
1. Tocar uma música da Biblioteca e de uma playlist; trocar de faixa (próxima/anterior/fim da música).
2. **Avançar** na música arrastando/clicando na barra (painel lateral e tela cheia); voltar para o início.
3. **Ganho LUFS audível:** numa playlist equalizada, comparar duas faixas com ganhos bem diferentes (ou mudar o ganho
   de uma faixa no Painel do Maestro) e ouvir a diferença de volume. Se o som sumir por completo = CORS falhou.
4. Música com cortes de trecho: o pulo continua acontecendo.
5. **Capas grandes** (painel lateral, tela cheia/vinil) e **miniaturas** nas listas (Biblioteca, playlist, fila).
6. Capas de **playlist** (Playlists, Biblioteca, Maestro, detalhe) — inclusive escolher uma nova capa de arquivo.
7. Trocar a capa de uma faixa pela tela cheia.
8. **Wallpaper**: o que já estava salvo continua aparecendo; escolher um novo de **imagem** e um de **vídeo**;
   modos normal/desfoque/transparente.
9. Fechar e abrir o app: **fila restaurada** e retomada no ponto certo.
10. Login (e-mail e Google), enviar/baixar da nuvem, Comunidade (capas remotas aparecem).
11. Arquivos em pastas com acentos, espaços, `#` ou `%` no nome.

### Arquivos
`main/mediaProtocol.js` (novo), `main/main.js`, `main/handlers/appearance.js`, `renderer/utils/covers.js`,
`renderer/store/PlayerContext.jsx`, `renderer/App.jsx`, `renderer/components/{StudioPanel,NowPlayingModal,MaestroModal,PlayerBar}.jsx`,
`renderer/pages/{CommunityPage,LibraryPage,PlaylistsPage,PlaylistDetailPage,SettingsPage}.jsx`, `renderer/data/updateLogs.js`, `package.json`.

---

## 1.1.24 — 22/10/2026 — Otimização de desempenho (fase 3)

**Motivo:** 1.1.23 testada e aprovada pelo usuário ("está tudo certo"); seguir com o backlog.

### Miniaturas de capa
- Novo `main/thumbnails.js`: gera cópias JPEG de 96 px (lado menor) em `userData/thumbs` com `nativeImage`
  (sem dependência nova), uma por vez com `setImmediate` entre elas; resultados aplicados ao banco em lotes de 20,
  **sobre o estado atual** (pula se a capa mudou durante o processo). Nome = hash do caminho normalizado +
  tamanho + data de modificação. Capas já pequenas usam o próprio arquivo; remotas/inexistentes/formato não
  suportado ficam com `cover_thumb: ''` e não são reprocessadas.
- Disparado ao iniciar o app, após escanear pasta, ao trocar capa (`library:updateTrack`) e ao vincular download.
  Ao terminar, envia `library:thumbsUpdated`; LibraryPage e PlaylistDetailPage recarregam as faixas
  (a Biblioteca preserva busca e seleção).
- Renderer: novo `utils/covers.js`; linhas da Biblioteca, playlist (lista, grupos, modal) e fila do StudioPanel
  usam `listCoverSrc()`. Bônus: URLs `file:///` agora são codificadas — antes `file://${path}` quebrava com `#`/`%`.

### Virtualização restante
- PlaylistDetailPage: faixas avulsas da **visualização por grupos** e o modal **"Adicionar faixas"** (biblioteca
  inteira) virtualizados. Busca do modal memoizada.
- `useVirtualRows`: observa também o contêiner da lista (abrir/fechar pasta acima move a lista sem scroll) e passou
  a atualizar direto no evento de scroll, sem `requestAnimationFrame`.

### Casamento de faixas nos imports
- Novo `main/trackMatch.js`: `findTrackMatch` (antes duplicado em `library.js` e `playlists.js`) + `TrackIndex`,
  com a mesma regra em O(1) por busca. Usado em `importPlaylistData` (comunidade) e `playlists:import` (arquivo).
  No import de arquivo, as camadas "frouxas" só rodam quando o casamento seguro não acha nada (antes rodavam
  sempre e eram descartadas).

### Robustez
- `db.js`: se gravar falhar repetidamente, as novas tentativas esperam cada vez mais (até 30 s) em vez de repetir
  a cada 400 ms para sempre (encontrado durante os testes).

### Não feito (decisão)
- `webSecurity`: trocar por protocolo próprio exige suporte a Range e CORS; sem CORS o Web Audio toca silêncio
  (quebraria o ganho LUFS). Fica como tarefa separada — detalhes em `CONTEXTO.md`.
- `PlayerBar.jsx`/`Sidebar.jsx` (sem uso) mantidos: achei que o repositório não tinha commits (engano — o Git só
  não estava instalado; corrigido no registro da publicação).

### Testes
- **Equivalência dos imports:** os handlers reais rodaram contra uma cópia do algoritmo antigo em 600 imports
  aleatórios (arquivo + comunidade, bibliotecas com títulos/artistas repetidos de propósito) → resultados idênticos ✅
- **Miniaturas:** teste rodando no Electron real: paisagem → 96 px de altura, retrato PNG → 96 px de largura, capa
  pequena reaproveitada, arquivo inexistente/URL remota/arquivo inválido marcados sem loop, `file:///` e `C:\`
  do mesmo arquivo → mesma miniatura (bug achado e corrigido no teste), nova execução sem mudanças não notifica,
  troca de capa regenera ✅
- **Virtualização (navegador, dados simulados):** visualização por grupos (900 faixas) e modal (1.200 faixas):
  área visível sempre preenchida em 7 + 4 posições, fim da lista correto, abrir/fechar pasta atualiza ✅;
  montar/desmontar todas as variantes sem erros no console ✅
- `vite build` ✅ · sintaxe dos arquivos do main ✅
- Instalador gerado ✅ `dist-electron\NianPlay Setup 1.1.24.exe` + portátil `NianPlay 1.1.24.exe` (não publicado)
- Testado manualmente pelo usuário no app real ✅ (junto com a 1.1.25: "tudo está funcionando").

---

## 1.1.23 — 22/10/2026 — Otimização de desempenho (fase 2)

**Motivo:** 1.1.22 testada e aprovada pelo usuário; seguir com o restante do diagnóstico.

### Persistência (item 4)
- `db.js`: cada arquivo é lido **uma vez** e mantido em memória; `write()` agenda gravação assíncrona com
  debounce de 400 ms, atômica (`arquivo.tmp` → `rename`, com fallback de escrita direta se o rename falhar no
  Windows). JSON compacto (sem indentação). `flushAllSync()` em `before-quit`/`will-quit` garante que nada
  pendente se perca; uma gravação assíncrona atrasada não sobrescreve a final (`_closed`).
- Sessão do player saiu do `settings.json` para `player_session.json` com `{ queue, state }`. Novo
  `handlers/player.js` (`player:getSession` / `saveState` / `saveQueue`) + `window.electron.player` no preload.
  Migração automática do `settings.playerSession` antigo.
- `PlayerContext`: `persistState()` (pequeno, debounce 350 ms + a cada 5 s **só enquanto toca**) e
  `persistQueue()` (só quando a fila muda). Antes, a fila inteira (~130 KB) era regravada a cada 5 s mesmo pausado.
- Arquivos: `main/db.js`, `main/handlers/player.js` (novo), `main/main.js`, `main/preload.js`, `renderer/store/PlayerContext.jsx`.

### Listas virtualizadas (item 3)
- Novo `hooks/useVirtualRows.js` + `components/VirtualRows.jsx` (sem dependência nova): renderiza só as linhas
  visíveis + 10 de margem, com espaçadores. Usa `useEffect` de propósito (ver comentário no hook).
- **LibraryPage**: lista inteira virtualizada (linhas `h-14` = 56 px); filtro de busca memoizado.
- **PlaylistDetailPage**: visualização em lista (padrão e durante busca) virtualizada (slot de 60 px).
  A visualização por **grupos** continua sem virtualização (alturas variáveis).
- `loading="lazy"` + `decoding="async"` nas capas das listas e da fila do StudioPanel.
- Verificado no navegador com dados simulados: 2.000 faixas → ~25 linhas no DOM; altura de rolagem exata;
  faixa correta visível após rolar; busca encolhe a lista corretamente; playlist de 1.500 faixas idem.

### Buscas O(n×m) (item 5)
- `playlists.js`: `getAll` (contagem por `Map`), `getTracks`, `reorder`, `reorderGroup`, `export`, atribuição de
  grupos nos imports e checagem de duplicadas no `import` agora usam `Map`/`Set`. Helper `indexFirst` preserva a
  semântica de `Array.find` (primeira linha) caso uma faixa apareça duas vezes.
- `lufs.js`: índice por id; e os ganhos são acumulados e aplicados **ao estado atual** do banco no fim da análise
  — corrige a perda de edições feitas durante a equalização (antes gravava uma cópia antiga do array inteiro).
- `youtube.js`: índice por id.
- `AuthContext.syncFromCloud`: não busca mais a biblioteca inteira via IPC **a cada faixa importada**.

### Code-splitting (item 7)
- `App.jsx`: páginas (exceto Biblioteca) e `NowPlayingModal` via `React.lazy` + `Suspense`.
  Bundle inicial 822 KB → 710 KB; o restante é Firebase + React (necessários na abertura).

### Extras
- Removido `webviewTag: true` (sem uso). `webSecurity: false` **mantido de propósito** (comentado no código):
  a UI é servida por http://localhost e carrega áudio/capas via `file://`.
- Corrigidas strings com encoding quebrado em `handlers/playlists.js` e `handlers/youtube.js`.

### Testes
- `vite build` ✅ · sintaxe dos arquivos do main ✅
- Teste isolado do `db.js` + `player.js` com `electron` simulado (debounce, atomicidade, migração da sessão,
  flush ao fechar, gravação atrasada não sobrescreve, arquivo corrompido → padrão) ✅
- Virtualização verificada no navegador com dados simulados ✅
- Instalador gerado ✅ `dist-electron\NianPlay Setup 1.1.23.exe` + portátil `NianPlay 1.1.23.exe` (não publicado)
- Testado manualmente pelo usuário no app real ✅ ("está tudo certo").

---

## 1.1.22 — 22/10/2026 — Otimização de desempenho (fase 1)

**Motivo:** o app estava "pesado". Diagnóstico feito sobre o código inteiro; aplicados os 3 itens de
maior ganho e menor risco.

### 1. Progresso do player isolado em contexto próprio
- **Antes:** o evento `timeupdate` (~4x/s) chamava `setProgress` no `PlayerContext`, e o `value` do Provider
  era um objeto novo a cada render → **toda** tela com `usePlayer()` (LibraryPage com centenas de linhas,
  PlaylistDetailPage, StudioPanel inteiro) re-renderizava 4x por segundo enquanto tocava.
- **Depois:** novo `PlayerProgressContext` + hook `usePlayerProgress()` só com `{ progress, duration }`.
  `value` principal e `upcomingItems`/`upcomingTracks` memoizados com `useMemo`.
  No `StudioPanel`, a barra de progresso virou o subcomponente `ProgressSection` (só ele re-renderiza).
- Arquivos: `store/PlayerContext.jsx`, `components/StudioPanel.jsx`, `components/NowPlayingModal.jsx`,
  `components/PlayerBar.jsx` (não usado, ajustado por consistência).

### 2. Menos `backdrop-blur` (GPU)
- **Antes:** `.playlist-track-row` tinha `backdrop-blur-sm` em **cada faixa**; com wallpaper,
  `.has-wallpaper .btn-ghost` e `.input-base` tinham `backdrop-blur-md` em **cada botão/input**
  (4–5 por linha). Centenas de camadas de blur recompostas a cada scroll/repaint.
- **Depois:** blur mantido só em `.panel`/`.card`/`.wallpaper-panel` (poucos e grandes). Linhas, botões e
  inputs usam fundo sólido um pouco mais opaco (visual quase idêntico). Removido também o blur do
  cabeçalho fixo da tabela da Biblioteca (já estava dentro de um painel com blur).
- Arquivos: `styles/globals.css`, `pages/LibraryPage.jsx`.

### 3. Animação do VU sem layout
- **Antes:** keyframe `vuPulse` animava `height` → layout + paint a cada frame, sem parar, enquanto tocava.
- **Depois:** anima `transform: scaleY()` com `transform-origin: bottom` (só compositor). Barras com altura fixa inline.
- Arquivos: `styles/globals.css`, `components/StudioPanel.jsx`.

### Correção de bug encontrada no caminho
- `NowPlayingModal` tinha `if (!currentTrack) return null` **antes** de um `useEffect` (viola as regras de hooks;
  podia quebrar o modal). Early return movido para depois dos hooks. Também passou a ignorar a cópia
  "fresca" da faixa anterior enquanto a nova carrega (antes mostrava título/capa errados por um instante).

### Outros
- `package.json` → 1.1.22; entrada nova em `data/updateLogs.js`.
- Criada esta pasta `contexto/`.

### Status
- Código alterado ✅
- `vite build` ✅ · renderer abre sem erros no console (checado no navegador) ✅
- Instalador gerado ✅ `dist-electron\NianPlay Setup 1.1.22.exe` (NSIS) + `dist-electron\NianPlay 1.1.22.exe` (portátil)
- **Não publicado** no GitHub (o `release.bat` não foi executado). O auto-updater só oferece a versão depois que ela é publicada.
- Testado manualmente pelo usuário no app real ✅ ("está tudo certo").

### Notas de ambiente (máquina recém-formatada)
- Node.js 24.20.0 LTS instalado via `winget install OpenJS.NodeJS.LTS`. **Git continua não instalado**, e o `release.bat` precisa dele.
- O electron-builder falhava ao extrair `winCodeSign` (symlinks de bibliotecas macOS exigem privilégio de admin).
  Solução: extrair manualmente o `.7z` para `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0`
  com o `7za.exe` de `node_modules\7zip-bin` (os 2 erros de symlink do macOS podem ser ignorados). Só é preciso fazer uma vez por máquina.

### Próximos itens do backlog (não feitos ainda)
Ver "Problemas conhecidos" em `CONTEXTO.md`: persistência em memória/debounce, virtualização de listas +
miniaturas, índices `Map`/lote no main e no sync da nuvem, code-splitting das páginas.

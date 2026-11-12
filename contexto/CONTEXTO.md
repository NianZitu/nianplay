# NianPlay — Prompt de Contexto

> Cole este arquivo (e o `PROGRESSO.md`) no início de uma conversa com uma IA para
> ela entender o projeto sem precisar reler todo o código. Mantenha os dois atualizados
> a cada mudança relevante.

## O que é

**NianPlay** é um player de música local para Windows, feito em **Electron 34 + React 18 + Vite 5 + Tailwind 3**.
Interface em português (pt-BR). Autor: NianZitu. Repositório de releases: `github.com/NianZitu/nianplay`.

Principais funções:
- Biblioteca local: escaneia pastas, lê metadados/capas com `music-metadata`.
- Playlists com **grupos de sequência** (faixas que tocam juntas e em ordem, mesmo no aleatório).
- **Equalização de playlist por LUFS**: mede loudness com ffmpeg (`ebur128`) e grava um ganho (dB) por faixa relativo a uma faixa âncora; o ganho é aplicado via Web Audio `GainNode`.
- **Cortes de trechos** (`cut_segments`) por faixa — o player pula esses trechos e ajusta a duração exibida.
- **Downloads** do YouTube (e outros sites) via `yt-dlp` + `ffmpeg-static`; busca no YouTube; resolve playlists do **Spotify** e baixa as faixas correspondentes.
- Exporta playlist para uma playlist real no **YouTube** (OAuth com refresh token configurado pelo usuário).
- **Conta e nuvem (Firebase Auth + Firestore)**: enviar/baixar biblioteca e playlists; publica playlists na **Comunidade**.
- Letras (lyrics.ovh), "Painel do Maestro" (editor de metadados/ganho/cortes/letra por faixa), wallpaper de imagem/vídeo, auto-updater (`electron-updater` via GitHub Releases).

## Estrutura

```
src/main/                  Processo principal (Node/Electron)
  main.js                  Cria a janela; em produção serve dist/ por HTTP local (porta 17654); baixa/atualiza yt-dlp
  mediaProtocol.js         Protocolo nianmedia:// — serve áudio/capas/wallpapers locais (Range + CORS) com webSecurity ligado
  preload.js               contextBridge → window.electron.{library,playlists,downloader,lufs,settings,...}
  db.js                    "Banco" em arquivos JSON no userData (%APPDATA%\nianplay) — cache em memória,
                           gravação assíncrona com debounce (400 ms) + atômica (.tmp → rename); flushAllSync() ao fechar
  ytdlp-path.js            Caminho do binário yt-dlp
  trackMatch.js            findTrackMatch (regra de casamento de faixas) + TrackIndex (mesma regra, O(1) por busca)
  mediaUrl.js              youtubeVideoId / canonicalUrl / urlKey — TODA comparação/gravação de link passa por aqui
                           (cópia para o renderer em renderer/utils/mediaUrl.js — manter iguais)
  urlRepair.js             repairTrackUrls(): preenche yt_url vazio a partir do histórico de downloads, só com
                           evidência exata (caminho do arquivo; ou nome idêntico → um único vídeo)
  thumbnails.js            Miniaturas 96 px das capas (userData/thumbs) em segundo plano via nativeImage;
                           avisa a UI com o evento 'library:thumbsUpdated'
  handlers/                Um arquivo por domínio de IPC:
    library.js  playlists.js  downloader.js  lufs.js  spotify.js  youtube.js
    ytSearch.js  lyrics.js  settings.js  appearance.js  updater.js  window.js
    player.js              Sessão do player (fila + estado) em player_session.json
src/renderer/              React (Vite root)
  App.jsx                  Layout 3 colunas: NavRail | página | StudioPanel. Navegação por estado (sem router).
                           LibraryPage é carregada junto; as demais páginas e o NowPlayingModal via React.lazy
  hooks/useVirtualRows.js  Virtualização de listas com linhas de altura fixa
  components/VirtualRows.jsx  Componente que usa o hook (spacers + fatia visível)
  utils/covers.js          mediaUrl (caminho → nianmedia://), mediaSrc (qualquer src de imagem/vídeo, converte
                           file:// legado), coverSrc (capa grande), listCoverSrc (miniatura p/ listas)
  store/PlayerContext.jsx  Toda a lógica de reprodução (Audio + AudioContext/GainNode, fila, shuffle, cortes, sessão)
  contexts/AuthContext.jsx Login Firebase + syncToCloud / syncFromCloud
  firebase.js              Config do Firebase + IDs determinísticos de faixa/playlist na nuvem
  pages/                   LibraryPage, PlaylistsPage, PlaylistDetailPage (maior arquivo), DownloadsPage,
                           CommunityPage, SettingsPage, UpdateLogsPage
  components/              StudioPanel (player lateral + fila/letra), NowPlayingModal (tela cheia),
                           NavRail, TitleBar, UpdateBanner, MaestroModal, LoginModal
                           (PlayerBar.jsx e Sidebar.jsx existem mas NÃO são usados hoje)
  data/updateLogs.js       Changelog exibido na tela "Atualizações" — adicionar entrada a cada versão
  styles/globals.css       Classes utilitárias (btn-*, panel, playlist-track-row, has-wallpaper ...)
DESIGN_SYSTEM.md           Guia visual
release.ps1                Commit/push + release no GitHub com notas de release-notes\<versão>.md e os 4 arquivos
                           do auto-updater, via GitHub CLI (`gh`, logado com `gh auth login --web`). Substitui o
                           release.bat. Manter o arquivo só em ASCII (PowerShell 5.1). O .release-token está expirado
release.bat                Script antigo — NÃO usar: só envia o instalador (sem latest.yml o auto-updater não vê a
                           versão), manda nota genérica e depende de python3
release-notes/             Corpo da release no GitHub por versão (é o texto que usuários de versões antigas veem)
contexto/                  Esta pasta (documentação para IA / histórico)
bot/                       Bot de Discord do NianPlay (projeto Node separado, NÃO entra no instalador do app).
                           Ver "Bot de Discord" abaixo e bot/README.md
```

### Dados (userData = `%APPDATA%\nianplay`)
`tracks.json`, `playlists.json`, `playlist_tracks.json` (relação playlist↔faixa com `position`, `group_id`, `group_position`),
`playlist_groups.json`, `downloads.json`, `settings.json` (`downloadPath`, `accountWallpaper`, `accountProfile`,
cookies do yt-dlp, credenciais do YouTube), `player_session.json` (`{ queue, state }` — desde 1.1.23; antes
ficava em `settings.playerSession` e é migrado automaticamente na primeira leitura).

Os arquivos são gravados compactos (sem indentação). **`read()` devolve a referência em cache**: o padrão dos
handlers é ler → alterar o próprio array → `write(array)`. Não alterar o retorno de `read()` sem chamar `write()`.

Faixa "virtual" = faixa sem `file_path` (veio da nuvem/import); pode ser baixada depois ("sem arquivo").

Campos de miniatura na faixa (desde 1.1.24): `cover_thumb` (caminho da miniatura, `''` se não deu para gerar)
e `cover_thumb_src` (o `cover_path` de onde ela foi feita). A UI só usa a miniatura enquanto
`cover_thumb_src === cover_path`; trocar a capa invalida automaticamente. Pasta: `%APPDATA%\nianplay\thumbs`.

## Comandos

- Dev: `npm start` (Vite em :5173 + Electron)
- Build + instalador: `npm run build` → `dist-electron\NianPlay Setup <versão>.exe` (NSIS) + portátil
  - Para só gerar localmente sem publicar: `npx vite build` e `npx electron-builder --win --publish never`
- Publicar release (ação pública): gerar a build, escrever `release-notes\<versão>.md` e rodar
  `powershell -ExecutionPolicy Bypass -File release.ps1`. O script confere tudo antes do push.
  - **Por que as notas no GitHub importam:** o banner de atualização de quem está numa versão antiga mostra o corpo
    da release (até 6 linhas). Se ele for genérico, o app procura o texto no próprio changelog embutido — que, numa
    versão antiga, ainda não conhece a nova. Colocar as linhas mais importantes no topo.
  - Nome dos arquivos no GitHub: `NianPlay-Setup-<v>.exe` (igual ao `url` do `latest.yml`), `.blockmap`, portátil
    `NianPlay-<v>-portable.exe` e `latest.yml`.
- Git: a pasta veio de backup com dono "SISTEMA"; foi preciso `git config --global --add safe.directory '<pasta>'`.

## Convenções

- Versão em `package.json` + nova entrada no topo de `src/renderer/data/updateLogs.js` (texto sem acentos, como as anteriores).
- Textos da UI em pt-BR; comentários de código em inglês.
- IPC sempre via `ipcMain.handle` / `ipcRenderer.invoke`, exposto em `preload.js`.
- Componentes que precisam do **tempo de reprodução** usam `usePlayerProgress()`; o resto usa `usePlayer()`
  (ver PROGRESSO 1.1.22 — não colocar `progress`/`duration` de volta no contexto principal).
- Evitar `backdrop-blur` em elementos repetidos (linhas de lista, botões); usar só em painéis grandes.
- Animações contínuas devem usar `transform`/`opacity`, nunca `height`/`width`.
- Listas longas usam `<VirtualRows>`: **a altura de cada linha precisa ser fixa e igual à constante**
  (`ROW_HEIGHT = 56` na LibraryPage — classe `h-14`; `FLAT_ROW_SLOT = 60` na PlaylistDetailPage, usado na lista
  simples e nas faixas avulsas da visualização por grupos — linha 58 px + 2 px; `ADD_ROW_SLOT = 57` no modal
  "Adicionar faixas" — 53 px + 4 px). Se mudar o layout da linha, atualize a constante.
- Capas em listas: use `listCoverSrc(track)` (miniatura); capas grandes: `coverSrc(path)`; áudio: `mediaUrl(path)`;
  wallpaper/outros: `mediaSrc(src)`. **Nunca montar `file://`** — com `webSecurity` ligado (1.1.25) o Chromium bloqueia.
  Valores `file://` já salvos (capa de playlist, wallpaper antigo) são convertidos por essas funções.
- Mídia nova (extensão nova) precisa estar no `MIME_TYPES` de `main/mediaProtocol.js`, senão o protocolo responde 403.
- O `Audio` do player tem `crossOrigin = 'anonymous'` (Web Audio + mídia de outra origem). Se mudar as origens da UI
  (porta 17654/5173), atualize as origens passadas a `handleMediaProtocol` em `main.js`.
- Ao adicionar código que cria/troca capas no main, chame `scheduleThumbnails()` (de `thumbnails.js`).
- **Links das músicas (yt_url):** nunca associar link a uma faixa por nome parecido. O downloader registra
  `download.files = [{ url, path }]` com o caminho final exato (yt-dlp `--print after_move`); a faixa recebe o link
  pelo caminho (`linkFilesToLibrary`, `startForTrack`, `scanDirectory`, `repairTrackUrls`). Comparar links com
  `urlKey`, gravar com `canonicalUrl`. Para faixas sem evidência, o usuário escolhe em "Verificar links".
- **Nomes de playlist são únicos por conta** (`main/playlistNames.js`; cópia de `normalizePlaylistName` em
  `renderer/firebase.js` — manter iguais). O id na nuvem é conta + nome normalizado: mesmo nome = mesmo documento
  (substitui). Nunca criar/renomear playlist sem passar pelas regras (create/update/merge recusam; duplicate/imports usam
  `uniqueName`).
- Casamento de faixas (imports/sync): use `findTrackMatch`/`TrackIndex` de `trackMatch.js`, não reimplemente.
  Ao acrescentar faixas à biblioteca durante um loop com `TrackIndex`, chame `index.add(t)`; ao definir `yt_url`
  numa faixa já indexada, `index.noteUrl(t)`.
- Em loops no processo principal, indexar com `Map` (ou o helper `indexFirst` em `playlists.js`, que mantém
  a semântica de `Array.find` = primeiro item) em vez de `find()` dentro de `map()/forEach()`.

## Bot de Discord (`bot/`)

Projeto Node separado (CommonJS, Node ≥ 22.12) para rodar numa VPS (Hostinger, Ubuntu). Toca YouTube, Spotify
(resolvido para YouTube) e playlists da nuvem do NianPlay, **sem baixar arquivos** (yt-dlp `-g` → URL direta do
áudio → ffmpeg → PCM → `@discordjs/voice` com volume inline; opus por `@discordjs/opus` se compilar, senão `opusscript`).
`@discordjs/voice` 0.19 já traz o DAVE (criptografia de voz exigida pelo Discord desde 2026).

- **Leitura da nuvem sem segredo:** coleção pública `communityPlaylists` via REST do Firestore com a apiKey pública do app
  (`bot/src/sources/nianplay.js`). Cada doc tem `tracks` (na ordem, com `yt_url`, `gain`, `cut_segments`, `lyrics`,
  `group_name`, `group_position`) e `groups`. Desde a 1.1.28 o id é conta + nome e o sync apaga as cópias antigas do
  dono; a busca por nome do bot ainda prefere o `updatedAt` mais recente (útil enquanto houver cópias antigas).
- **Link do bot:** botão 🤖 "Copiar link do bot" no detalhe da playlist → `nianplay://playlist/<playlistCloudId>`
  (confere se o doc existe na nuvem antes de copiar; avisa se a contagem de faixas difere). O bot aceita link, ID ou nome.
- **Grupos:** `bot/src/queue/grouping.js` replica exatamente `buildGroupedQueue` do app (testado contra uma cópia do
  algoritmo do app com os mesmos números aleatórios). `/shuffle` na fila com grupos: o resto do grupo atual continua em
  seguida e o restante é embaralhado por grupos (avulsas intercaladas).
- **Compatibilidade extra:** aplica `gain` (LUFS) com `volume=XdB` e os `cut_segments` com `aselect` no ffmpeg (seek
  converte tempo "tocável" → tempo do áudio, mesma lógica do PlayerContext).
- Faixas sem `yt_url` (NianPlay) e do Spotify são procuradas no YouTube **na hora de tocar**, com a mesma pontuação
  (`scoreYt`) do app.
- **Deploy:** `bot/deploy/install.sh` (Node 22, ffmpeg, yt-dlp, usuário `nianplay`, `/opt/nianplay` via clone esparso
  do repo público, serviço systemd `nianplay-bot` + timer diário `yt-dlp -U`), `bot/deploy/update.sh`. Código de saída
  78 = erro de configuração (token) → systemd não reinicia em loop.
- **Risco principal:** IPs de datacenter são bloqueados pelo YouTube ("confirm you're not a bot") → `YTDLP_COOKIES`
  (cookies.txt de conta secundária). Mensagem amigável já tratada em `ytdlp.js`.
- Testes: `cd bot && npm test` (grupos vs app, fila do player).

## App para iPhone (`mobile/`, branch `mobile`)

App iOS com **Capacitor 8** (WKWebView + SPM), instalado por **sideload com AltStore** (.ipa sem assinatura — o
AltStore assina com o Apple ID do usuário; com Apple ID gratuito o app expira em 7 dias e o AltStore renova).
Interface **no estilo do Spotify mobile** (pedido do usuário), com as cores e blocos do NianPlay.

- **Build:** não dá para compilar iOS no Windows. `.github/workflows/ios.yml` roda num Mac do GitHub Actions
  (grátis, repo público): `vite build --config mobile/vite.config.js` → `npx cap add ios` → `mobile/ci/patch-ios.sh`
  (nome, `UIBackgroundModes=audio`, `UIFileSharingEnabled`, só retrato, ícone/splash de `mobile/resources`,
  `AVAudioSession .playback` no AppDelegate) → `cap sync` → `xcodebuild archive` sem assinatura → `Payload/App.app`
  zipado como `NianPlay-<versão>.ipa` (artefato `NianPlay-ipa`). Dispara em push no branch `mobile` ou manualmente.
  Baixar: `gh run download <id> --repo NianZitu/nianplay -n NianPlay-ipa`.
- **Dev local:** `npx vite --config mobile/vite.config.js` (porta 5174; config `nianplay-mobile` no launch.json) —
  roda no navegador com o Filesystem web do Capacitor (IndexedDB); arquivos importados tocam via blob só na sessão.
- **Reaproveita** `src/renderer`: `store/PlayerContext.jsx` (player, ganho, cortes, grupos), `contexts/AuthContext.jsx`
  (login e "Baixar da nuvem"), `utils/*`, `components/VirtualRows.jsx`, `globals.css` e o tema do Tailwind. Ganchos
  no código compartilhado (sem efeito no desktop): `window.nianplayPlatform.mediaUrl` (covers.js),
  `webAudio === false` desliga o Web Audio (PlayerContext.connectAudioGraph), `outputGain` ("Volume do NianPlay",
  50% por padrão) e `createAudio()` — o PlayerContext cria o "elemento de áudio" por ele (player nativo, abaixo) e
  usa os ganchos opcionais `audio.setTrack(track)`, `audio.setGain(track)`, `audio.setUpcoming(tracks)` e o evento
  `nativeadvance`.
- **Player nativo (0.2.0, `mobile/plugins/nian-native-player/`, plugin Capacitor local via SPM):** AVPlayer em Swift
  (`ios/Sources/NianNativePlayerPlugin/NianNativePlayerPlugin.swift`). **Por quê:** com Web Audio (necessário para o
  ganho LUFS no iOS) o iOS suspende o AudioContext quando o app sai da tela — a música "continuava tocando" muda e
  adiantava. **A fila também fica no nativo:** em segundo plano o iOS congela o JavaScript do WebView, então o
  PlayerContext não consegue trocar de música; o JS manda as próximas 80 (`setUpcoming`), o Swift avança sozinho
  (fim da música, próximo/anterior da tela de bloqueio), pula os cortes, aplica o volume por faixa (ganho LUFS ×
  volume do app, máx. 1) e avisa o JS (`advanced` → `nativeadvance` → `adoptNativeTrack` aponta a fila para a
  música atual). Tela de bloqueio/Central de Controle por MPNowPlayingInfoCenter + MPRemoteCommandCenter (a Media
  Session do WebView fica desligada). Ponte JS: `mobile/src/platform/nativeAudio.js` (imita um HTMLAudioElement).
  Usado só se `Capacitor.isPluginAvailable('NianNativePlayer')`. **Teste no navegador:** `localStorage.nianNativeWeb
  = '1'` liga o mesmo caminho com `plugins/nian-native-player/web.js` (imita o Swift com `<audio>`; `__nianNative.advance()`
  simula o "próximo" da tela de bloqueio).
- **`mobile/src/platform/`** — implementa `window.electron` no celular: `storage.js` (tabelas JSON em
  `Library/nianplay/`, mesmo modelo do db.js, flush ao ir para segundo plano), `api.js` (library/playlists/settings/
  player/lyrics com o mesmo comportamento dos handlers do desktop), `rules.js` (nomes únicos de playlist e
  findTrackMatch — cópias fiéis), `paths.js`, `id3.js` (leitor ID3v2 próprio — testado igual ao music-metadata nos
  302 MP3 do usuário, capas byte a byte), `media.js` (importação).
- **Caminhos guardados são relativos** (o iOS muda a pasta do app a cada atualização): `nian-lib://music/…`
  (cópias importadas, `Library/NoCloud`), `nian-lib://covers/…` (capa 600 px + miniatura 120 px) e
  `nian-docs://…` (arquivos na pasta Documentos, visível em Arquivos › No meu iPhone › NianPlay e no Dispositivos
  Apple/iTunes do PC; lida no lugar). `paths.mediaUrl` → `Capacitor.convertFileSrc` (mesma origem, Range).
- **Música no celular:** importar do app Arquivos (copia em blocos de 3 MB) ou escanear Documentos (automático ao
  abrir/voltar ao app). Cada arquivo é **ligado à faixa da nuvem sem arquivo** se título+artista baterem
  (findTrackMatch); arquivo **sem tag de artista** liga por título só se for o único título igual na biblioteca e a
  duração bater (±3 s). Duplicatas não são copiadas; duplicatas em Documentos ficam em `settings.ignoredDocs`.
- **Nuvem: só "Baixar da nuvem".** O "Enviar para nuvem" do desktop APAGA e regrava tudo — de um celular com parte
  das músicas destruiria as playlists do PC. Login só por e-mail/senha (popup do Google não funciona no WKWebView).
- **Fora do mobile (exigem Node/binários):** downloads (yt-dlp), medição LUFS (os ganhos vêm da nuvem), Spotify,
  export para o YouTube, comunidade. **Grupos de sequência** existem no celular desde a 0.1.2 (pastas na playlist,
  tocar o grupo, criar/excluir, adicionar/reordenar faixas pelo menu).
- **Interface (`mobile/src/ui/`):** navegação do Spotify, visual do desktop (desde a 0.3.0, seguindo
  `DESIGN_SYSTEM.md`). Abas Início / Buscar / Biblioteca (pilha de páginas por aba; tocar na aba ativa volta ao
  início; barra no estilo do NavRail: pílula âmbar + indicador); conta pelo avatar com a moldura do desktop
  (`screens/Account.jsx`, seções em `.panel` como as Configurações). Base em `common.jsx` (`PageHeader` = cabeçalho
  fixo com logo, título 26 px font-black e contagens; `SectionTitle` com rótulo em caixa alta; `Sheet` no visual de
  modal; `MenuList` com destrutivos separados; `VUBars`; `EmptyState`) e classes `m-*` em `mobile.css`
  (`m-row` = bloco de linha como `.playlist-track-row`, `m-chip-primary/ghost`, `m-icon-btn`, `m-label`).
  `screens/Collection.jsx` = playlist, "Todas as músicas" e artista (hero do PlaylistDetail: capa ao lado do rótulo
  PLAYLIST/título/contagens, "Reproduzir" âmbar + aleatório + ferramentas, faixas numeradas; grupos só como pastas
  na lista (o painel de chips foi tirado na 0.3.1 a pedido do usuário — com muitos grupos ocupava a tela); barra "Voltar" que ganha o título ao rolar); `MiniPlayer.jsx` (bloco do
  StudioPanel: brilho da capa, VU, play âmbar, progresso âmbar; deslizar troca de música); `NowPlaying.jsx` (layout
  do StudioPanel: título sobre o degradê da capa + VU, abas Fila | Letra na tela; puxar para baixo fecha);
  `tracks.jsx` (linha em bloco + menu por "⋯"/toque longo; `PlaylistArt` = capa própria, senão mosaico 2×2 das capas
  das músicas, senão o ícone do desktop); Biblioteca em lista ou grade (galeria do desktop; `settings.mobileLibraryView`);
  `playContext.js` ("Tocando da playlist…" e "Tocadas recentemente").
  Deslizar uma música para a direita = "Adicionar à fila" (Spotify; `useAddToQueue` em App.jsx, depois das que já
  foram adicionadas). Controles da tela de bloqueio: player nativo (acima); Media Session só no navegador.
- **Ícones:** o projeto usa `lucide-react` 0.344 — nomes antigos (`DownloadCloud`, não `CloudDownload`).
- **Tailwind do mobile:** `content` com caminhos absolutos (o Tailwind resolve a partir da pasta de execução).

## Problemas conhecidos / próximos passos

Fases 1–3 de otimização concluídas (ver `PROGRESSO.md`, versões 1.1.22, 1.1.23 e 1.1.24).
`webSecurity` ligado desde 1.1.25 (protocolo `nianmedia://`) — testado e aprovado pelo usuário. **1.1.25 publicada**
no GitHub em 22/10/2026 (versão com toda a otimização; 1.1.22–1.1.24 nunca foram publicadas). Ainda em aberto:
1. Electron avisa "Insecure Content-Security-Policy" no console (não há CSP). Adicionar uma CSP exige listar
   Firebase/Google, `nianmedia:`, `data:`, `https:` (imagens remotas) — tarefa separada.
2. Pastas abertas dentro da visualização por grupos não são virtualizadas (grupos costumam ser pequenos).
3. O bundle inicial (~710 KB) é quase todo Firebase + React, necessários na abertura (AuthProvider envolve o app).
4. `PlayerBar.jsx` e `Sidebar.jsx` não são usados (código morto). Não foram apagados porque o repositório não
   tinha commits — **engano**: o Git só não estava instalado; o repositório tem histórico (último commit antes
   da otimização: "Release 1.1.21"). Podem ser apagados com segurança.
5. Miniaturas órfãs: remover uma faixa ou limpar a biblioteca não apaga o arquivo em `thumbs/` (são poucos KB cada).
6. `AuthContext.findTrackMatch` (renderer, sync da nuvem) ainda é a versão linear; aceitável para o tamanho atual.

### Dica para testes no navegador (preview)
Com o painel do navegador **oculto**, o Chromium não despacha eventos de `scroll` nem roda `requestAnimationFrame`
em tempo real (~1 s). Para testar listas virtualizadas ali, dispare `el.dispatchEvent(new Event('scroll'))`
depois de mudar `scrollTop`. Na janela real do app isso não acontece.

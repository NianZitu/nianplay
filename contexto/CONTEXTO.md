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
- Casamento de faixas (imports/sync): use `findTrackMatch`/`TrackIndex` de `trackMatch.js`, não reimplemente.
  Ao acrescentar faixas à biblioteca durante um loop com `TrackIndex`, chame `index.add(t)`; ao definir `yt_url`
  numa faixa já indexada, `index.noteUrl(t)`.
- Em loops no processo principal, indexar com `Map` (ou o helper `indexFirst` em `playlists.js`, que mantém
  a semântica de `Array.find` = primeiro item) em vez de `find()` dentro de `map()/forEach()`.

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

# NianPlay Bot

Bot de música para Discord que toca **YouTube**, **Spotify** e as **playlists da nuvem do NianPlay** —
inclusive com os **grupos de sequência**. Nada é baixado: o áudio é transmitido direto do YouTube.

## Comandos

| Comando | O que faz |
|---|---|
| `/play busca` | Toca um nome, link do YouTube, playlist do YouTube, Spotify (faixa, álbum, playlist) ou link de outros sites |
| `/playnext busca` | Igual ao `/play`, mas toca logo em seguida |
| **`/nianplay playlist`** | Toca uma playlist do NianPlay **na ordem da playlist**. Cole o link copiado no app ou digite o nome (aparecem sugestões) |
| **`/group playlist`** | Toca a playlist do NianPlay com os **grupos ativos**: cada grupo na ordem definida no app, depois as músicas avulsas |
| **`/shuffle`** | Embaralha a fila. **No modo grupo** embaralha só a **ordem dos grupos** (cada grupo continua na sua sequência) e intercala as músicas avulsas entre eles — igual ao aleatório com grupos do app. O resto do grupo que está tocando continua em seguida |
| `/pause` `/resume` | Pausa / continua |
| `/skip [quantidade]` `/previous` | Próxima / anterior |
| `/stop` | Para e limpa a fila |
| `/leave` | Sai do canal |
| `/queue [pagina]` `/nowplaying` | Fila / música atual (com barra de progresso) |
| `/loop modo` | Repetição: desligada, faixa ou fila |
| `/volume valor` | 0 a 200% |
| `/seek tempo` | Vai para um ponto (`1:30` ou `90`) |
| `/remove` `/move` `/skipto` `/clear` | Edita a fila |
| `/lyrics` | Letra (a salva no NianPlay, ou do lyrics.ovh) |
| `/help` | Lista de comandos |

A mensagem "Tocando agora" tem botões: ⏮️ ⏯️ ⏭️ 🔀 🔁 ⏹️.

### Compatibilidade com o NianPlay
- O bot lê as playlists que você **enviou para a nuvem** no app (menu da conta → *Enviar para nuvem*).
- No app, abra a playlist e clique em **🤖 Copiar link do bot**. Cole o link (`nianplay://playlist/...`) no `/nianplay` ou `/group`.
- Usa os **links do YouTube salvos em cada música**. Músicas sem link são procuradas no YouTube pelo nome na hora de tocar
  (menos preciso) — use **Verificar links** no app para completar.
- Aplica o **ganho da equalização (LUFS)** e os **cortes de trecho** salvos no app, para soar igual (dá para desligar no `.env`).

---

## 1. Criar o bot no Discord

1. Acesse <https://discord.com/developers/applications> → **New Application** → dê o nome (ex.: *NianPlay*).
2. Em **General Information**, copie o **Application ID** → é o `DISCORD_CLIENT_ID`.
3. Em **Bot**, clique em **Reset Token** e copie o token → é o `DISCORD_TOKEN`. **Não compartilhe esse token.**
   (Nenhum "Privileged Gateway Intent" é necessário.)
4. Convide o bot para o seu servidor abrindo este link (troque `SEU_APPLICATION_ID`):

   ```
   https://discord.com/oauth2/authorize?client_id=SEU_APPLICATION_ID&scope=bot+applications.commands&permissions=36719616
   ```
   Permissões: ver canais, enviar mensagens, inserir links, conectar, falar e usar detecção de voz.

## 2. Instalar na VPS (Ubuntu/Debian — Hostinger)

Conecte na VPS por SSH (no painel da Hostinger: *VPS → Gerenciar → SSH*) e rode:

```bash
curl -fsSL https://raw.githubusercontent.com/NianZitu/nianplay/main/bot/deploy/install.sh | sudo bash
```

Isso instala Node.js 22, ffmpeg e yt-dlp, baixa o bot em `/opt/nianplay/bot` e cria o serviço `nianplay-bot`
(inicia sozinho quando a VPS liga e reinicia se cair). O yt-dlp é atualizado todo dia automaticamente.

Depois, configure:

```bash
sudo nano /opt/nianplay/bot/.env
```
Preencha `DISCORD_TOKEN` e `DISCORD_CLIENT_ID` (salve com Ctrl+O, Enter, Ctrl+X). Então:

```bash
sudo -u nianplay bash -c "cd /opt/nianplay/bot && npm run deploy-commands"
sudo systemctl restart nianplay-bot
```

Pronto. Para ver o log:
```bash
sudo journalctl -u nianplay-bot -f
```

> Dica: preencha `DISCORD_GUILD_ID` com o ID do seu servidor para os comandos aparecerem na hora.
> Sem ele, os comandos são globais e podem levar até 1 hora para aparecer.

## 3. Se o YouTube bloquear a VPS

Servidores de datacenter são bloqueados com frequência pelo YouTube. O sintoma é a mensagem
*"O YouTube bloqueou o servidor"* (no log: `Sign in to confirm you're not a bot`). A solução é usar cookies de uma conta:

1. Em um navegador no seu PC, entre no YouTube com uma conta — **de preferência uma conta secundária**.
2. Instale a extensão **"Get cookies.txt LOCALLY"** e, com o YouTube aberto, exporte o `cookies.txt`.
3. Envie para a VPS (no PC): `scp cookies.txt root@IP_DA_VPS:/opt/nianplay/bot/cookies.txt`
4. Na VPS:
   ```bash
   sudo chown nianplay:nianplay /opt/nianplay/bot/cookies.txt && sudo chmod 600 /opt/nianplay/bot/cookies.txt
   sudo nano /opt/nianplay/bot/.env        # YTDLP_COOKIES=/opt/nianplay/bot/cookies.txt
   sudo systemctl restart nianplay-bot
   ```
Os cookies expiram de tempos em tempos; se o bloqueio voltar, exporte de novo.

## 4. Spotify (opcional)

Sem configuração, playlists e álbuns do Spotify são lidos pela página pública (até ~100 faixas).
Para playlists maiores, crie um app gratuito em <https://developer.spotify.com/dashboard> e preencha
`SPOTIFY_CLIENT_ID` e `SPOTIFY_CLIENT_SECRET` no `.env`. O áudio sempre vem do YouTube (o Spotify não permite tocar o áudio dele).

## Atualizar

```bash
sudo bash /opt/nianplay/bot/deploy/update.sh
```

## Rodar no PC (para testar)

Requer Node.js 22.12+, ffmpeg e yt-dlp (no PATH ou em `FFMPEG_PATH`/`YTDLP_PATH`).
```bash
cd bot
npm install
cp .env.example .env       # preencha
npm run deploy-commands
npm start
```
Testes da lógica (fila, grupos): `npm test`.

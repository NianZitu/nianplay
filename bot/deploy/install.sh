#!/usr/bin/env bash
# NianPlay Bot — instalação em uma VPS Ubuntu/Debian (Hostinger etc.).
#
#   curl -fsSL https://raw.githubusercontent.com/NianZitu/nianplay/main/bot/deploy/install.sh | sudo bash
#
# Instala Node.js 22, ffmpeg e yt-dlp, baixa o bot em /opt/nianplay, cria o usuário de sistema
# "nianplay" e o serviço systemd "nianplay-bot" (inicia no boot e reinicia sozinho se cair),
# além de um timer que atualiza o yt-dlp todo dia. Pode ser executado de novo para reinstalar.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/NianZitu/nianplay.git}"
APP_DIR="/opt/nianplay"
BOT_DIR="$APP_DIR/bot"
BOT_USER="nianplay"

if [ "$(id -u)" -ne 0 ]; then echo "Execute como root (sudo)."; exit 1; fi

echo "==> Pacotes do sistema (ffmpeg, git, curl)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ffmpeg git curl ca-certificates

NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"; fi
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "==> Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
echo "    node $(node -v), npm $(npm -v)"

echo "==> yt-dlp"
curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o /usr/local/bin/yt-dlp
chmod 755 /usr/local/bin/yt-dlp
echo "    yt-dlp $(/usr/local/bin/yt-dlp --version)"

echo "==> Usuário de sistema '$BOT_USER'"
id "$BOT_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "/home/$BOT_USER" --shell /usr/sbin/nologin "$BOT_USER"

echo "==> Código do bot em $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -c safe.directory="$APP_DIR" -C "$APP_DIR" fetch --depth 1 origin main
  git -c safe.directory="$APP_DIR" -C "$APP_DIR" reset --hard origin/main
else
  git clone --depth 1 --filter=blob:none --sparse "$REPO_URL" "$APP_DIR"
  git -c safe.directory="$APP_DIR" -C "$APP_DIR" sparse-checkout set bot
fi
chown -R "$BOT_USER:$BOT_USER" "$APP_DIR"

echo "==> Dependências do bot"
sudo -u "$BOT_USER" bash -c "cd '$BOT_DIR' && { npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund; }"

if [ ! -f "$BOT_DIR/.env" ]; then
  cp "$BOT_DIR/.env.example" "$BOT_DIR/.env"
  chown "$BOT_USER:$BOT_USER" "$BOT_DIR/.env"
fi
chmod 600 "$BOT_DIR/.env"
# Paths of the installed tools
sed -i "s#^YTDLP_PATH=.*#YTDLP_PATH=/usr/local/bin/yt-dlp#; s#^FFMPEG_PATH=.*#FFMPEG_PATH=$(command -v ffmpeg)#" "$BOT_DIR/.env"

echo "==> Serviço systemd"
install -m 644 "$BOT_DIR/deploy/nianplay-bot.service" /etc/systemd/system/nianplay-bot.service
install -m 644 "$BOT_DIR/deploy/nianplay-ytdlp-update.service" /etc/systemd/system/nianplay-ytdlp-update.service
install -m 644 "$BOT_DIR/deploy/nianplay-ytdlp-update.timer" /etc/systemd/system/nianplay-ytdlp-update.timer
systemctl daemon-reload
systemctl enable --now nianplay-ytdlp-update.timer
systemctl enable nianplay-bot

if grep -q '^DISCORD_TOKEN=$' "$BOT_DIR/.env"; then
  cat <<MSG

==============================================================================
 Instalado! Falta configurar o bot:
   1. sudo nano $BOT_DIR/.env        (preencha DISCORD_TOKEN e DISCORD_CLIENT_ID)
   2. sudo -u $BOT_USER bash -c "cd $BOT_DIR && npm run deploy-commands"
   3. sudo systemctl restart nianplay-bot
   4. sudo journalctl -u nianplay-bot -f      (ver o log)
==============================================================================
MSG
else
  sudo -u "$BOT_USER" bash -c "cd '$BOT_DIR' && npm run deploy-commands" || true
  systemctl restart nianplay-bot
  echo "==> Bot reiniciado. Log: sudo journalctl -u nianplay-bot -f"
fi

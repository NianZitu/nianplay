#!/usr/bin/env bash
# NianPlay Bot — atualiza para a versão mais recente do GitHub e reinicia.
#   sudo bash /opt/nianplay/bot/deploy/update.sh
set -euo pipefail
APP_DIR="/opt/nianplay"; BOT_DIR="$APP_DIR/bot"; BOT_USER="nianplay"
if [ "$(id -u)" -ne 0 ]; then echo "Execute como root (sudo)."; exit 1; fi

git -C "$APP_DIR" fetch --depth 1 origin main
git -C "$APP_DIR" reset --hard origin/main
chown -R "$BOT_USER:$BOT_USER" "$APP_DIR"
sudo -u "$BOT_USER" bash -c "cd '$BOT_DIR' && { npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund; } && npm run deploy-commands"
install -m 644 "$BOT_DIR/deploy/nianplay-bot.service" /etc/systemd/system/nianplay-bot.service
systemctl daemon-reload
systemctl restart nianplay-bot
/usr/local/bin/yt-dlp -U || true
echo "Atualizado. Log: sudo journalctl -u nianplay-bot -f"

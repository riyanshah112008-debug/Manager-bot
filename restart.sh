#!/data/data/com.termux/files/usr/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "🔄 Restarting Starry Bot Cluster in PM2..."
pm2 flush
pm2 restart starry-bot
sleep 3
./status.sh

#!/data/data/com.termux/files/usr/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

if command -v pm2 >/dev/null 2>&1 && pm2 list | grep "starry-bot" | grep -q "online"; then
    echo "🟢 Starry Bot is RUNNING under PM2 (24/7 Mode)"
    pm2 status starry-bot
    echo "📜 Recent logs:"
    echo "-----------------------------------"
    pm2 logs starry-bot --lines 15 --nostream
    echo "-----------------------------------"
elif pgrep -f "node src/index.js" > /dev/null; then
    PID=$(pgrep -f "node src/index.js" | head -n 1)
    echo "🟢 Starry Bot is RUNNING (PID: $PID)"
    echo "📜 Recent logs:"
    echo "-----------------------------------"
    if [ -f bot.log ] && [ -s bot.log ]; then
        tail -n 15 bot.log
    else
        echo "Bot is currently running via active node process (PID $PID)."
    fi
    echo "-----------------------------------"
else
    echo "🔴 Starry Bot is STOPPED"
fi

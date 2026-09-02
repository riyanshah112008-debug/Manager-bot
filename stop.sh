#!/data/data/com.termux/files/usr/bin/bash
echo "🛑 Stopping Starry Bot..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 stop starry-bot >/dev/null 2>&1
    pm2 delete starry-bot >/dev/null 2>&1
fi
pkill -9 -f "supervisor.js" >/dev/null 2>&1 || true
pkill -9 -f "node src/index.js" >/dev/null 2>&1 || true
if command -v termux-wake-unlock >/dev/null 2>&1; then
    termux-wake-unlock
fi
echo "✅ Starry Bot stopped."

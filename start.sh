#!/data/data/com.termux/files/usr/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# 1. Acquire Android Termux Wake Lock
if command -v termux-wake-lock >/dev/null 2>&1; then
    termux-wake-lock
    echo "🔋 Termux Wake Lock active (prevents Android CPU from sleeping)."
fi

# 2. Start using PM2 if available
if command -v pm2 >/dev/null 2>&1; then
    echo "🚀 Starting Starry Bot 24/7 with PM2 Process Supervisor..."
    pm2 start ecosystem.config.js
    pm2 save
    echo "✅ Starry Bot is running 24/7 under PM2 supervision."
    echo "📜 Use: pm2 logs starry-bot"
    exit 0
fi

# 3. Fallback to supervisor.js
if pgrep -f "supervisor.js" > /dev/null || pgrep -f "node src/index.js" > /dev/null; then
    echo "⚠️ Starry Bot is already running!"
    exit 0
fi

echo "🚀 Starting Starry Bot in background with supervisor..."
nohup node supervisor.js >> bot.log 2>&1 &
PID=$!
echo "✅ Bot supervisor started with PID: $PID"
echo "📜 View logs with: tail -f bot.log"

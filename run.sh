#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "==================================================================="
echo "    STARRY MULTI-BOT CLUSTER - 1-CLICK AUTO-DEPLOY LAUNCHER"
echo "==================================================================="
echo ""

# 1. Check Node.js Installation
if ! command -v node >/dev/null 2>&1; then
    echo "[!] Node.js is NOT installed on this machine."
    echo "Please install Node.js (>=20.x) from https://nodejs.org/"
    exit 1
fi

# 2. Check & Initialize .env Configuration
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo "[*] Creating .env from template..."
    cp .env.example .env
fi

# 3. Auto-Install Dependencies
if [ ! -d "node_modules" ]; then
    echo "[*] Installing dependencies automatically..."
    npm install || npm install --legacy-peer-deps
fi

# 4. Auto-Deploy Slash Commands
echo "[*] Auto-deploying Discord slash commands..."
node deploy-commands.js

# 5. Start Bot with PM2 or Supervisor
if command -v pm2 >/dev/null 2>&1; then
    echo "[OK] Starting under PM2 supervisor..."
    pm2 start ecosystem.config.js
    pm2 save
    echo "✅ Starry Bot is running 24/7."
    echo "📜 View logs with: pm2 logs starry-bot"
    exit 0
fi

echo "[OK] Starting Starry Bot directly with auto-restart..."
while true; do
    node src/index.js
    echo "[!] Process stopped. Auto-restarting in 3s..."
    sleep 3
done

# 🌟 Starry Manager Bot (Multi-Bot & Voice AI Suite)

A high-performance Discord Manager & Multi-Bot clustering framework with Voice Audio DSP streaming, Advanced Moderation, Economy & Leveling, and Modern Web Dashboard.

---

## 🚀 How to Host on PC (Windows, macOS, Linux)

Hosting on PC is **100% automated**. You do not need to manually configure packages or build tools.

### 💻 Option A: Windows PC (1-Click Launch)
1. **Download or Clone this Repository** to your PC.
2. Ensure you have **Node.js (LTS version)** installed from [https://nodejs.org/](https://nodejs.org/).
3. Double-click **`run.bat`** (or `start.bat`).
   - The launcher will **automatically install all required dependencies**.
   - It will **automatically deploy all Discord slash commands**.
   - It will **start the bot 24/7** with automatic crash-recovery and restart.

---

### 🍏 Option B: Mac / Linux / Termux (1-Command Launch)
Open your terminal in this repository folder and run:
```bash
chmod +x run.sh && ./run.sh
```
*Or using PM2 on servers:*
```bash
./start.sh
```

---

## ⚙️ Configuration (`.env`)
Fill in your environment variables in `.env` (or copy from `.env.example`):
```env
BOT_TOKEN=your_primary_bot_token
CLIENT_ID=your_bot_client_id
MONGODB_URI=your_mongodb_connection_string
PORT=10000
```

---

## 🛠️ Management & Monitoring
- **Check Status:** `./status.sh` or `pm2 status`
- **View Live Logs:** `pm2 logs starry-bot`
- **Stop Bot:** `./stop.sh` or `pm2 stop starry-bot`
- **Restart Bot:** `./restart.sh` or `pm2 restart starry-bot`
- **Web Dashboard:** Access via `http://localhost:10000` (or the public HTTPS tunnel).

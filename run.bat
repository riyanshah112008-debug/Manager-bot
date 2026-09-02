@echo off
title Starry Discord Bot - 1-Click Auto-Deploy Launcher
color 0B

echo ===================================================================
echo     STARRY MULTI-BOT CLUSTER - 1-CLICK PC AUTO-DEPLOY LAUNCHER
echo ===================================================================
echo.

:: 1. Check Node.js Installation
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [!] Node.js is NOT installed on this PC.
    echo Opening Node.js download page...
    start https://nodejs.org/en/download
    echo Please install Node.js (LTS version) and double click this file again.
    pause
    exit /b 1
)

:: 2. Check & Initialize .env Configuration
if not exist ".env" (
    if exist ".env.example" (
        echo [*] .env file not found. Creating .env from .env.example...
        copy ".env.example" ".env" >nul
        echo [!] Created .env file! Please make sure your BOT_TOKEN and MONGODB_URI are set in .env.
    )
)

:: 3. Auto-Install Dependencies
if not exist "node_modules" (
    echo [*] Installing dependencies automatically (this happens only once)...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [!] npm install encountered an error. Attempting install with legacy peer deps...
        call npm install --legacy-peer-deps
    )
)

:: 4. Auto-Deploy Slash Commands
echo [*] Auto-deploying Discord application slash commands...
call node deploy-commands.js

:: 5. Start Bot with 24/7 Auto-Restart Watcher
echo.
echo ===================================================================
echo   [OK] Starry Bot is starting up!
echo   Dashboard UI: http://localhost:10000
echo   To stop the bot, close this terminal window.
echo ===================================================================
echo.

:run_loop
node src/index.js
echo.
echo [!] Bot process ended. Auto-restarting in 3 seconds... (Press Ctrl+C to stop)
timeout /t 3 /nobreak >nul
goto run_loop

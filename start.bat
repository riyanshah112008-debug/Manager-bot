@echo off
title Starry.gg Multi-Bot Engine (PC Launcher)
echo ===================================================
echo   Starry.gg Multi-Bot Cluster & Infrastructure
echo   Compatible with Windows, Linux, macOS, and Android
echo ===================================================
echo.
echo [1/3] Checking Node.js Environment...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [2/3] Checking Dependencies...
if not exist node_modules (
    echo Installing required packages...
    npm install
)

echo [3/3] Launching Starry.gg Master Cluster...
echo Web Dashboard available at http://localhost:10000
node src/index.js
pause

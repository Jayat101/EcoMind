@echo off
title EcoMind - Web App
cd /d "%~dp0"

echo ============================================
echo   EcoMind - Starting Frontend + Backend
echo ============================================
echo.

REM Free up ports in case a previous run left processes behind
echo Clearing leftover processes on ports 5000 and 5173...
for %%P in (5000 5173) do (
    for /f "tokens=5" %%A in ('netstat -aon ^| findstr :%%P ^| findstr LISTENING ^| findstr "TCP"') do (
        taskkill /F /PID %%A >nul 2>&1
    )
)
timeout /t 2 /nobreak >nul

REM Install dependencies if node_modules is missing
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo Starting both servers (Vite client + Express API)...
echo   Client: http://localhost:5173
echo   API:    http://localhost:5000
echo Press Ctrl+C in this window to stop.
echo.

call npm run dev

pause

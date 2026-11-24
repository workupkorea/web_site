@echo off
title workup-dev-server
cd /d C:\WORK\2026_workup_website
start "" /min cmd /c "timeout /t 8 >nul & start http://localhost:3000"
npm run dev -- --port 3000
pause

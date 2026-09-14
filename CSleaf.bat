@echo off
chcp 65001 >nul
title CSleaf
cd /d "%~dp0"
echo.
echo   🌿  Starting CSleaf ...  (close this window to stop the server)
echo.
npm start
pause

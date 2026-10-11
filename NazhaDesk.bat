@echo off
title NazhaDesk - Remote Desktop Controller
cd /d "%~dp0"

echo ========================================================
echo       NazhaDesk - Personal AnyDesk Clone
echo       Full Control ^| High Quality ^| Ultra Fast
echo ========================================================
echo.
echo Starting NazhaDesk Engine...
echo Local Server: http://localhost:9090
echo.

start "" "http://localhost:9090"
node server.js
pause

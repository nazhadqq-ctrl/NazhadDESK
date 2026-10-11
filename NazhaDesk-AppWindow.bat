@echo off
title NazhaDesk Desktop App
cd /d "%~dp0"

echo Launching NazhaDesk Desktop App...
start "" msedge.exe --app="http://localhost:9090" --window-size=1300,850
node server.js

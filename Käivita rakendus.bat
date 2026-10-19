@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js ei ole arvutisse paigaldatud.
  echo Paigalda Node.js aadressilt https://nodejs.org/
  pause
  exit /b 1
)
start "" "http://localhost:8080/index.html"
node server.js

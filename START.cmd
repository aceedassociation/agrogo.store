@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Opening the offline catalogue instead.
  start "" "%~dp0index.html"
  exit /b
)
echo Agrogo Store - http://127.0.0.1:4174
echo Keep this window open while using the preview. Close it to stop.
start "" "http://127.0.0.1:4174"
node server.cjs
pause

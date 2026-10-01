@echo off
title OurTable
rem Double-click to start OurTable on this computer. Close this window to stop it.
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download it from https://nodejs.org and run this again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo First start: installing, this takes a minute...
  call npm install
  if errorlevel 1 (
    echo Install failed. See the messages above.
    pause
    exit /b 1
  )
)

echo.
echo  OurTable is starting. Your browser opens by itself when it is ready.
echo  Keep this window open while you play. Close it to stop.
echo.

rem --open lets Vite open the browser once the server is ready (and on the right port if 5173 is busy)
call npm run dev -- --open

echo.
echo OurTable stopped.
pause

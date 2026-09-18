@echo off
REM One-click demo for the competition laptop.
REM Starts the server (web app + AI APIs), the IoT simulator, and opens the app + command centre.
cd /d "%~dp0"
if not exist web\dist\index.html (
  echo Building the web app once...
  pushd web && call npm run build && popd
)
if not exist server\certs\cert.pem .venv\Scripts\python server\make_cert.py
start "Chalukya AI server" cmd /k .venv\Scripts\python -m server
timeout /t 4 >nul
start "IoT simulator" cmd /k .venv\Scripts\python iot\simulator.py
timeout /t 2 >nul
start "" http://localhost:8300/command
start "" http://localhost:8300/
echo.
echo  Phones: connect to the same Wi-Fi/hotspot and open the https address shown in the server window.
echo  Warm-up tip: open Scan once on each phone so the AI model is cached for offline use.

@echo off
cd /d "%~dp0"
echo Abrindo Corporate Speech Student Book em http://localhost:8080
start "" "http://localhost:8080"
python -m http.server 8080

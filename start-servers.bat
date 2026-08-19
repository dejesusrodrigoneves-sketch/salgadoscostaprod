@echo off
cd /d "%~dp0backend"
start "BackendServer" cmd /c "node server.js"
cd /d "%~dp0"
start "ViteServer" cmd /c "npx vite --port 5173"
echo Both servers started in separate windows.

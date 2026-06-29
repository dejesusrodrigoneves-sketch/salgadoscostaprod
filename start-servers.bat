@echo off
cd /d "C:\Users\djesus\Downloads\projects-vscode\Fabrica de salgados costa - Pronta - Copy\backend"
start "BackendServer" cmd /c "node server.js"
cd /d "C:\Users\djesus\Downloads\projects-vscode\Fabrica de salgados costa - Pronta - Copy"
start "ViteServer" cmd /c "npx vite --port 5173"
echo Both servers started in separate windows.

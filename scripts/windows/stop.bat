@echo off
setlocal enabledelayedexpansion

:: ============================================
:: AI Server Admin - Stop Script
:: ============================================

title AI Server Admin - Parando Servicos

echo.
echo  ====================================================
echo   🖥️  AI SERVER ADMIN - PARAR SERVICOS
echo  ====================================================
echo.

cd /d "%~dp0.."

:: Kill Node.js processes for this project
echo [1/2] Parando servidores Node.js...

:: Find and kill processes on ports 3000 and 3001
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo   Parando processo na porta 3000 (PID: %%a)
    taskkill /F /PID %%a >nul 2>nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    echo   Parando processo na porta 3001 (PID: %%a)
    taskkill /F /PID %%a >nul 2>nul
)

echo   ✅ Servidores Node.js parados

:: Stop Docker containers
echo.
echo [2/2] Parando containers Docker...
cd docker
docker-compose stop
if %ERRORLEVEL% EQU 0 (
    echo   ✅ Containers Docker parados
) else (
    echo   ⚠️  Nenhum container para parar ou erro ao parar
)
cd ..

echo.
echo  ====================================================
echo   ✅ TODOS OS SERVICOS FORAM PARADOS
echo  ====================================================
echo.
echo  Para remover completamente os containers, execute:
echo    cd docker ^&^& docker-compose down
echo.

pause

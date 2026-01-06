@echo off
setlocal enabledelayedexpansion

:: ============================================
:: AI Server Admin - Restart Script
:: ============================================

title AI Server Admin - Reiniciando Servicos

echo.
echo  ====================================================
echo   🖥️  AI SERVER ADMIN - REINICIAR SERVICOS
echo  ====================================================
echo.

cd /d "%~dp0.."

:: Stop services
echo [1/3] Parando servicos atuais...
echo.

:: Kill Node.js processes
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo   Parando processo na porta 3000 (PID: %%a)
    taskkill /F /PID %%a >nul 2>nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    echo   Parando processo na porta 3001 (PID: %%a)
    taskkill /F /PID %%a >nul 2>nul
)

echo   ✅ Servidores Node.js parados

:: Restart Docker containers
echo.
echo [2/3] Reiniciando containers Docker...
cd docker
docker-compose restart
if %ERRORLEVEL% NEQ 0 (
    echo   ⚠️  Containers nao estavam rodando. Iniciando...
    docker-compose up -d
)
cd ..
echo   ✅ Containers Docker reiniciados

:: Wait for services
echo.
echo [3/3] Aguardando servicos ficarem prontos...
timeout /t 3 /nobreak >nul

:: Check PostgreSQL
docker exec ai-server-postgres pg_isready -U postgres >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   ✅ PostgreSQL pronto (porta 5433)
) else (
    echo   ⚠️  PostgreSQL ainda iniciando...
)

:: Check Redis
docker exec ai-server-redis redis-cli ping >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   ✅ Redis pronto (porta 6380)
) else (
    echo   ⚠️  Redis ainda iniciando...
)

:: Start development servers
echo.
echo Iniciando servidores de desenvolvimento...
echo.
echo   ⏳ Iniciando Frontend (Next.js) e Backend (NestJS)...
echo   Pressione Ctrl+C para parar os servidores.
echo.
echo  ====================================================
echo   📋 URLs disponiveis apos inicializacao:
echo  ----------------------------------------------------
echo   Frontend:   http://localhost:3000
echo   Backend:    http://localhost:3001
echo   API Docs:   http://localhost:3001/api/docs
echo  ====================================================
echo.

call pnpm dev

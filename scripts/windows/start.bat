@echo off
setlocal enabledelayedexpansion

:: ============================================
:: AI Server Admin - Start Script
:: ============================================

title AI Server Admin - Iniciando Servicos

echo.
echo  ====================================================
echo   🖥️  AI SERVER ADMIN - INICIAR SERVICOS
echo  ====================================================
echo.

cd /d "%~dp0.."

:: Check if .env exists
if not exist ".env" (
    echo   ❌ Arquivo .env nao encontrado!
    echo   Execute install.bat primeiro.
    pause
    exit /b 1
)

:: Start Docker containers
echo [1/2] Iniciando containers Docker...
cd docker
docker-compose up -d
if %ERRORLEVEL% NEQ 0 (
    echo   ❌ Falha ao iniciar containers Docker
    echo   Verifique se o Docker Desktop esta rodando.
    cd ..
    pause
    exit /b 1
)
cd ..
echo   ✅ Containers Docker iniciados

:: Wait for services to be ready
echo.
echo Aguardando servicos ficarem prontos...
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

:: Start the development servers
echo.
echo [2/2] Iniciando servidores de desenvolvimento...
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

@echo off
setlocal enabledelayedexpansion

:: ============================================
:: AI Server Admin - Install Script
:: ============================================

title AI Server Admin - Instalacao

echo.
echo  ====================================================
echo   🖥️  AI SERVER ADMIN - INSTALACAO
echo  ====================================================
echo.

cd /d "%~dp0.."

:: Check Node.js
echo [1/6] Verificando Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo   ❌ Node.js nao encontrado!
    echo   Por favor, instale o Node.js 18+ de: https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo   ✅ Node.js encontrado: %NODE_VERSION%

:: Check pnpm
echo.
echo [2/6] Verificando pnpm...
where pnpm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo   ⚠️  pnpm nao encontrado. Instalando...
    npm install -g pnpm
    if %ERRORLEVEL% NEQ 0 (
        echo   ❌ Falha ao instalar pnpm
        pause
        exit /b 1
    )
)
for /f "tokens=*" %%i in ('pnpm -v') do set PNPM_VERSION=%%i
echo   ✅ pnpm encontrado: v%PNPM_VERSION%

:: Check Docker
echo.
echo [3/6] Verificando Docker...
where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo   ❌ Docker nao encontrado!
    echo   Por favor, instale o Docker Desktop de: https://docker.com
    pause
    exit /b 1
)
docker info >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo   ⚠️  Docker nao esta rodando! Por favor, inicie o Docker Desktop.
    pause
    exit /b 1
)
echo   ✅ Docker encontrado e rodando

:: Install dependencies
echo.
echo [4/6] Instalando dependencias...
call pnpm install
if %ERRORLEVEL% NEQ 0 (
    echo   ❌ Falha ao instalar dependencias
    pause
    exit /b 1
)
echo   ✅ Dependencias instaladas

:: Configure .env
echo.
echo [5/6] Configurando ambiente...
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo   ✅ Arquivo .env criado a partir de .env.example
        echo   ⚠️  IMPORTANTE: Edite o arquivo .env com suas configuracoes!
    ) else (
        echo   ❌ Arquivo .env.example nao encontrado!
        pause
        exit /b 1
    )
) else (
    echo   ✅ Arquivo .env ja existe
)

:: Start Docker containers
echo.
echo [6/6] Iniciando containers Docker...
cd docker
docker-compose up -d
if %ERRORLEVEL% NEQ 0 (
    echo   ❌ Falha ao iniciar containers Docker
    cd ..
    pause
    exit /b 1
)
cd ..
echo   ✅ Containers Docker iniciados

:: Configure Prisma
echo.
echo Configurando banco de dados...
call pnpm db:generate
if %ERRORLEVEL% NEQ 0 (
    echo   ⚠️  Aviso: Falha ao gerar cliente Prisma
)
call pnpm db:push
if %ERRORLEVEL% NEQ 0 (
    echo   ⚠️  Aviso: Falha ao sincronizar schema do banco
)
echo   ✅ Banco de dados configurado

echo.
echo  ====================================================
echo   ✅ INSTALACAO CONCLUIDA COM SUCESSO!
echo  ====================================================
echo.
echo  Proximos passos:
echo    1. Edite o arquivo .env com sua DATABASE_URL remota
echo    2. Execute start.bat para iniciar o projeto
echo.
echo  URLs:
echo    - Frontend: http://localhost:3000
echo    - Backend API: http://localhost:3001
echo    - API Docs: http://localhost:3001/api/docs
echo.

pause

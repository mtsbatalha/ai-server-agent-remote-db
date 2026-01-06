@echo off
setlocal enabledelayedexpansion

:: ============================================
:: AI Server Admin - Uninstall Script
:: ============================================

title AI Server Admin - Desinstalacao Completa

echo.
echo  ====================================================
echo   🗑️  AI SERVER ADMIN - DESINSTALACAO COMPLETA
echo  ====================================================
echo.
echo   ⚠️  ATENCAO: Este script ira REMOVER COMPLETAMENTE:
echo.
echo       - Containers Docker (ai-server-*)
echo       - Volumes Docker (banco de dados e cache)
echo       - Imagens Docker do projeto
echo       - Dependencias (node_modules)
echo       - Arquivos de configuracao (.env)
echo       - Arquivos gerados pelo Prisma
echo.
echo  ====================================================
echo.

set /p CONFIRM1="   Tem certeza que deseja continuar? (digite 'sim' para confirmar): "
if /I not "!CONFIRM1!"=="sim" (
    echo.
    echo   ❌ Operacao cancelada.
    pause
    exit /b 0
)

echo.
set /p CONFIRM2="   ⚠️  SEGUNDA CONFIRMACAO - Voce ira PERDER TODOS OS DADOS! (digite 'DESINSTALAR' para confirmar): "
if not "!CONFIRM2!"=="DESINSTALAR" (
    echo.
    echo   ❌ Operacao cancelada.
    pause
    exit /b 0
)

cd /d "%~dp0..\.."

echo.
echo  ====================================================
echo   Iniciando desinstalacao...
echo  ====================================================
echo.

:: ============================================
:: 1. PARAR SERVICOS NODE.JS
:: ============================================
echo [1/6] Parando servidores Node.js...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING" 2^>nul') do (
    echo   Parando processo na porta 3000 (PID: %%a)
    taskkill /F /PID %%a >nul 2>nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING" 2^>nul') do (
    echo   Parando processo na porta 3001 (PID: %%a)
    taskkill /F /PID %%a >nul 2>nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3003" ^| findstr "LISTENING" 2^>nul') do (
    echo   Parando processo na porta 3003 (PID: %%a)
    taskkill /F /PID %%a >nul 2>nul
)

echo   ✅ Servidores Node.js parados

:: ============================================
:: 2. PARAR E REMOVER CONTAINERS DOCKER
:: ============================================
echo.
echo [2/6] Parando e removendo containers Docker...

where docker >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    docker info >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        :: Stop containers
        docker stop ai-server-postgres ai-server-redis ai-server-api ai-server-web >nul 2>nul
        docker stop ai-server-postgres-dev ai-server-redis-dev >nul 2>nul
        echo   ✅ Containers parados
        
        :: Remove containers
        docker rm ai-server-postgres ai-server-redis ai-server-api ai-server-web >nul 2>nul
        docker rm ai-server-postgres-dev ai-server-redis-dev >nul 2>nul
        echo   ✅ Containers removidos
    ) else (
        echo   ⚠️  Docker Desktop nao esta rodando - pulando containers
    )
) else (
    echo   ⚠️  Docker nao encontrado - pulando containers
)

:: ============================================
:: 3. REMOVER VOLUMES DOCKER
:: ============================================
echo.
echo [3/6] Removendo volumes Docker (dados do banco)...

where docker >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    docker info >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        docker volume rm ai-server-postgres-data >nul 2>nul
        docker volume rm docker_postgres_data >nul 2>nul
        docker volume rm docker_redis_data >nul 2>nul
        docker volume rm docker_postgres_data_dev >nul 2>nul
        docker volume rm docker_redis_data_dev >nul 2>nul
        
        :: Also try with project prefix variations
        for /f "tokens=*" %%v in ('docker volume ls -q --filter "name=ai-server" 2^>nul') do (
            docker volume rm %%v >nul 2>nul
        )
        
        echo   ✅ Volumes removidos
    )
)

:: ============================================
:: 4. REMOVER IMAGENS DOCKER
:: ============================================
echo.
echo [4/6] Removendo imagens Docker do projeto...

where docker >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    docker info >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        for /f "tokens=*" %%i in ('docker images -q --filter "reference=*ai-server*" 2^>nul') do (
            docker rmi %%i >nul 2>nul
        )
        
        for /f "tokens=*" %%i in ('docker images -q --filter "reference=docker-api" 2^>nul') do (
            docker rmi %%i >nul 2>nul
        )
        
        for /f "tokens=*" %%i in ('docker images -q --filter "reference=docker-web" 2^>nul') do (
            docker rmi %%i >nul 2>nul
        )
        
        echo   ✅ Imagens removidas
    )
)

:: ============================================
:: 5. REMOVER NODE_MODULES
:: ============================================
echo.
echo [5/6] Removendo dependencias (node_modules)...

if exist "node_modules" (
    rmdir /S /Q "node_modules" >nul 2>nul
    echo   ✅ node_modules removido
) else (
    echo   - node_modules nao encontrado
)

if exist "apps\api\node_modules" (
    rmdir /S /Q "apps\api\node_modules" >nul 2>nul
    echo   ✅ apps\api\node_modules removido
)

if exist "apps\web\node_modules" (
    rmdir /S /Q "apps\web\node_modules" >nul 2>nul
    echo   ✅ apps\web\node_modules removido
)

:: ============================================
:: 6. REMOVER ARQUIVOS GERADOS
:: ============================================
echo.
echo [6/6] Removendo arquivos gerados...

if exist ".env" (
    del /Q ".env" >nul 2>nul
    echo   ✅ .env removido
) else (
    echo   - .env nao encontrado
)

if exist "apps\api\dist" (
    rmdir /S /Q "apps\api\dist" >nul 2>nul
    echo   ✅ apps\api\dist removido
)

if exist "apps\web\.next" (
    rmdir /S /Q "apps\web\.next" >nul 2>nul
    echo   ✅ apps\web\.next removido
)

if exist "apps\api\prisma\generated" (
    rmdir /S /Q "apps\api\prisma\generated" >nul 2>nul
    echo   ✅ Prisma Client removido
)

:: Remove pnpm lock file
if exist "pnpm-lock.yaml" (
    del /Q "pnpm-lock.yaml" >nul 2>nul
    echo   ✅ pnpm-lock.yaml removido
)

:: ============================================
:: PERGUNTAR SOBRE REMOCAO DO PROJETO
:: ============================================
echo.
echo  ====================================================
echo   ✅ Desinstalacao dos componentes concluida!
echo  ====================================================
echo.
set /p REMOVE_PROJECT="   Deseja tambem REMOVER A PASTA DO PROJETO? (digite 'sim' para confirmar): "

if /I "!REMOVE_PROJECT!"=="sim" (
    echo.
    echo   ⚠️  A pasta do projeto sera movida para a Lixeira...
    echo   Por favor, delete manualmente se necessario.
    echo.
    echo   Pasta do projeto: %CD%
    echo.
    
    :: Open explorer in parent directory
    start explorer "%CD%\.."
    
    echo   📂 Explorador de arquivos aberto. Delete a pasta manualmente.
) else (
    echo.
    echo   📁 Pasta do projeto mantida em: %CD%
)

echo.
echo  ====================================================
echo   🏁 DESINSTALACAO FINALIZADA
echo  ====================================================
echo.
echo   O que foi removido:
echo     ✅ Containers Docker
echo     ✅ Volumes Docker (dados do banco)
echo     ✅ Imagens Docker
echo     ✅ Dependencias (node_modules)
echo     ✅ Arquivos de configuracao (.env)
echo     ✅ Arquivos compilados
echo.
echo   Para reinstalar, execute: scripts\windows\install.bat
echo.
echo  ====================================================
echo.

pause

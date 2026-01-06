@echo off
setlocal enabledelayedexpansion

:: ============================================
:: AI Server Admin - Status Script
:: ============================================

title AI Server Admin - Status dos Servicos

echo.
echo  ========================================================================
echo   🖥️  AI SERVER ADMIN - STATUS DOS SERVICOS
echo  ========================================================================
echo   Data/Hora: %date% %time%
echo  ========================================================================
echo.

cd /d "%~dp0..\.."

:: ============================================
:: REMOTE DATABASE STATUS
:: ============================================
echo  🌐 BANCO DE DADOS REMOTO
echo  ------------------------------------------------------------------------
echo.

set DB_STATUS=Desconhecido
set DB_LATENCY=-
set DB_HOST=-

:: Try to check database status via API health endpoint using PowerShell
for /f "usebackq delims=" %%a in (`powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://localhost:3001/api/health/db' -TimeoutSec 3 -ErrorAction Stop; if ($r.status -eq 'connected') { Write-Output ('CONNECTED|' + $r.latency + '|' + $r.host) } else { Write-Output ('DISCONNECTED|' + $r.error + '|' + $r.host) } } catch { Write-Output 'UNAVAILABLE||API nao disponivel' }" 2^>nul`) do (
    for /f "tokens=1,2,3 delims=|" %%x in ("%%a") do (
        if "%%x"=="CONNECTED" (
            set "DB_STATUS=✅ Conectado"
            set "DB_LATENCY=%%y"
            set "DB_HOST=%%z"
        ) else if "%%x"=="DISCONNECTED" (
            set "DB_STATUS=❌ Desconectado"
            set "DB_LATENCY=-"
            set "DB_HOST=%%z"
        ) else (
            set "DB_STATUS=⚠️ API nao disponivel"
            set "DB_LATENCY=-"
            set "DB_HOST=Inicie a API para verificar"
        )
    )
)

echo   Status:     !DB_STATUS!
echo   Host:       !DB_HOST!
echo   Latencia:   !DB_LATENCY!
echo.

:: ============================================
:: DOCKER CONTAINERS STATUS
:: ============================================
echo  📦 CONTAINERS DOCKER
echo  ------------------------------------------------------------------------

:: Check if Docker is running
where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo   ❌ Docker nao encontrado no sistema
    goto :node_section
)

docker info >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo   ❌ Docker Desktop nao esta rodando
    goto :node_section
)

echo.
echo   Container             Status          Porta         Health
echo   --------------------  --------------  ------------  --------

:: PostgreSQL Status
set PG_STATUS=❌ Parado
set PG_PORT=-
set PG_HEALTH=-

for /f "tokens=*" %%a in ('docker ps --filter "name=ai-server-postgres" --format "{{.Status}}" 2^>nul') do (
    set "PG_FULL_STATUS=%%a"
    set PG_STATUS=✅ Rodando
    set PG_PORT=5433
)

if "!PG_STATUS!"=="✅ Rodando" (
    docker exec ai-server-postgres pg_isready -U postgres >nul 2>nul
    if !ERRORLEVEL! EQU 0 (
        set PG_HEALTH=Healthy
    ) else (
        set PG_HEALTH=Starting
    )
)

echo   PostgreSQL            !PG_STATUS!      !PG_PORT!          !PG_HEALTH!

:: Redis Status
set REDIS_STATUS=❌ Parado
set REDIS_PORT=-
set REDIS_HEALTH=-

for /f "tokens=*" %%a in ('docker ps --filter "name=ai-server-redis" --format "{{.Status}}" 2^>nul') do (
    set "REDIS_FULL_STATUS=%%a"
    set REDIS_STATUS=✅ Rodando
    set REDIS_PORT=6380
)

if "!REDIS_STATUS!"=="✅ Rodando" (
    docker exec ai-server-redis redis-cli ping >nul 2>nul
    if !ERRORLEVEL! EQU 0 (
        set REDIS_HEALTH=Healthy
    ) else (
        set REDIS_HEALTH=Starting
    )
)

echo   Redis                 !REDIS_STATUS!      !REDIS_PORT!          !REDIS_HEALTH!

:: ============================================
:: NODE.JS APPLICATIONS STATUS
:: ============================================
:node_section
echo.
echo  ------------------------------------------------------------------------
echo  🚀 APLICACOES NODE.JS
echo  ------------------------------------------------------------------------
echo.
echo   Aplicacao             Status          Porta         PID
echo   --------------------  --------------  ------------  --------

:: Check Frontend (port 3000)
set WEB_STATUS=❌ Parado
set WEB_PORT=-
set WEB_PID=-

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING" 2^>nul') do (
    set WEB_STATUS=✅ Rodando
    set WEB_PORT=3000
    set WEB_PID=%%a
)

echo   Frontend (Next.js^)    !WEB_STATUS!      !WEB_PORT!          !WEB_PID!

:: Check Backend (port 3001)
set API_STATUS=❌ Parado
set API_PORT=-
set API_PID=-

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING" 2^>nul') do (
    set API_STATUS=✅ Rodando
    set API_PORT=3001
    set API_PID=%%a
)

echo   Backend (NestJS^)      !API_STATUS!      !API_PORT!          !API_PID!

:: ============================================
:: URLS
:: ============================================
echo.
echo  ------------------------------------------------------------------------
echo  🌐 URLs DE ACESSO
echo  ------------------------------------------------------------------------
echo.
if "!WEB_STATUS!"=="✅ Rodando" (
    echo   Frontend:     http://localhost:3000
) else (
    echo   Frontend:     [NAO DISPONIVEL]
)

if "!API_STATUS!"=="✅ Rodando" (
    echo   Backend API:  http://localhost:3001
    echo   API Docs:     http://localhost:3001/api/docs
) else (
    echo   Backend API:  [NAO DISPONIVEL]
    echo   API Docs:     [NAO DISPONIVEL]
)

:: ============================================
:: ENVIRONMENT CONFIGURATION
:: ============================================
echo.
echo  ------------------------------------------------------------------------
echo  ⚙️  CONFIGURACAO DO AMBIENTE
echo  ------------------------------------------------------------------------
echo.

if exist ".env" (
    echo   Arquivo .env:   ✅ Configurado
    
    :: Check AI Provider configured
    set AI_CONFIGURED=Nenhum
    
    findstr /C:"OPENAI_API_KEY" ".env" | findstr /V /C:"sk-your" | findstr /V /C:"your-" >nul 2>nul
    if !ERRORLEVEL! EQU 0 set AI_CONFIGURED=OpenAI
    
    findstr /C:"GEMINI_API_KEY" ".env" | findstr /V /C:"your-" >nul 2>nul
    if !ERRORLEVEL! EQU 0 set AI_CONFIGURED=!AI_CONFIGURED!/Gemini
    
    findstr /C:"GROQ_API_KEY" ".env" | findstr /V /C:"your-" >nul 2>nul
    if !ERRORLEVEL! EQU 0 set AI_CONFIGURED=!AI_CONFIGURED!/Groq
    
    echo   AI Provider:    !AI_CONFIGURED!
) else (
    echo   Arquivo .env:   ❌ Nao encontrado
    echo   Execute install.bat para configurar
)

:: ============================================
:: RECENT LOGS (Docker)
:: ============================================
echo.
echo  ------------------------------------------------------------------------
echo  📜 LOGS RECENTES DOS CONTAINERS
echo  ------------------------------------------------------------------------

if "!PG_STATUS!"=="✅ Rodando" (
    echo.
    echo   [PostgreSQL - Ultimas 3 linhas]
    docker logs ai-server-postgres --tail 3 2>&1
)

if "!REDIS_STATUS!"=="✅ Rodando" (
    echo.
    echo   [Redis - Ultimas 3 linhas]
    docker logs ai-server-redis --tail 3 2>&1
)

:: ============================================
:: DISK USAGE
:: ============================================
echo.
echo  ------------------------------------------------------------------------
echo  💾 USO DE DISCO (Docker)
echo  ------------------------------------------------------------------------
echo.
docker system df 2>nul

:: ============================================
:: SUMMARY
:: ============================================
echo.
echo  ========================================================================
echo  📊 RESUMO
echo  ========================================================================


set TOTAL_SERVICES=4
set RUNNING_SERVICES=0

if "!PG_STATUS!"=="✅ Rodando" set /a RUNNING_SERVICES+=1
if "!REDIS_STATUS!"=="✅ Rodando" set /a RUNNING_SERVICES+=1
if "!WEB_STATUS!"=="✅ Rodando" set /a RUNNING_SERVICES+=1
if "!API_STATUS!"=="✅ Rodando" set /a RUNNING_SERVICES+=1

echo.
if !RUNNING_SERVICES! EQU !TOTAL_SERVICES! (
    echo   ✅ Todos os servicos estao rodando (!RUNNING_SERVICES!/!TOTAL_SERVICES!^)
) else if !RUNNING_SERVICES! EQU 0 (
    echo   ❌ Nenhum servico esta rodando (!RUNNING_SERVICES!/!TOTAL_SERVICES!^)
    echo   Execute start.bat para iniciar
) else (
    echo   ⚠️  Alguns servicos estao parados (!RUNNING_SERVICES!/!TOTAL_SERVICES!^)
)

echo.
echo  ========================================================================
echo.

pause

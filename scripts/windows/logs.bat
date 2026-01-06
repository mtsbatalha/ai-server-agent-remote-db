@echo off
setlocal enabledelayedexpansion

:: ============================================
:: AI Server Admin - Logs Script
:: ============================================

title AI Server Admin - Ver Logs

echo.
echo  ====================================================
echo   🖥️  AI SERVER ADMIN - LOGS
echo  ====================================================
echo.

cd /d "%~dp0.."

echo  Selecione qual log deseja visualizar:
echo.
echo   [1] PostgreSQL (Docker)
echo   [2] Redis (Docker)
echo   [3] Todos os containers
echo   [4] Seguir todos os logs em tempo real
echo   [0] Sair
echo.

set /p choice="Opcao: "

if "%choice%"=="1" goto pg_logs
if "%choice%"=="2" goto redis_logs
if "%choice%"=="3" goto all_logs
if "%choice%"=="4" goto follow_logs
if "%choice%"=="0" goto end

echo Opcao invalida!
pause
goto end

:pg_logs
echo.
echo  ====================================================
echo   📜 LOGS - PostgreSQL
echo  ====================================================
echo.
docker logs ai-server-postgres --tail 100
echo.
pause
goto end

:redis_logs
echo.
echo  ====================================================
echo   📜 LOGS - Redis
echo  ====================================================
echo.
docker logs ai-server-redis --tail 100
echo.
pause
goto end

:all_logs
echo.
echo  ====================================================
echo   📜 LOGS - Todos os Containers
echo  ====================================================
echo.
echo [PostgreSQL]
echo ============
docker logs ai-server-postgres --tail 30
echo.
echo [Redis]
echo =======
docker logs ai-server-redis --tail 30
echo.
pause
goto end

:follow_logs
echo.
echo  ====================================================
echo   📜 LOGS EM TEMPO REAL (Ctrl+C para sair)
echo  ====================================================
echo.
cd docker
docker-compose logs -f
cd ..
goto end

:end

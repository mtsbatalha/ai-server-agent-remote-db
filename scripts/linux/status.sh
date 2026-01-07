#!/bin/bash

# ============================================
# AI Server Admin - Status Script
# Com suporte a Smart Docker Scaling
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Import hybrid detection functions
source "$SCRIPT_DIR/docker-hybrid.sh"

cd "$PROJECT_DIR"

# Load environment variables
load_env "$PROJECT_DIR"

echo ""
echo "========================================================================"
echo " 🖥️  AI SERVER ADMIN - STATUS DOS SERVIÇOS"
echo "========================================================================"
echo " Data/Hora: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================================================"
echo ""

# ============================================
# SMART DOCKER SCALING - Detecção Híbrida
# ============================================
log_hybrid_status
log_required_containers

# ============================================
# REMOTE DATABASE STATUS
# ============================================
echo -e " ${BOLD}🌐 BANCO DE DADOS REMOTO${NC}"
echo "------------------------------------------------------------------------"
echo ""

# Try to check database status via API health endpoint
API_URL="http://localhost:3002/api/health/db"
DB_STATUS="Desconhecido"
DB_LATENCY="-"
DB_HOST="-"

# Check if curl is available and API is reachable
if command -v curl &> /dev/null; then
    RESPONSE=$(curl -s --connect-timeout 3 "$API_URL" 2>/dev/null)
    if [ -n "$RESPONSE" ]; then
        # Parse JSON response
        if echo "$RESPONSE" | grep -q '"status":"connected"'; then
            DB_STATUS="${GREEN}✅ Conectado${NC}"
            # Extract latency
            DB_LATENCY=$(echo "$RESPONSE" | grep -oP '"latency":"[^"]*"' | cut -d'"' -f4)
            # Extract host
            DB_HOST=$(echo "$RESPONSE" | grep -oP '"host":"[^"]*"' | cut -d'"' -f4)
        elif echo "$RESPONSE" | grep -q '"status":"disconnected"'; then
            DB_STATUS="${RED}❌ Desconectado${NC}"
            # Try to get error message
            DB_ERROR=$(echo "$RESPONSE" | grep -oP '"error":"[^"]*"' | cut -d'"' -f4)
            [ -n "$DB_ERROR" ] && DB_HOST="Erro: $DB_ERROR"
        fi
    else
        DB_STATUS="${YELLOW}⚠️ API não disponível${NC}"
        DB_HOST="Inicie a API para verificar"
    fi
else
    DB_STATUS="${YELLOW}⚠️ curl não instalado${NC}"
fi

printf "   %-14s " "Status:"
echo -e "$DB_STATUS"
printf "   %-14s %s\n" "Host:" "$DB_HOST"
printf "   %-14s %s\n" "Latência:" "$DB_LATENCY"

echo ""

# ============================================
# DOCKER CONTAINERS STATUS
# ============================================
echo -e " ${BOLD}📦 CONTAINERS DOCKER${NC}"
echo "------------------------------------------------------------------------"

# Check if Docker is running
if ! command -v docker &> /dev/null; then
    echo -e "   ${RED}❌ Docker não encontrado no sistema${NC}"
else
    if ! docker info &> /dev/null; then
        echo -e "   ${RED}❌ Docker não está rodando${NC}"
    else
        echo ""
        printf "   %-22s %-16s %-14s %-10s\n" "Container" "Status" "Porta" "Tipo"
        printf "   %-22s %-16s %-14s %-10s\n" "--------------------" "--------------" "------------" "--------"

        # Redis Status
        REDIS_STATUS="${RED}❌ Parado${NC}"
        REDIS_PORT="-"
        REDIS_TYPE="-"

        if needs_docker_redis; then
            REDIS_TYPE="Local"
            if docker ps --filter "name=ai-server-redis" --format "{{.Status}}" 2>/dev/null | grep -q .; then
                REDIS_STATUS="${GREEN}✅ Rodando${NC}"
                REDIS_PORT="6380"
            fi
        else
            REDIS_STATUS="${GREEN}✅ Conectado${NC}"
            REDIS_PORT="$(get_url_host "$REDIS_URL" | cut -d':' -f2)"
            [ "$REDIS_PORT" = "$(get_url_host "$REDIS_URL")" ] && REDIS_PORT="6379"
            REDIS_TYPE="Remoto"
        fi

        printf "   %-22s " "Redis"
        echo -e "$REDIS_STATUS      $REDIS_PORT          $REDIS_TYPE"
    fi
fi

# ============================================
# API & WEB APPLICATIONS STATUS
# ============================================
echo ""
echo "------------------------------------------------------------------------"
echo -e " ${BOLD}🚀 APLICAÇÕES (DOCKER)${NC}"
echo "------------------------------------------------------------------------"
echo ""
printf "   %-22s %-16s %-14s %-10s\n" "Aplicação" "Status" "Porta" "Health"
printf "   %-22s %-16s %-14s %-10s\n" "--------------------" "--------------" "------------" "--------"

# Check Frontend Container
WEB_STATUS="${RED}❌ Parado${NC}"
WEB_PORT="-"
WEB_HEALTH="-"

if docker ps --filter "name=ai-server-web" --format "{{.Status}}" 2>/dev/null | grep -q .; then
    WEB_STATUS="${GREEN}✅ Rodando${NC}"
    # Extract port mapping if possible, or assume env
    WEB_PORT="${WEB_PORT:-3000}" 
    if docker inspect --format='{{json .State.Health.Status}}' ai-server-web 2>/dev/null | grep -q "healthy"; then
        WEB_HEALTH="Healthy"
    else
        WEB_HEALTH="Running" 
    fi
fi

printf "   %-22s " "Frontend (Next.js)"
echo -e "$WEB_STATUS      $WEB_PORT          $WEB_HEALTH"

# Check Backend Container
API_STATUS="${RED}❌ Parado${NC}"
API_PORT="-"
API_HEALTH="-"

if docker ps --filter "name=ai-server-api" --format "{{.Status}}" 2>/dev/null | grep -q .; then
    API_STATUS="${GREEN}✅ Rodando${NC}"
    API_PORT="${API_PORT:-3001}"
    if docker inspect --format='{{json .State.Health.Status}}' ai-server-api 2>/dev/null | grep -q "healthy"; then
        API_HEALTH="Healthy"
    else
        API_HEALTH="Running"
    fi
fi

printf "   %-22s " "Backend (NestJS)"
echo -e "$API_STATUS      $API_PORT          $API_HEALTH"

# ============================================
# URLS
# ============================================
echo ""
echo "------------------------------------------------------------------------"
echo -e " ${BOLD}🌐 URLs DE ACESSO${NC}"
echo "------------------------------------------------------------------------"
echo ""

# Check if containers are running to show URLs
WEB_RUNNING=$(docker ps --filter "name=ai-server-web" --format "{{.Status}}" 2>/dev/null | grep -q "Up" && echo "yes")
API_RUNNING=$(docker ps --filter "name=ai-server-api" --format "{{.Status}}" 2>/dev/null | grep -q "Up" && echo "yes")

if [ -n "$WEB_RUNNING" ]; then
    echo "   Frontend:     http://localhost:3002"
else
    echo "   Frontend:     [NÃO DISPONÍVEL]"
fi

if [ -n "$API_RUNNING" ]; then
    echo "   Backend API:  http://localhost:3003/api"
    echo "   API Docs:     http://localhost:3003/api/docs"
else
    echo "   Backend API:  [NÃO DISPONÍVEL]"
    echo "   API Docs:     [NÃO DISPONÍVEL]"
fi

# ============================================
# ENVIRONMENT CONFIGURATION
# ============================================
echo ""
echo "------------------------------------------------------------------------"
echo -e " ${BOLD}⚙️  CONFIGURAÇÃO DO AMBIENTE${NC}"
echo "------------------------------------------------------------------------"
echo ""

if [ -f ".env" ]; then
    echo -e "   Arquivo .env:   ${GREEN}✅ Configurado${NC}"
    
    # Check AI Provider configured
    AI_CONFIGURED=""
    
    if grep -q "OPENAI_API_KEY" .env && ! grep -q "sk-your\|your-" .env; then
        AI_CONFIGURED="OpenAI"
    fi
    
    if grep -q "GEMINI_API_KEY" .env && ! grep "GEMINI_API_KEY" .env | grep -q "your-"; then
        [ -n "$AI_CONFIGURED" ] && AI_CONFIGURED="$AI_CONFIGURED/"
        AI_CONFIGURED="${AI_CONFIGURED}Gemini"
    fi
    
    if grep -q "GROQ_API_KEY" .env && ! grep "GROQ_API_KEY" .env | grep -q "your-"; then
        [ -n "$AI_CONFIGURED" ] && AI_CONFIGURED="$AI_CONFIGURED/"
        AI_CONFIGURED="${AI_CONFIGURED}Groq"
    fi
    
    [ -z "$AI_CONFIGURED" ] && AI_CONFIGURED="Nenhum configurado"
    
    echo "   AI Provider:    $AI_CONFIGURED"
else
    echo -e "   Arquivo .env:   ${RED}❌ Não encontrado${NC}"
    echo "   Execute install.sh para configurar"
fi

# ============================================
# RECENT LOGS (Docker)
# ============================================
echo ""
echo "------------------------------------------------------------------------"
echo -e " ${BOLD}📜 LOGS RECENTES DOS CONTAINERS${NC}"
echo "------------------------------------------------------------------------"

if needs_docker_redis && docker ps --filter "name=ai-server-redis" --format "{{.Status}}" 2>/dev/null | grep -q .; then
    echo ""
    echo "   [Redis - Últimas 3 linhas]"
    docker logs ai-server-redis-dev --tail 3 2>&1 | sed 's/^/   /'
fi

# ============================================
# DISK USAGE
# ============================================
echo ""
echo "------------------------------------------------------------------------"
echo -e " ${BOLD}💾 USO DE DISCO (Docker)${NC}"
echo "------------------------------------------------------------------------"
echo ""
docker system df 2>/dev/null | sed 's/^/   /'

# ============================================
# SUMMARY
# ============================================
echo ""
echo "========================================================================"
echo -e " ${BOLD}📊 RESUMO${NC}"
echo "========================================================================"

TOTAL_SERVICES=3
RUNNING_SERVICES=0

# Count running services (including remote ones)
if needs_docker_redis; then
    docker ps --filter "name=ai-server-redis" --format "{{.Status}}" 2>/dev/null | grep -q . && ((RUNNING_SERVICES++))
else
    # Remote Redis counts as running
    ((RUNNING_SERVICES++))
fi

docker ps --filter "name=ai-server-api" --format "{{.Status}}" 2>/dev/null | grep -q . && ((RUNNING_SERVICES++))
docker ps --filter "name=ai-server-web" --format "{{.Status}}" 2>/dev/null | grep -q . && ((RUNNING_SERVICES++))

echo ""
if [ $RUNNING_SERVICES -eq $TOTAL_SERVICES ]; then
    echo -e "   ${GREEN}✅ Todos os serviços estão rodando ($RUNNING_SERVICES/$TOTAL_SERVICES)${NC}"
elif [ $RUNNING_SERVICES -eq 0 ]; then
    echo -e "   ${RED}❌ Nenhum serviço está rodando ($RUNNING_SERVICES/$TOTAL_SERVICES)${NC}"
    echo "   Execute start.sh para iniciar"
else
    echo -e "   ${YELLOW}⚠️  Alguns serviços estão parados ($RUNNING_SERVICES/$TOTAL_SERVICES)${NC}"
fi

echo ""
echo "========================================================================"
echo ""

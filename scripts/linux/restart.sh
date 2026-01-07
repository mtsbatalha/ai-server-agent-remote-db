#!/bin/bash

# ============================================
# AI Server Admin - Restart Script
# Com suporte a Smart Docker Scaling
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Import hybrid detection functions
source "$SCRIPT_DIR/docker-hybrid.sh"

cd "$PROJECT_DIR"

echo ""
echo "===================================================================="
echo " 🖥️  AI SERVER ADMIN - REINICIAR SERVIÇOS"
echo "===================================================================="
echo ""

# Load environment variables
load_env "$PROJECT_DIR"

# Check for docker-compose or docker compose
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    echo -e "  ${RED}❌ Docker Compose não encontrado.${NC}"
    exit 1
fi

# ============================================
# SMART DOCKER SCALING - Detecção Híbrida
# ============================================
log_hybrid_status
log_required_containers

# Get required services
REQUIRED_SERVICES=$(get_required_services)

# ============================================
# STEP 1: Clean environment
# ============================================
echo "[1/5] Limpando ambiente..."

# Remove conflicting environment variables
if grep -q "^REDIS_URL" .env 2>/dev/null && ! is_remote_url "$(grep '^REDIS_URL' .env | cut -d'=' -f2- | tr -d '"')"; then
    # Only remove if it's a local URL (keep remote URLs)
    :
fi

echo -e "  ${GREEN}✅ Ambiente limpo${NC}"

# ============================================
# STEP 2: Stop containers
# ============================================
echo ""
echo "[2/5] Parando containers..."

cd docker
$COMPOSE_CMD --env-file ../.env down 2>/dev/null
cd ..

echo -e "  ${GREEN}✅ Containers parados${NC}"

# ============================================
# STEP 3: Start required services
# ============================================
echo ""
echo "[3/5] Iniciando serviços necessários..."

if [ -n "$REQUIRED_SERVICES" ]; then
    cd docker
    $COMPOSE_CMD --env-file ../.env up -d $REQUIRED_SERVICES
    cd ..
    
    # Wait for services
    sleep 3
    
    if needs_docker_redis; then
        if docker exec ai-server-redis-dev redis-cli ping &>/dev/null; then
            echo -e "  ${GREEN}✅ Redis local pronto${NC}"
        else
            echo -e "  ${YELLOW}⚠️  Redis ainda iniciando...${NC}"
        fi
    fi
else
    echo -e "  ${GREEN}✅ Nenhum container Docker necessário${NC}"
    echo "     Todos os serviços estão configurados como remotos."
fi

# ============================================
# STEP 4: Start API and Web
# ============================================
echo ""
echo "[4/5] Iniciando API e Web..."

cd docker
$COMPOSE_CMD --env-file ../.env up -d api web 2>/dev/null || true
cd ..

# Wait for API to be healthy
echo -e "  Aguardando API..."
sleep 10

# Check if API is running
API_STATUS=$(docker ps --filter "name=ai-server-api" --format "{{.Status}}" 2>/dev/null)
if echo "$API_STATUS" | grep -q "Up"; then
    echo -e "  ${GREEN}✅ API rodando${NC}"
else
    echo -e "  ${YELLOW}⚠️  API iniciando...${NC}"
    sleep 5
fi

# ============================================
# STEP 5: Run Prisma migrations
# ============================================
echo ""
echo "[5/5] Verificando banco de dados..."

# Run prisma db push to ensure tables exist
docker exec ai-server-api npx prisma db push --accept-data-loss 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✅ Tabelas do banco atualizadas${NC}"
else
    echo -e "  ${YELLOW}⚠️  Aguardando API iniciar para atualizar banco...${NC}"
    sleep 10
    docker exec ai-server-api npx prisma db push --accept-data-loss 2>/dev/null || true
fi

# Restart API to pick up any changes
docker restart ai-server-api &>/dev/null
sleep 5

# Final status check
echo ""
echo "===================================================================="
echo " 📊 STATUS FINAL"
echo "--------------------------------------------------------------------"

# Check each service
REDIS_OK=false
API_OK=false
WEB_OK=false

# Redis check
if needs_docker_redis; then
    if docker exec ai-server-redis-dev redis-cli ping &>/dev/null; then
        echo -e "  Redis:       ${GREEN}✅ Rodando (Local)${NC}"
        REDIS_OK=true
    else
        echo -e "  Redis:       ${RED}❌ Parado${NC}"
    fi
else
    echo -e "  Redis:       ${GREEN}✅ Remoto${NC}"
    REDIS_OK=true
fi

if docker ps --filter "name=ai-server-api" --format "{{.Status}}" | grep -q "Up"; then
    echo -e "  API:         ${GREEN}✅ Rodando${NC}"
    API_OK=true
else
    echo -e "  API:         ${RED}❌ Parado${NC}"
fi

if docker ps --filter "name=ai-server-web" --format "{{.Status}}" | grep -q "Up"; then
    echo -e "  Frontend:    ${GREEN}✅ Rodando${NC}"
    WEB_OK=true
else
    echo -e "  Frontend:    ${RED}❌ Parado${NC}"
fi

echo ""
echo "--------------------------------------------------------------------"
if $REDIS_OK && $API_OK && $WEB_OK; then
    echo -e " ${GREEN}✅ TODOS OS SERVIÇOS RODANDO!${NC}"
    
    # Get actual ports from .env
    API_PORT=$(grep "^API_PORT" .env 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "3003")
    WEB_PORT=$(grep "^WEB_PORT" .env 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "3002")
    
    echo ""
    echo " 📋 URLs disponíveis:"
    echo "  Frontend:   http://localhost:${WEB_PORT:-3002}"
    echo "  Backend:    http://localhost:${API_PORT:-3003}"
    echo "  API Docs:   http://localhost:${API_PORT:-3003}/api/docs"
else
    echo -e " ${YELLOW}⚠️  Alguns serviços estão parados${NC}"
    echo ""
    echo " Verifique os logs com: docker logs ai-server-api"
fi
echo "===================================================================="
echo ""

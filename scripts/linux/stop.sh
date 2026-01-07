#!/bin/bash

# ============================================
# AI Server Admin - Stop Script
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
echo "===================================================="
echo " 🖥️  AI SERVER ADMIN - PARAR SERVIÇOS"
echo "===================================================="
echo ""

# Load environment variables
load_env "$PROJECT_DIR"

# Show hybrid status
log_hybrid_status

# Kill Node.js processes for this project
echo "[1/2] Parando servidores Node.js..."

# Find and kill processes on ports 3000 and 3001
WEB_PID=$(lsof -t -i:3000 2>/dev/null)
if [ -n "$WEB_PID" ]; then
    echo "  Parando processo na porta 3000 (PID: $WEB_PID)"
    kill -9 $WEB_PID 2>/dev/null
fi

API_PID=$(lsof -t -i:3001 2>/dev/null)
if [ -n "$API_PID" ]; then
    echo "  Parando processo na porta 3001 (PID: $API_PID)"
    kill -9 $API_PID 2>/dev/null
fi

echo -e "  ${GREEN}✅ Servidores Node.js parados${NC}"

# Check for docker-compose or docker compose
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    echo -e "  ${RED}❌ Docker Compose não encontrado.${NC}"
    exit 1
fi

# Stop Docker containers
echo ""
echo "[2/2] Parando containers Docker..."

# Get currently running containers
RUNNING_CONTAINERS=$(docker ps --filter "name=ai-server" --format "{{.Names}}" 2>/dev/null | wc -l)

if [ "$RUNNING_CONTAINERS" -gt 0 ]; then
    cd docker
    $COMPOSE_CMD --env-file ../.env stop
    if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}✅ Containers Docker parados${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Erro ao parar alguns containers${NC}"
    fi
    cd ..
else
    echo -e "  ${GREEN}✅ Nenhum container Docker rodando${NC}"
fi

echo ""
echo "===================================================="
echo -e " ${GREEN}✅ TODOS OS SERVIÇOS FORAM PARADOS${NC}"
echo "===================================================="
echo ""
echo " Para remover completamente os containers, execute:"
echo "   cd docker && docker compose --env-file ../.env down"
echo ""

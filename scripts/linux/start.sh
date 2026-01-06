#!/bin/bash

# ============================================
# AI Server Admin - Start Script
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$PROJECT_DIR"

echo ""
echo "===================================================="
echo " 🖥️  AI SERVER ADMIN - INICIAR SERVIÇOS"
echo "===================================================="
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "  ${RED}❌ Arquivo .env não encontrado!${NC}"
    echo "  Execute install.sh primeiro."
    exit 1
fi

# Check for docker-compose or docker compose
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    echo -e "  ${RED}❌ Docker Compose não encontrado.${NC}"
    exit 1
fi

# Start Docker containers
echo "[1/2] Iniciando containers Docker..."
cd docker

# First stop any existing containers (without removing volumes)
$COMPOSE_CMD --env-file ../.env down 2>/dev/null

# Start fresh
$COMPOSE_CMD --env-file ../.env up -d
if [ $? -ne 0 ]; then
    echo -e "  ${RED}❌ Falha ao iniciar containers Docker${NC}"
    echo "  Verifique se o Docker está rodando."
    echo "  Se o problema persistir, execute: ./scripts/linux/reset.sh"
    cd ..
    exit 1
fi
cd ..
echo -e "  ${GREEN}✅ Containers Docker iniciados${NC}"

# Wait for services to be ready
echo ""
echo "[2/2] Aguardando serviços ficarem prontos..."

# Check Redis
sleep 3
if docker exec ai-server-redis redis-cli ping &> /dev/null; then
    echo -e "  ${GREEN}✅ Redis pronto${NC}"
else
    echo -e "  ${YELLOW}⚠️  Redis ainda iniciando...${NC}"
fi

# Check API
sleep 3
if docker ps --filter "name=ai-server-api" --format "{{.Status}}" | grep -q "Up"; then
    echo -e "  ${GREEN}✅ API rodando${NC}"
else
    echo -e "  ${YELLOW}⚠️  API ainda iniciando (aguarde mais alguns segundos)${NC}"
fi

echo ""
echo "===================================================="
echo " 📋 URLs disponíveis:"
echo "----------------------------------------------------"
echo "  Frontend:   http://localhost:3000"
echo "  Backend:    http://localhost:3001"
echo "  API Docs:   http://localhost:3001/api/docs"
echo "===================================================="
echo ""
echo "Visualizando logs (pressione Ctrl+C para sair)..."
echo ""

cd docker
$COMPOSE_CMD --env-file ../.env logs -f api web


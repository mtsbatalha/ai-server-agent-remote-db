#!/bin/bash

# ============================================
# AI Server Admin - Fix Database Script
# Resolve problemas de autenticação do PostgreSQL
# ============================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

echo ""
echo "========================================================================"
echo -e " 🔧 ${BLUE}AI SERVER ADMIN - CORREÇÃO DO BANCO DE DADOS${NC}"
echo "========================================================================"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Arquivo .env não encontrado!${NC}"
    exit 1
fi

# Remove DATABASE_URL if exists (Docker generates it automatically)
if grep -q "^DATABASE_URL" .env 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Removendo DATABASE_URL do .env (Docker gera automaticamente)${NC}"
    sed -i '/^DATABASE_URL/d' .env
fi

if grep -q "^REDIS_URL" .env 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Removendo REDIS_URL do .env (Docker gera automaticamente)${NC}"
    sed -i '/^REDIS_URL/d' .env
fi

echo ""
echo "[1/5] Parando containers..."
docker compose --env-file .env -f docker/docker-compose.yml down 2>/dev/null || true
echo -e "  ${GREEN}✅ Containers parados${NC}"

echo ""
echo "[2/5] Removendo volumes de banco antigos..."

# Remove all possible postgres volume names
VOLUMES_TO_REMOVE=(
    "docker_postgres_data"
    "ai-server-agent_postgres_data"
    "ai-server-postgres-data"
    "ai-server_postgres_data"
)

for vol in "${VOLUMES_TO_REMOVE[@]}"; do
    if docker volume ls -q | grep -q "^${vol}$"; then
        docker volume rm "$vol" 2>/dev/null && echo -e "  ${GREEN}✅ Volume $vol removido${NC}" || echo -e "  ${YELLOW}⚠️  Não foi possível remover $vol${NC}"
    fi
done

# Also remove redis volumes for clean state
REDIS_VOLUMES=(
    "docker_redis_data"
    "ai-server-agent_redis_data"
    "ai-server-redis-data"
    "ai-server_redis_data"
)

for vol in "${REDIS_VOLUMES[@]}"; do
    if docker volume ls -q | grep -q "^${vol}$"; then
        docker volume rm "$vol" 2>/dev/null && echo -e "  ${GREEN}✅ Volume $vol removido${NC}" || true
    fi
done

echo -e "  ${GREEN}✅ Limpeza de volumes concluída${NC}"

echo ""
echo "[3/5] Iniciando containers..."
docker compose --env-file .env -f docker/docker-compose.yml up -d
echo -e "  ${GREEN}✅ Containers iniciados${NC}"

echo ""
echo "[4/5] Aguardando banco de dados ficar pronto..."
sleep 15

# Wait for postgres to be healthy
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if docker exec ai-server-postgres pg_isready -U postgres &>/dev/null; then
        echo -e "  ${GREEN}✅ PostgreSQL está pronto${NC}"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo -e "  ${YELLOW}⏳ Aguardando PostgreSQL... ($ATTEMPT/$MAX_ATTEMPTS)${NC}"
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "  ${RED}❌ PostgreSQL não iniciou a tempo${NC}"
    echo "  Verifique os logs: docker logs ai-server-postgres"
    exit 1
fi

echo ""
echo "[5/5] Criando/atualizando tabelas do banco..."
sleep 5
docker exec -it ai-server-api npx prisma db push

echo ""
echo "========================================================================"
echo -e " ${GREEN}✅ BANCO DE DADOS CORRIGIDO COM SUCESSO!${NC}"
echo "========================================================================"
echo ""
echo " Verifique o status com: bash scripts/linux/status.sh"
echo ""

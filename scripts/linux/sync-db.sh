#!/bin/bash

# ============================================
# AI Server Admin - Sync Database Password
# Sincroniza a senha do PostgreSQL com o .env
# SEM perder dados
# ============================================

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
echo -e " 🔐 ${BLUE}AI SERVER ADMIN - SINCRONIZAR SENHA DO BANCO${NC}"
echo "========================================================================"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Arquivo .env não encontrado!${NC}"
    exit 1
fi

# Remove DATABASE_URL if exists
if grep -q "^DATABASE_URL" .env 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Removendo DATABASE_URL do .env${NC}"
    sed -i '/^DATABASE_URL/d' .env
fi

# Remove quotes from POSTGRES variables if present
sed -i 's/POSTGRES_PASSWORD="\([^"]*\)"/POSTGRES_PASSWORD=\1/' .env
sed -i "s/POSTGRES_PASSWORD='\([^']*\)'/POSTGRES_PASSWORD=\1/" .env
sed -i 's/POSTGRES_USER="\([^"]*\)"/POSTGRES_USER=\1/' .env
sed -i "s/POSTGRES_USER='\([^']*\)'/POSTGRES_USER=\1/" .env
sed -i 's/POSTGRES_DB="\([^"]*\)"/POSTGRES_DB=\1/' .env
sed -i "s/POSTGRES_DB='\([^']*\)'/POSTGRES_DB=\1/" .env

# Get password from .env
POSTGRES_PASS=$(grep "^POSTGRES_PASSWORD" .env | cut -d'=' -f2)

if [ -z "$POSTGRES_PASS" ]; then
    echo -e "${RED}❌ POSTGRES_PASSWORD não encontrado no .env${NC}"
    exit 1
fi

echo -e "Senha no .env: ${GREEN}${POSTGRES_PASS}${NC}"
echo ""

# Check if PostgreSQL container is running
if ! docker ps --filter "name=ai-server-postgres" --format "{{.Names}}" | grep -q "ai-server-postgres"; then
    echo -e "${YELLOW}⚠️  Container PostgreSQL não está rodando. Iniciando...${NC}"
    docker compose --env-file .env -f docker/docker-compose.yml up -d postgres
    sleep 10
fi

# Wait for PostgreSQL to be ready
echo "Aguardando PostgreSQL ficar pronto..."
MAX_ATTEMPTS=15
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if docker exec ai-server-postgres pg_isready -U postgres &>/dev/null; then
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}❌ PostgreSQL não está respondendo${NC}"
    exit 1
fi

# Sync password
echo "Sincronizando senha..."
docker exec ai-server-postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD '${POSTGRES_PASS}';" &>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Senha do PostgreSQL sincronizada com sucesso!${NC}"
else
    echo -e "${RED}❌ Falha ao sincronizar senha${NC}"
    exit 1
fi

# Test connection
echo ""
echo "Testando conexão..."
TEST_RESULT=$(docker run --rm --network docker_ai-server-network postgres:16-alpine psql "postgresql://postgres:${POSTGRES_PASS}@ai-server-postgres:5432/ai_server" -c "SELECT 1" 2>&1)

if echo "$TEST_RESULT" | grep -q "1 row"; then
    echo -e "${GREEN}✅ Conexão testada com sucesso!${NC}"
else
    echo -e "${YELLOW}⚠️  Teste de conexão falhou. Tentando via rede alternativa...${NC}"
    # Try with different network name
    for network in $(docker network ls --format "{{.Name}}" | grep -E "ai.*server|server.*network"); do
        TEST_RESULT=$(docker run --rm --network "$network" postgres:16-alpine psql "postgresql://postgres:${POSTGRES_PASS}@postgres:5432/ai_server" -c "SELECT 1" 2>&1)
        if echo "$TEST_RESULT" | grep -q "1 row"; then
            echo -e "${GREEN}✅ Conexão testada com sucesso via rede $network!${NC}"
            break
        fi
    done
fi

# Restart API
echo ""
echo "Reiniciando API..."
docker restart ai-server-api &>/dev/null
sleep 10

# Check API
if docker ps --filter "name=ai-server-api" --format "{{.Status}}" | grep -q "Up"; then
    echo -e "${GREEN}✅ API reiniciada com sucesso!${NC}"
else
    echo -e "${YELLOW}⚠️  API pode estar iniciando ainda. Verifique os logs:${NC}"
    echo "  docker logs ai-server-api --tail 20"
fi

echo ""
echo "========================================================================"
echo -e " ${GREEN}✅ SINCRONIZAÇÃO CONCLUÍDA!${NC}"
echo "========================================================================"
echo ""

#!/bin/bash

# ============================================
# AI Server Admin - Restart Script
# Reinicia todos os serviços e corrige problemas
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
echo "===================================================================="
echo " 🖥️  AI SERVER ADMIN - REINICIAR SERVIÇOS"
echo "===================================================================="
echo ""

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
# STEP 1: Clean environment
# ============================================
echo "[1/5] Limpando ambiente..."

# Remove conflicting environment variables
if grep -q "^DATABASE_URL" .env 2>/dev/null; then
    sed -i '/^DATABASE_URL/d' .env
    echo -e "  ${YELLOW}⚠️  Removido DATABASE_URL do .env${NC}"
fi
if grep -q "^REDIS_URL" .env 2>/dev/null; then
    sed -i '/^REDIS_URL/d' .env
    echo -e "  ${YELLOW}⚠️  Removido REDIS_URL do .env${NC}"
fi

# Remove quotes from POSTGRES variables
sed -i 's/POSTGRES_PASSWORD="\([^"]*\)"/POSTGRES_PASSWORD=\1/' .env 2>/dev/null
sed -i "s/POSTGRES_PASSWORD='\([^']*\)'/POSTGRES_PASSWORD=\1/" .env 2>/dev/null
sed -i 's/POSTGRES_USER="\([^"]*\)"/POSTGRES_USER=\1/' .env 2>/dev/null
sed -i 's/POSTGRES_DB="\([^"]*\)"/POSTGRES_DB=\1/' .env 2>/dev/null

echo -e "  ${GREEN}✅ Ambiente limpo${NC}"

# ============================================
# STEP 2: Stop containers
# ============================================
echo ""
echo "[2/5] Parando containers..."

cd docker
$COMPOSE_CMD --env-file ../.env down 2>/dev/null
cd ..

# Clean up old volumes with wrong names
OLD_VOLUMES=("docker_postgres_data" "docker_redis_data")
for vol in "${OLD_VOLUMES[@]}"; do
    if docker volume ls -q | grep -q "^${vol}$"; then
        docker volume rm "$vol" 2>/dev/null && echo -e "  ${YELLOW}⚠️  Volume antigo removido: $vol${NC}"
    fi
done

echo -e "  ${GREEN}✅ Containers parados${NC}"

# ============================================
# STEP 3: Start containers (without API first)
# ============================================
echo ""
echo "[3/5] Iniciando banco de dados..."

cd docker
# Start only postgres and redis first
$COMPOSE_CMD --env-file ../.env up -d postgres redis
cd ..

# Wait for PostgreSQL
echo -e "  Aguardando PostgreSQL..."
MAX_WAIT=60
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if docker exec ai-server-postgres pg_isready -U postgres &>/dev/null; then
        break
    fi
    sleep 2
    WAITED=$((WAITED + 2))
done

if ! docker exec ai-server-postgres pg_isready -U postgres &>/dev/null; then
    echo -e "  ${RED}❌ PostgreSQL não iniciou${NC}"
    exit 1
fi

echo -e "  ${GREEN}✅ PostgreSQL pronto${NC}"

# ============================================
# STEP 4: Sync password and start API
# ============================================
echo ""
echo "[4/5] Sincronizando senha e iniciando API..."

# Get password from .env
POSTGRES_PASS=$(grep "^POSTGRES_PASSWORD" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'")

if [ -n "$POSTGRES_PASS" ]; then
    # Sync password to running PostgreSQL
    docker exec ai-server-postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD '${POSTGRES_PASS}';" &>/dev/null
    echo -e "  ${GREEN}✅ Senha sincronizada${NC}"
fi

# Now start API and Web
cd docker
$COMPOSE_CMD --env-file ../.env up -d api web
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
POSTGRES_OK=false
REDIS_OK=false
API_OK=false
WEB_OK=false

if docker exec ai-server-postgres pg_isready -U postgres &>/dev/null; then
    echo -e "  PostgreSQL:  ${GREEN}✅ Rodando${NC}"
    POSTGRES_OK=true
else
    echo -e "  PostgreSQL:  ${RED}❌ Parado${NC}"
fi

if docker exec ai-server-redis redis-cli ping &>/dev/null; then
    echo -e "  Redis:       ${GREEN}✅ Rodando${NC}"
    REDIS_OK=true
else
    echo -e "  Redis:       ${RED}❌ Parado${NC}"
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
if $POSTGRES_OK && $REDIS_OK && $API_OK && $WEB_OK; then
    echo -e " ${GREEN}✅ TODOS OS SERVIÇOS RODANDO!${NC}"
    
    # Get actual ports from .env
    API_PORT=$(grep "^API_HOST_PORT" .env 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "3003")
    WEB_PORT=$(grep "^WEB_HOST_PORT" .env 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "3000")
    
    echo ""
    echo " 📋 URLs disponíveis:"
    echo "  Frontend:   http://localhost:${WEB_PORT:-3000}"
    echo "  Backend:    http://localhost:${API_PORT:-3003}"
    echo "  API Docs:   http://localhost:${API_PORT:-3003}/api/docs"
else
    echo -e " ${YELLOW}⚠️  Alguns serviços estão parados${NC}"
    echo ""
    echo " Verifique os logs com: docker logs ai-server-api"
fi
echo "===================================================================="
echo ""

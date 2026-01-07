#!/bin/bash

# ============================================
# AI Server Admin - Reset Script (FULL CLEANUP)
# Com suporte a Smart Docker Scaling
# ============================================
# WARNING: This script will DELETE ALL DATA including database!
# Use this only for fresh installations or when you need to start over.

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
echo -e " ${RED}⚠️  AI SERVER ADMIN - RESET COMPLETO${NC}"
echo "===================================================="
echo ""
echo -e "${YELLOW}ATENÇÃO: Este script irá:${NC}"
echo "  - Parar TODOS os containers"
echo "  - REMOVER todos os volumes (banco de dados, cache)"
echo "  - Recriar tudo do zero"
echo ""

# Confirmation
read -p "Tem certeza que deseja continuar? (digite 'sim' para confirmar): " CONFIRM
if [ "$CONFIRM" != "sim" ]; then
    echo "Operação cancelada."
    exit 0
fi

echo ""

# Load environment variables
load_env "$PROJECT_DIR"

# Check for docker compose command
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

# Kill any rogue local processes
echo "[1/7] Parando processos locais..."
for PORT in 3000 3001 3003 3004; do
    PID=$(lsof -t -i:$PORT 2>/dev/null)
    if [ -n "$PID" ]; then
        echo "  Parando processo na porta $PORT (PID: $PID)"
        kill -9 $PID 2>/dev/null
    fi
done
echo -e "  ${GREEN}✅ Processos locais parados${NC}"

# Stop and remove containers + volumes
echo ""
echo "[2/7] Parando e removendo containers e volumes..."
cd docker
$COMPOSE_CMD --env-file ../.env down -v --remove-orphans
cd ..
echo -e "  ${GREEN}✅ Containers e volumes removidos${NC}"

# Remove any orphan volumes
echo ""
echo "[3/7] Limpando volumes órfãos..."
docker volume prune -f 2>/dev/null
echo -e "  ${GREEN}✅ Volumes órfãos removidos${NC}"

# Generate new secrets
echo ""
echo "[4/7] Gerando chaves de segurança..."

# Generate new JWT_SECRET
NEW_JWT_SECRET=$(openssl rand -base64 32)
# Generate new ENCRYPTION_KEY (32 bytes hex for AES-256)
NEW_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Update .env file - remove conflicting entries and add new secrets
if [ -f ".env" ]; then
    # Remove any existing JWT_SECRET and ENCRYPTION_KEY lines
    sed -i '/^JWT_SECRET/d' .env
    sed -i '/^ENCRYPTION_KEY/d' .env
    
    # Add new secrets
    echo "JWT_SECRET=\"${NEW_JWT_SECRET}\"" >> .env
    echo "ENCRYPTION_KEY=\"${NEW_ENCRYPTION_KEY}\"" >> .env
    
    echo -e "  ${GREEN}✅ Chaves geradas e salvas no .env${NC}"
    echo ""
    echo -e "  ${CYAN}📋 Suas novas chaves de segurança:${NC}"
    echo -e "  ${BOLD}JWT_SECRET:${NC}     ${NEW_JWT_SECRET}"
    echo -e "  ${BOLD}ENCRYPTION_KEY:${NC} ${NEW_ENCRYPTION_KEY}"
    echo ""
    echo -e "  ${YELLOW}⚠️  Guarde essas chaves em local seguro!${NC}"
else
    echo -e "  ${RED}❌ Arquivo .env não encontrado${NC}"
    exit 1
fi

# Start fresh (only required services)
echo ""
echo "[5/7] Iniciando containers do zero..."

if [ -n "$REQUIRED_SERVICES" ]; then
    cd docker
    $COMPOSE_CMD --env-file ../.env up -d $REQUIRED_SERVICES
    if [ $? -ne 0 ]; then
        echo -e "  ${RED}❌ Falha ao iniciar containers${NC}"
        cd ..
        exit 1
    fi
    cd ..
    echo -e "  ${GREEN}✅ Containers iniciados${NC}"
else
    echo -e "  ${GREEN}✅ Nenhum container Docker necessário${NC}"
    echo "     Todos os serviços estão configurados como remotos."
fi

# Wait for services
echo ""
echo "[6/7] Aguardando serviços ficarem prontos..."

if needs_docker_redis; then
    sleep 3
    if docker exec ai-server-redis-dev redis-cli ping &> /dev/null; then
        echo -e "  ${GREEN}✅ Redis local pronto${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Redis ainda iniciando...${NC}"
    fi
else
    echo -e "  ${GREEN}✅ Redis remoto configurado${NC}"
fi

# Check API
sleep 5
if docker ps --filter "name=ai-server-api" --format "{{.Status}}" | grep -q "Up"; then
    echo -e "  ${GREEN}✅ API rodando${NC}"
    
    # Run Prisma db push to create tables
    echo ""
    echo "[7/7] Sincronizando schema com banco de dados remoto..."
    docker exec ai-server-api npx prisma db push --schema=prisma/schema.prisma --skip-generate 2>/dev/null
    if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}✅ Schema sincronizado com sucesso${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Erro ao sincronizar schema (verifique logs e DATABASE_URL)${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠️  API ainda iniciando (verifique logs)${NC}"
fi

echo ""
echo "===================================================="
echo -e " ${GREEN}✅ RESET COMPLETO!${NC}"
echo "===================================================="
echo ""
echo " Sistema redefinido para usar banco remoto."
echo ""
echo " URLs disponíveis:"
echo "  Frontend:   http://localhost:3000"
echo "  Backend:    http://localhost:3000"
echo "  API Docs:   http://localhost:3000/api/docs"
echo ""
echo " Para ver os logs em tempo real:"
echo "   cd docker && docker compose --env-file ../.env logs -f"
echo ""

#!/bin/bash

# ============================================
# AI Server Admin - Uninstall Script
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

cd "$PROJECT_DIR"

echo ""
echo "===================================================="
echo -e " ${RED}🗑️  AI SERVER ADMIN - DESINSTALAÇÃO COMPLETA${NC}"
echo "===================================================="
echo ""
echo -e " ${YELLOW}⚠️  ATENÇÃO: Este script irá REMOVER COMPLETAMENTE:${NC}"
echo ""
echo "     - Containers Docker (ai-server-*)"
echo "     - Volumes Docker (banco de dados e cache)"
echo "     - Imagens Docker do projeto"
echo "     - Dependências (node_modules)"
echo "     - Arquivos de configuração (.env)"
echo "     - Arquivos gerados pelo Prisma"
echo ""
echo "===================================================="
echo ""

read -p "   Tem certeza que deseja continuar? (digite 'sim' para confirmar): " CONFIRM1
if [[ "$CONFIRM1" != "sim" ]]; then
    echo ""
    echo -e "   ${RED}❌ Operação cancelada.${NC}"
    exit 0
fi

echo ""
read -p "   ⚠️  SEGUNDA CONFIRMAÇÃO - Você irá PERDER TODOS OS DADOS! (digite 'DESINSTALAR' para confirmar): " CONFIRM2
if [[ "$CONFIRM2" != "DESINSTALAR" ]]; then
    echo ""
    echo -e "   ${RED}❌ Operação cancelada.${NC}"
    exit 0
fi

echo ""
echo "===================================================="
echo "   Iniciando desinstalação..."
echo "===================================================="
echo ""

# ============================================
# 1. PARAR SERVIÇOS NODE.JS
# ============================================
echo -e "${BOLD}[1/6] Parando servidores Node.js...${NC}"

# Kill processes on common ports
for port in 3000 3001 3003; do
    pid=$(lsof -t -i:$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo "   Parando processo na porta $port (PID: $pid)"
        kill -9 $pid 2>/dev/null
    fi
done

echo -e "   ${GREEN}✅ Servidores Node.js parados${NC}"

# ============================================
# 2. PARAR E REMOVER CONTAINERS DOCKER
# ============================================
echo ""
echo -e "${BOLD}[2/6] Parando e removendo containers Docker...${NC}"

if command -v docker &> /dev/null; then
    if docker info &> /dev/null; then
        # Stop containers
        docker stop ai-server-postgres ai-server-redis ai-server-api ai-server-web 2>/dev/null
        docker stop ai-server-postgres-dev ai-server-redis-dev 2>/dev/null
        echo -e "   ${GREEN}✅ Containers parados${NC}"
        
        # Remove containers
        docker rm ai-server-postgres ai-server-redis ai-server-api ai-server-web 2>/dev/null
        docker rm ai-server-postgres-dev ai-server-redis-dev 2>/dev/null
        echo -e "   ${GREEN}✅ Containers removidos${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Docker não está rodando - pulando containers${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠️  Docker não encontrado - pulando containers${NC}"
fi

# ============================================
# 3. REMOVER VOLUMES DOCKER
# ============================================
echo ""
echo -e "${BOLD}[3/6] Removendo volumes Docker (dados do banco)...${NC}"

if command -v docker &> /dev/null && docker info &> /dev/null; then
    docker volume rm ai-server-postgres-data 2>/dev/null
    docker volume rm docker_postgres_data 2>/dev/null
    docker volume rm docker_redis_data 2>/dev/null
    docker volume rm docker_postgres_data_dev 2>/dev/null
    docker volume rm docker_redis_data_dev 2>/dev/null
    
    # Also try with project prefix variations
    for vol in $(docker volume ls -q --filter "name=ai-server" 2>/dev/null); do
        docker volume rm "$vol" 2>/dev/null
    done
    
    echo -e "   ${GREEN}✅ Volumes removidos${NC}"
fi

# ============================================
# 4. REMOVER IMAGENS DOCKER
# ============================================
echo ""
echo -e "${BOLD}[4/6] Removendo imagens Docker do projeto...${NC}"

if command -v docker &> /dev/null && docker info &> /dev/null; then
    # Remove images with ai-server in name
    for img in $(docker images -q --filter "reference=*ai-server*" 2>/dev/null); do
        docker rmi "$img" 2>/dev/null
    done
    
    # Remove docker-api and docker-web images
    for img in $(docker images -q --filter "reference=docker-api" 2>/dev/null); do
        docker rmi "$img" 2>/dev/null
    done
    
    for img in $(docker images -q --filter "reference=docker-web" 2>/dev/null); do
        docker rmi "$img" 2>/dev/null
    done
    
    echo -e "   ${GREEN}✅ Imagens removidas${NC}"
fi

# ============================================
# 5. REMOVER NODE_MODULES
# ============================================
echo ""
echo -e "${BOLD}[5/6] Removendo dependências (node_modules)...${NC}"

if [ -d "node_modules" ]; then
    rm -rf "node_modules"
    echo -e "   ${GREEN}✅ node_modules removido${NC}"
else
    echo "   - node_modules não encontrado"
fi

if [ -d "apps/api/node_modules" ]; then
    rm -rf "apps/api/node_modules"
    echo -e "   ${GREEN}✅ apps/api/node_modules removido${NC}"
fi

if [ -d "apps/web/node_modules" ]; then
    rm -rf "apps/web/node_modules"
    echo -e "   ${GREEN}✅ apps/web/node_modules removido${NC}"
fi

# ============================================
# 6. REMOVER ARQUIVOS GERADOS
# ============================================
echo ""
echo -e "${BOLD}[6/6] Removendo arquivos gerados...${NC}"

if [ -f ".env" ]; then
    rm -f ".env"
    echo -e "   ${GREEN}✅ .env removido${NC}"
else
    echo "   - .env não encontrado"
fi

if [ -d "apps/api/dist" ]; then
    rm -rf "apps/api/dist"
    echo -e "   ${GREEN}✅ apps/api/dist removido${NC}"
fi

if [ -d "apps/web/.next" ]; then
    rm -rf "apps/web/.next"
    echo -e "   ${GREEN}✅ apps/web/.next removido${NC}"
fi

if [ -d "apps/api/prisma/generated" ]; then
    rm -rf "apps/api/prisma/generated"
    echo -e "   ${GREEN}✅ Prisma Client removido${NC}"
fi

# Remove pnpm lock file
if [ -f "pnpm-lock.yaml" ]; then
    rm -f "pnpm-lock.yaml"
    echo -e "   ${GREEN}✅ pnpm-lock.yaml removido${NC}"
fi

# ============================================
# PERGUNTAR SOBRE REMOÇÃO DO PROJETO
# ============================================
echo ""
echo "===================================================="
echo -e " ${GREEN}✅ Desinstalação dos componentes concluída!${NC}"
echo "===================================================="
echo ""
read -p "   Deseja também REMOVER A PASTA DO PROJETO? (digite 'sim' para confirmar): " REMOVE_PROJECT

if [[ "$REMOVE_PROJECT" == "sim" ]]; then
    echo ""
    echo -e "   ${YELLOW}⚠️  Removendo pasta do projeto...${NC}"
    
    PARENT_DIR="$(dirname "$PROJECT_DIR")"
    PROJECT_NAME="$(basename "$PROJECT_DIR")"
    
    cd "$PARENT_DIR"
    rm -rf "$PROJECT_NAME"
    
    echo -e "   ${GREEN}✅ Pasta do projeto removida${NC}"
    echo ""
    echo "===================================================="
    echo -e " ${GREEN}🏁 DESINSTALAÇÃO COMPLETA FINALIZADA${NC}"
    echo "===================================================="
    exit 0
else
    echo ""
    echo -e "   ${CYAN}📁 Pasta do projeto mantida em: $PROJECT_DIR${NC}"
fi

echo ""
echo "===================================================="
echo -e " ${GREEN}🏁 DESINSTALAÇÃO FINALIZADA${NC}"
echo "===================================================="
echo ""
echo "   O que foi removido:"
echo -e "     ${GREEN}✅${NC} Containers Docker"
echo -e "     ${GREEN}✅${NC} Volumes Docker (dados do banco)"
echo -e "     ${GREEN}✅${NC} Imagens Docker"
echo -e "     ${GREEN}✅${NC} Dependências (node_modules)"
echo -e "     ${GREEN}✅${NC} Arquivos de configuração (.env)"
echo -e "     ${GREEN}✅${NC} Arquivos compilados"
echo ""
echo "   Para reinstalar, execute: ./scripts/linux/install.sh"
echo ""
echo "===================================================="
echo ""

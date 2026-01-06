#!/bin/bash

# ============================================
# AI Server Admin - Install Script
# Instalação automática de todas as dependências
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

cd "$PROJECT_DIR"

echo ""
echo "===================================================="
echo " 🖥️  AI SERVER ADMIN - INSTALAÇÃO"
echo "===================================================="
echo ""

# ============================================
# Helper function to detect package manager
# ============================================
install_package() {
    local package=$1
    if command -v apt-get &> /dev/null; then
        apt-get install -y $package
    elif command -v dnf &> /dev/null; then
        dnf install -y $package
    elif command -v yum &> /dev/null; then
        yum install -y $package
    else
        echo -e "  ${RED}❌ Gerenciador de pacotes não suportado.${NC}"
        return 1
    fi
}

# ============================================
# [0/7] Install prerequisites (curl, git)
# ============================================
echo -e "[0/7] Verificando pré-requisitos..."

if ! command -v curl &> /dev/null; then
    echo -e "  ${YELLOW}⚠️  curl não encontrado. Instalando...${NC}"
    install_package curl
fi

if ! command -v git &> /dev/null; then
    echo -e "  ${YELLOW}⚠️  git não encontrado. Instalando...${NC}"
    install_package git
fi

echo -e "  ${GREEN}✅ Pré-requisitos OK${NC}"

# ============================================
# [1/7] Check/Install Node.js
# ============================================
echo ""
echo -e "[1/7] Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "  ${YELLOW}⚠️  Node.js não encontrado. Instalando Node.js 20...${NC}"
    
    if command -v apt-get &> /dev/null; then
        # Debian/Ubuntu
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    elif command -v dnf &> /dev/null; then
        # Fedora/RHEL
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        dnf install -y nodejs
    elif command -v yum &> /dev/null; then
        # CentOS/older RHEL
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        yum install -y nodejs
    else
        echo -e "  ${RED}❌ Gerenciador de pacotes não suportado.${NC}"
        echo "  Por favor, instale o Node.js 18+ manualmente de: https://nodejs.org"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        echo -e "  ${RED}❌ Falha ao instalar Node.js${NC}"
        exit 1
    fi
fi
NODE_VERSION=$(node -v)
echo -e "  ${GREEN}✅ Node.js: $NODE_VERSION${NC}"

# ============================================
# [2/7] Check/Install pnpm
# ============================================
echo ""
echo -e "[2/7] Verificando pnpm..."
if ! command -v pnpm &> /dev/null; then
    echo -e "  ${YELLOW}⚠️  pnpm não encontrado. Instalando...${NC}"
    npm install -g pnpm
fi
PNPM_VERSION=$(pnpm -v)
echo -e "  ${GREEN}✅ pnpm: v$PNPM_VERSION${NC}"

# ============================================
# [3/7] Check/Install Docker
# ============================================
echo ""
echo -e "[3/7] Verificando Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "  ${YELLOW}⚠️  Docker não encontrado. Instalando...${NC}"
    
    # Install Docker using official script
    curl -fsSL https://get.docker.com | sh
    
    # Start Docker service
    if command -v systemctl &> /dev/null; then
        systemctl start docker
        systemctl enable docker
    fi
    
    if ! command -v docker &> /dev/null; then
        echo -e "  ${RED}❌ Falha ao instalar Docker${NC}"
        exit 1
    fi
fi

# Check if Docker is running
if ! docker info &> /dev/null 2>&1; then
    echo -e "  ${YELLOW}⚠️  Docker não está rodando. Iniciando...${NC}"
    if command -v systemctl &> /dev/null; then
        systemctl start docker
        sleep 3
    fi
    
    if ! docker info &> /dev/null 2>&1; then
        echo -e "  ${RED}❌ Não foi possível iniciar o Docker${NC}"
        echo "  Tente executar: systemctl start docker"
        exit 1
    fi
fi

DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
echo -e "  ${GREEN}✅ Docker: v$DOCKER_VERSION${NC}"

# ============================================
# [4/7] Check/Install Docker Compose
# ============================================
echo ""
echo -e "[4/7] Verificando Docker Compose..."

# Check for docker-compose or docker compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
    echo -e "  ${YELLOW}⚠️  Docker Compose não encontrado. Instalando...${NC}"
    
    # Install Docker Compose plugin
    if command -v apt-get &> /dev/null; then
        apt-get install -y docker-compose-plugin
    elif command -v dnf &> /dev/null; then
        dnf install -y docker-compose-plugin
    elif command -v yum &> /dev/null; then
        yum install -y docker-compose-plugin
    else
        # Fallback: install standalone docker-compose
        COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
        curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi
fi

# Create alias function for docker-compose compatibility
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    echo -e "  ${RED}❌ Docker Compose não disponível${NC}"
    exit 1
fi

echo -e "  ${GREEN}✅ Docker Compose disponível${NC}"

# ============================================
# [5/7] Install project dependencies
# ============================================
echo ""
echo -e "[5/7] Instalando dependências do projeto..."

# Approve builds for packages that need to run scripts (Prisma, ssh2, etc.)
echo "  Aprovando build scripts para pacotes necessários..."
pnpm config set script-shell /bin/bash 2>/dev/null || true

# Install dependencies
pnpm install

# Approve and reinstall if build scripts were blocked
if pnpm approve-builds 2>/dev/null; then
    echo "  Re-instalando com scripts habilitados..."
    pnpm install
fi

echo -e "  ${GREEN}✅ Dependências instaladas${NC}"

# ============================================
# [6/8] Configure environment
# ============================================
echo ""
echo -e "[6/8] Configurando ambiente..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "  ${GREEN}✅ Arquivo .env criado a partir de .env.example${NC}"
    else
        echo -e "  ${RED}❌ Arquivo .env.example não encontrado!${NC}"
        exit 1
    fi
else
    echo -e "  ${GREEN}✅ Arquivo .env já existe${NC}"
fi

# Generate security keys
echo ""
echo -e "[7/8] Gerando chaves de segurança..."

# Check if keys already exist and are not placeholders
CURRENT_JWT=$(grep "^JWT_SECRET" .env 2>/dev/null | head -1 | cut -d'"' -f2)
CURRENT_ENC=$(grep "^ENCRYPTION_KEY" .env 2>/dev/null | head -1 | cut -d'"' -f2)

NEEDS_JWT=false
NEEDS_ENC=false

# Check if JWT_SECRET needs to be generated
if [ -z "$CURRENT_JWT" ] || echo "$CURRENT_JWT" | grep -qiE "your|change|placeholder|example"; then
    NEEDS_JWT=true
fi

# Check if ENCRYPTION_KEY needs to be generated
if [ -z "$CURRENT_ENC" ] || echo "$CURRENT_ENC" | grep -qiE "your|change|placeholder|example"; then
    NEEDS_ENC=true
fi

if [ "$NEEDS_JWT" = true ] || [ "$NEEDS_ENC" = true ]; then
    # Remove DATABASE_URL and REDIS_URL (Docker generates these automatically from POSTGRES_* vars)
    sed -i '/^DATABASE_URL/d' .env
    sed -i '/^REDIS_URL/d' .env
    # Remove any existing/corrupted entries
    sed -i '/^JWT_SECRET/d' .env
    sed -i '/^ENCRYPTION_KEY/d' .env
    sed -i 's/\(API_HOST_PORT=[0-9]*\)JWT_SECRET.*/\1/' .env
    sed -i 's/\(API_HOST_PORT=[0-9]*\)ENCRYPTION_KEY.*/\1/' .env
    
    # Generate new keys
    NEW_JWT_SECRET=$(openssl rand -base64 32)
    NEW_ENCRYPTION_KEY=$(openssl rand -hex 32)
    
    echo "JWT_SECRET=\"${NEW_JWT_SECRET}\"" >> .env
    echo "ENCRYPTION_KEY=\"${NEW_ENCRYPTION_KEY}\"" >> .env
    
    echo -e "  ${GREEN}✅ Chaves de segurança geradas${NC}"
    echo ""
    echo -e "  ${BLUE}📋 Suas chaves de segurança:${NC}"
    echo -e "  JWT_SECRET:     ${NEW_JWT_SECRET}"
    echo -e "  ENCRYPTION_KEY: ${NEW_ENCRYPTION_KEY}"
    echo ""
    echo -e "  ${YELLOW}⚠️  Guarde essas chaves em local seguro!${NC}"
else
    echo -e "  ${GREEN}✅ Chaves de segurança já configuradas${NC}"
fi

# ============================================
# [8/8] Start Docker containers and configure DB
# ============================================
echo ""
echo -e "[8/8] Iniciando containers e configurando banco de dados..."

cd docker
$COMPOSE_CMD up -d
cd ..
echo -e "  ${GREEN}✅ Containers Docker iniciados${NC}"

# Wait for PostgreSQL
echo ""
echo "Aguardando PostgreSQL ficar pronto..."
counter=0
while ! docker exec ai-server-postgres pg_isready -U postgres &> /dev/null; do
    counter=$((counter + 1))
    if [ $counter -ge 30 ]; then
        echo -e "  ${RED}❌ Timeout aguardando PostgreSQL${NC}"
        exit 1
    fi
    sleep 1
    echo -n "."
done
echo ""
echo -e "  ${GREEN}✅ PostgreSQL pronto!${NC}"

# Configure Prisma
echo ""
echo "Configurando banco de dados..."

# Load environment variables from .env file
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
    echo -e "  ${GREEN}✅ Variáveis de ambiente carregadas${NC}"
fi

# Run Prisma commands with loaded environment
pnpm db:generate || echo -e "  ${YELLOW}⚠️  Aviso: Falha ao gerar cliente Prisma${NC}"
pnpm db:push || echo -e "  ${YELLOW}⚠️  Aviso: Falha ao sincronizar schema do banco${NC}"
echo -e "  ${GREEN}✅ Banco de dados configurado${NC}"

# ============================================
# Summary
# ============================================
echo ""
echo "===================================================="
echo -e " ${GREEN}✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
echo "===================================================="
echo ""
echo " Componentes instalados:"
echo "   - Node.js: $NODE_VERSION"
echo "   - pnpm: v$PNPM_VERSION"
echo "   - Docker: v$DOCKER_VERSION"
echo "   - Docker Compose"
echo "   - PostgreSQL (container)"
echo "   - Redis (container)"
echo ""
echo " Próximos passos:"
echo "   1. Edite o arquivo .env com suas chaves de API"
echo "   2. Execute ./scripts/linux/start.sh para iniciar o projeto"
echo ""
echo " URLs:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:3001"
echo "   - API Docs: http://localhost:3001/api/docs"
echo ""

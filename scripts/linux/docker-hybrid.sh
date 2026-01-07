#!/bin/bash

# ============================================
# AI Server Admin - Smart Docker Scaling
# Detecção automática de serviços híbridos
# ============================================
# Este módulo detecta automaticamente quais serviços
# são remotos e quais são locais, permitindo subir
# no Docker apenas o que for necessário.

# Colors (caso não estejam definidas)
RED=${RED:-'\033[0;31m'}
GREEN=${GREEN:-'\033[0;32m'}
YELLOW=${YELLOW:-'\033[1;33m'}
BLUE=${BLUE:-'\033[0;34m'}
CYAN=${CYAN:-'\033[0;36m'}
BOLD=${BOLD:-'\033[1m'}
NC=${NC:-'\033[0m'}

# ============================================
# FUNÇÕES DE DETECÇÃO
# ============================================

# Verifica se uma URL aponta para um serviço remoto
# Retorna 0 (true) se for remoto, 1 (false) se for local
is_remote_url() {
    local url="$1"
    
    # Se a URL estiver vazia, não é remota (usará Docker local)
    if [ -z "$url" ]; then
        return 1
    fi
    
    # Extrai o hostname da URL
    # Suporta formatos: protocol://user:pass@host:port/path
    local host=$(echo "$url" | sed -E 's|.*://([^@]*@)?([^:/]+).*|\2|')
    
    # Converte para lowercase para comparação
    host=$(echo "$host" | tr '[:upper:]' '[:lower:]')
    
    # Lista de hosts que são considerados locais
    case "$host" in
        # Endereços de loopback
        localhost|127.0.0.1|0.0.0.0|::1)
            return 1  # É local
            ;;
        # Host especial do Docker para acessar a máquina host
        host.docker.internal)
            return 1  # É local
            ;;
        # Nomes de containers Docker do projeto
        ai-server-*|postgres|redis|meilisearch|minio|s3)
            return 1  # É container Docker local
            ;;
        # Qualquer outro host é considerado remoto
        *)
            return 0  # É remoto
            ;;
    esac
}

# Extrai o hostname de uma URL para exibição
get_url_host() {
    local url="$1"
    
    if [ -z "$url" ]; then
        echo "-"
        return
    fi
    
    # Extrai apenas o hostname
    echo "$url" | sed -E 's|.*://([^@]*@)?([^:/]+).*|\2|'
}

# ============================================
# DETECÇÃO DE SERVIÇOS NECESSÁRIOS
# ============================================

# Carrega variáveis do .env se existir
load_env() {
    local project_dir="$1"
    
    if [ -f "$project_dir/.env" ]; then
        set -a
        source "$project_dir/.env"
        set +a
    fi
}

# Verifica se Redis precisa subir via Docker
needs_docker_redis() {
    # Se REDIS_URL estiver definido e for remoto, não precisa Docker
    if [ -n "$REDIS_URL" ] && is_remote_url "$REDIS_URL"; then
        return 1  # Não precisa Docker
    fi
    return 0  # Precisa Docker (local ou não configurado)
}

# Verifica se Database precisa subir via Docker
# (Atualmente o projeto não tem container postgres, mas mantemos para futuro)
needs_docker_database() {
    # Se DATABASE_URL estiver definido e for remoto, não precisa Docker
    if [ -n "$DATABASE_URL" ] && is_remote_url "$DATABASE_URL"; then
        return 1  # Não precisa Docker
    fi
    return 0  # Precisa Docker (local ou não configurado)
}

# Retorna lista de serviços Docker necessários
get_required_services() {
    local services=""
    
    if needs_docker_redis; then
        services="$services redis"
    fi
    
    # Adicione mais serviços aqui conforme necessário
    # if needs_docker_database; then
    #     services="$services postgres"
    # fi
    
    # Remove espaços extras
    echo "$services" | xargs
}

# ============================================
# FUNÇÕES DE EXIBIÇÃO
# ============================================

# Exibe o status de detecção híbrida
log_hybrid_status() {
    echo ""
    echo -e " ${BOLD}🔍 MODO HÍBRIDO - DETECÇÃO DE SERVIÇOS${NC}"
    echo "----------------------------------------------------"
    echo ""
    
    # Database
    local db_host=$(get_url_host "$DATABASE_URL")
    if [ -n "$DATABASE_URL" ] && is_remote_url "$DATABASE_URL"; then
        printf "   %-14s %s %s\n" "Database:" "🌐 Remoto" "($db_host)"
    else
        printf "   %-14s %s\n" "Database:" "🐳 Local (Docker)"
    fi
    
    # Redis
    local redis_host=$(get_url_host "$REDIS_URL")
    if [ -n "$REDIS_URL" ] && is_remote_url "$REDIS_URL"; then
        printf "   %-14s %s %s\n" "Redis:" "🌐 Remoto" "($redis_host)"
    else
        printf "   %-14s %s\n" "Redis:" "🐳 Local (Docker)"
    fi
    
    echo ""
}

# Exibe resumo dos containers necessários
log_required_containers() {
    local services=$(get_required_services)
    
    echo -e " ${BOLD}📦 CONTAINERS DOCKER NECESSÁRIOS${NC}"
    echo "----------------------------------------------------"
    
    if [ -z "$services" ]; then
        echo -e "   ${GREEN}Nenhum (todos os serviços são remotos)${NC}"
    else
        for svc in $services; do
            echo "   • $svc"
        done
    fi
    
    echo ""
}

# ============================================
# FUNÇÕES DE DOCKER COMPOSE
# ============================================

# Executa docker-compose apenas com os serviços necessários
compose_up_hybrid() {
    local compose_cmd="$1"
    local project_dir="$2"
    local services=$(get_required_services)
    
    cd "$project_dir/docker"
    
    if [ -z "$services" ]; then
        echo -e "  ${GREEN}✅ Nenhum container Docker necessário${NC}"
        echo "     Todos os serviços estão configurados como remotos."
        cd "$project_dir"
        return 0
    fi
    
    # Para containers existentes primeiro
    $compose_cmd --env-file ../.env down 2>/dev/null
    
    # Sobe apenas os serviços necessários
    $compose_cmd --env-file ../.env up -d $services
    local result=$?
    
    cd "$project_dir"
    return $result
}

# Para apenas os containers que estão rodando
compose_down_hybrid() {
    local compose_cmd="$1"
    local project_dir="$2"
    
    cd "$project_dir/docker"
    $compose_cmd --env-file ../.env down 2>/dev/null
    cd "$project_dir"
}

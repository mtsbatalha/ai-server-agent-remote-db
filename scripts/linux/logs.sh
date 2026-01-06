#!/bin/bash

# ============================================
# AI Server Admin - Logs Script
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

cd "$PROJECT_DIR"

echo ""
echo "===================================================="
echo " 🖥️  AI SERVER ADMIN - LOGS"
echo "===================================================="
echo ""
echo " Selecione qual log deseja visualizar:"
echo ""
echo "   [1] PostgreSQL (Docker)"
echo "   [2] Redis (Docker)"
echo "   [3] Todos os containers"
echo "   [4] Seguir todos os logs em tempo real"
echo "   [0] Sair"
echo ""

read -p " Opção: " choice

case $choice in
    1)
        echo ""
        echo "===================================================="
        echo " 📜 LOGS - PostgreSQL"
        echo "===================================================="
        echo ""
        docker logs ai-server-postgres --tail 100
        ;;
    2)
        echo ""
        echo "===================================================="
        echo " 📜 LOGS - Redis"
        echo "===================================================="
        echo ""
        docker logs ai-server-redis --tail 100
        ;;
    3)
        echo ""
        echo "===================================================="
        echo " 📜 LOGS - Todos os Containers"
        echo "===================================================="
        echo ""
        echo "[PostgreSQL]"
        echo "============"
        docker logs ai-server-postgres --tail 30
        echo ""
        echo "[Redis]"
        echo "======="
        docker logs ai-server-redis --tail 30
        ;;
    4)
        echo ""
        echo "===================================================="
        echo " 📜 LOGS EM TEMPO REAL (Ctrl+C para sair)"
        echo "===================================================="
        echo ""
        cd docker
        docker-compose logs -f
        cd ..
        ;;
    0)
        exit 0
        ;;
    *)
        echo "Opção inválida!"
        ;;
esac

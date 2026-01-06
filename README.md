# 🖥️ AI Server Admin

> Plataforma de administração de servidores Linux com Inteligência Artificial

Execute tarefas administrativas complexas usando **linguagem natural**. A IA entende, planeja, valida e executa comandos com segurança.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=nextdotjs&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat&logo=nestjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)

## ✨ Features

- 🤖 **IA Multi-Agent** - Agentes especializados para planejamento, segurança, comandos e análise
- 🔐 **Segurança Total** - Validação de comandos, auditoria completa, criptografia AES-256-GCM
- 🌐 **Dashboard Moderno** - Interface intuitiva com tema dark e logs em tempo real
- 👥 **Multiusuários** - Sistema de permissões RBAC (Admin, User, Read-Only)
- 📡 **Execução em Tempo Real** - WebSocket para streaming de logs e comandos

## 🚀 Quick Start

### Pré-requisitos

- Node.js 18+
- pnpm 8+
- Docker (para PostgreSQL e Redis)
- OpenAI API Key (ou Gemini/Groq/Ollama grátis!)

### 1. Clonar e Instalar

```bash
cd ai-server
pnpm install
```

### 2. Configurar Ambiente

```bash
cp .env.example .env
# Edite o .env com suas configurações
```

Variáveis importantes:
- `OPENAI_API_KEY` - Sua chave da OpenAI (ou use Gemini/Groq/Ollama grátis)
- `JWT_SECRET` - Chave secreta para tokens JWT
- `ENCRYPTION_KEY` - Chave de 32+ caracteres para criptografia

### 3. Iniciar Banco de Dados

```bash
pnpm docker:dev
```

### 4. Configurar Prisma

```bash
pnpm db:generate
pnpm db:push
```

### 5. Iniciar Desenvolvimento

```bash
pnpm dev
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Docs**: http://localhost:3001/api/docs

## 🐳 Instalação via Docker (Recomendado)

O projeto pode ser executado totalmente via Docker, incluindo API, Web, PostgreSQL e Redis.

### Instalação Completa (Produção)

```bash
# 1. Copiar e configurar variáveis de ambiente
cp .env.example .env

# 2. Build e start de todos os containers
pnpm docker:build
pnpm docker:up

# 3. Acompanhar logs
pnpm docker:logs
```

### Comandos Docker

| Comando | Descrição |
|---------|-----------|
| `pnpm docker:dev` | Inicia apenas Postgres e Redis (para desenvolvimento) |
| `pnpm docker:dev:down` | Para containers de desenvolvimento |
| `pnpm docker:build` | Build de todas as imagens |
| `pnpm docker:up` | Inicia todos os containers (produção) |
| `pnpm docker:down` | Para todos os containers |
| `pnpm docker:logs` | Visualiza logs em tempo real |
| `pnpm docker:ps` | Status dos containers |

### Fallback de Portas

O projeto possui **fallback automático de portas**. Se a porta padrão estiver em uso:

- **API**: Tenta 3001, 3002, 3003... (até 10 tentativas)
- **Web**: Tenta 3000, 3001, 3002... (até 10 tentativas)

Para usar com fallback de porta em desenvolvimento:

```bash
pnpm dev:fallback
```

## 🛠️ Scripts de Gerenciamento

Scripts para facilitar o gerenciamento do projeto, disponíveis para Windows e Linux:

| Script | Descrição |
|--------|-----------|
| `install` | Instala dependências, configura ambiente e banco de dados |
| `start` | Inicia todos os serviços (Docker + Dev servers) |
| `stop` | Para todos os serviços |
| `restart` | Reinicia todos os serviços |
| `status` | Mostra status detalhado dos serviços, portas, PIDs e logs |
| `logs` | Visualizador interativo de logs dos containers |
| `uninstall` | Remove completamente o projeto (containers, volumes, node_modules) |

### Windows

```powershell
# Primeira instalação
scripts\windows\install.bat

# Iniciar projeto
scripts\windows\start.bat

# Ver status dos serviços
scripts\windows\status.bat

# Parar tudo
scripts\windows\stop.bat
```

### Linux/macOS

```bash
# Dar permissão de execução (apenas primeira vez)
chmod +x scripts/linux/*.sh

# Primeira instalação
./scripts/linux/install.sh

# Iniciar projeto
./scripts/linux/start.sh

# Ver status dos serviços
./scripts/linux/status.sh

# Parar tudo
./scripts/linux/stop.sh
```

## 📁 Estrutura do Projeto

```
ai-server/
├── apps/
│   ├── web/              # Frontend Next.js
│   └── api/              # Backend NestJS
├── docker/               # Docker Compose
├── prisma/               # Schema do banco
├── scripts/              # Scripts de gerenciamento
│   ├── windows/          # Scripts para Windows (.bat)
│   │   ├── install.bat
│   │   ├── start.bat
│   │   ├── stop.bat
│   │   ├── restart.bat
│   │   ├── status.bat
│   │   └── logs.bat
│   └── linux/            # Scripts para Linux/macOS (.sh)
│       ├── install.sh
│       ├── start.sh
│       ├── stop.sh
│       ├── restart.sh
│       ├── status.sh
│       └── logs.sh
└── package.json          # Monorepo config
```

## 🏗️ Arquitetura

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│  PostgreSQL │
│   Next.js   │◀────│   NestJS    │────▶│    Redis    │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────▼──────┐
                    │  AI Engine  │
                    │   OpenAI    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ SSH Engine  │
                    │  node-ssh   │
                    └─────────────┘
```

## 🧠 Sistema Multi-Agent

1. **Planner Agent** - Analisa o prompt e cria plano de execução
2. **Security Agent** - Valida comandos e identifica riscos
3. **Command Agent** - Gera comandos shell seguros
4. **Result Agent** - Interpreta saída e sugere próximos passos

## 🔐 Segurança

- ✅ Criptografia AES-256-GCM para credenciais SSH
- ✅ Blacklist de comandos perigosos (`rm -rf /`, `mkfs`, etc.)
- ✅ Validação em duas camadas (regex + IA)
- ✅ Confirmação obrigatória para comandos de risco
- ✅ Auditoria completa de todas as ações
- ✅ RBAC com 3 níveis de permissão

## 📝 Exemplo de Uso

```
Você: "Instale o Nginx, configure SSL com Let's Encrypt e abra a porta 443"

IA: 📋 Plano de Execução
    
    Objetivo: Instalar e configurar Nginx com SSL
    
    Passos:
    1. Atualizar repositórios
    2. Instalar Nginx
    3. Instalar Certbot
    4. Configurar certificado SSL
    5. Configurar firewall
    
    Comandos:
    $ apt update && apt install -y nginx
    $ apt install -y certbot python3-certbot-nginx
    $ certbot --nginx -d seu-dominio.com
    $ ufw allow 443/tcp
    
    ⚠️ Nível de risco: MEDIUM
    
    [Cancelar] [Executar]
```

## 🛣️ Roadmap

- [x] MVP - Chat, Servidores, Execução
- [ ] Templates de configuração
- [ ] Sistema de rollback
- [ ] Agendamentos (cron via IA)
- [ ] Multi-servidores simultâneos
- [ ] Diagnóstico automático
- [ ] Integração com Cloud (AWS, GCP, Azure)

## 📄 Licença

MIT License

---

Desenvolvido com ❤️ e IA

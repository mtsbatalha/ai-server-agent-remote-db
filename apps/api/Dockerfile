# Build stage - Install dependencies and build
FROM node:20-alpine AS builder

# Install OpenSSL and libc for Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy all project files
COPY . .

# Remove pnpm files and node_modules to use npm cleanly
RUN rm -rf node_modules apps/*/node_modules pnpm-lock.yaml pnpm-workspace.yaml .pnpm 2>/dev/null || true

# Install dependencies using npm
WORKDIR /app/apps/api
RUN npm install --legacy-peer-deps

# Generate Prisma Client using the local binary
RUN ./node_modules/.bin/prisma generate --schema=../../prisma/schema.prisma

# Build NestJS
RUN npm run build

# Runner stage - Production image
FROM node:20-alpine AS runner

# Install OpenSSL for Prisma runtime
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy built application and dependencies
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/apps/api/docker-entrypoint.sh ./docker-entrypoint.sh

# Make entrypoint executable
RUN chmod +x ./docker-entrypoint.sh

# Set environment
ENV NODE_ENV=production
ENV API_PORT=3001

# Expose port range for fallback
EXPOSE 3001-3010

USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${API_PORT}/api/health || exit 1

# Use entrypoint script to run migrations before starting
ENTRYPOINT ["./docker-entrypoint.sh"]


# Build stage - Install dependencies and build
FROM node:20-alpine AS builder

# Install OpenSSL and libc
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy all project files
COPY . .

# Remove pnpm files to use npm cleanly
RUN rm -rf node_modules apps/*/node_modules pnpm-lock.yaml pnpm-workspace.yaml .pnpm 2>/dev/null || true

# Install dependencies using npm
WORKDIR /app/apps/web
RUN npm install --legacy-peer-deps

# Build argument for API port (passed from docker-compose)
ARG API_PORT=3003

# Set Next.js build environment - NEXT_PUBLIC vars must be set BEFORE build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# API URL for internal Docker communication
ENV NEXT_PUBLIC_API_URL=http://api:3001
# API port for browser WebSocket connections (browser uses window.location.hostname + this port)
ENV NEXT_PUBLIC_API_PORT=${API_PORT}

# Build
RUN npm run build

# Runner stage - Production image
FROM node:20-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built files - standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/apps/web/public ./public

# Re-declare build arg (ARGs don't carry between stages)
ARG API_PORT=3003

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# API URL for internal Docker communication
ENV NEXT_PUBLIC_API_URL=http://api:3001
# API port for browser WebSocket connections (baked in at build time, this is just for documentation)
ENV NEXT_PUBLIC_API_PORT=${API_PORT}

# Expose port range for fallback
EXPOSE 3000-3009

USER nextjs

# Health check - use 127.0.0.1 instead of localhost (Alpine resolves localhost to IPv6)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]

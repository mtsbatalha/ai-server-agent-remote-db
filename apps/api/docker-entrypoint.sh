#!/bin/sh
set -e

echo "🔄 Waiting for PostgreSQL to be ready..."

# Extract host from DATABASE_URL
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')

# Wait for PostgreSQL to be available (max 30 seconds)
for i in $(seq 1 30); do
    if nc -z "$DB_HOST" 5432 2>/dev/null; then
        echo "✅ PostgreSQL is ready!"
        break
    fi
    echo "   Waiting for PostgreSQL... ($i/30)"
    sleep 1
done

# Debug: Show masked DATABASE_URL
echo "📊 DATABASE_URL: $(echo "$DATABASE_URL" | sed 's/:\/\/[^:]*:[^@]*@/:\/\/***:***@/')"

echo "🔄 Syncing database schema with Prisma..."
npx prisma db push --schema=/app/prisma/schema.prisma --accept-data-loss

echo "✅ Database sync complete. Starting API..."
exec node dist/main.js

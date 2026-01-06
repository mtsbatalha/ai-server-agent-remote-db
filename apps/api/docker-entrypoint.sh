#!/bin/sh
set -e

# Syncing database schema with Prisma safely
echo "🔄 Checking database connection and syncing schema..."
# We try to push the schema. If the DB is not ready, it will fail here with a clear message.
npx prisma db push --schema=/app/prisma/schema.prisma --accept-data-loss || echo "⚠️ Warning: Could not sync database schema. The API will still attempt to start."

# Debug: Show masked DATABASE_URL
echo "📊 DATABASE_URL: $(echo "$DATABASE_URL" | sed 's/:\/\/[^:]*:[^@]*@/:\/\/***:***@/')"

echo "🔄 Syncing database schema with Prisma..."
npx prisma db push --schema=/app/prisma/schema.prisma --accept-data-loss

echo "✅ Database sync complete. Starting API..."
exec node dist/main.js

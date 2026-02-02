#!/bin/sh
# Run database migrations
# Usage: ./scripts/migrate.sh
# In Docker: docker compose exec app sh -c "./scripts/migrate.sh"

set -e

echo "Running database migrations..."
npx drizzle-kit push

echo "✓ Migrations completed"

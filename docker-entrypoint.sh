#!/bin/sh
set -e

echo "Running database migrations..."
npx tsx scripts/migrate.ts

exec "$@"

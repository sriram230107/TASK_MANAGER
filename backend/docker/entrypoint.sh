#!/bin/sh
set -e

# Prefer real migrations. If the project has none yet (first install, before
# `npm run db:baseline` was run and committed), create the schema directly.
if [ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
    echo "Applying database migrations..."
    npx prisma migrate deploy
else
    echo "No migrations found - creating the schema with 'prisma db push' (first install only)."
    echo "Run 'npm run db:baseline' and commit prisma/migrations to switch to versioned migrations."
    npx prisma db push --skip-generate
fi

exec node dist/server.js

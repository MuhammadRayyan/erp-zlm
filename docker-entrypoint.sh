#!/bin/sh
set -e

echo "Applying database migrations..."
npx prisma@6 db push

echo "Starting application..."
exec "$@"

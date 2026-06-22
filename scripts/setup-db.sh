#!/usr/bin/env bash
# Bootstrap PostgreSQL for local development and tests.
# Idempotent: safe to run repeatedly. Starts the cluster, ensures the `app`
# role and the `epub` / `epub_test` databases exist, then applies migrations.
set -euo pipefail

PG_USER="${PG_APP_USER:-app}"
PG_PASS="${PG_APP_PASSWORD:-app}"
DEV_DB="${PG_DEV_DB:-epub}"
TEST_DB="${PG_TEST_DB:-epub_test}"

echo "→ Ensuring PostgreSQL is running…"
if command -v pg_ctlcluster >/dev/null 2>&1; then
  pg_ctlcluster 16 main start 2>/dev/null || service postgresql start 2>/dev/null || true
fi

# Wait for the server to accept connections.
for _ in $(seq 1 20); do
  if pg_isready >/dev/null 2>&1; then break; fi
  sleep 1
done

run_sql() { su postgres -c "psql -tAc \"$1\"" 2>/dev/null || true; }

echo "→ Ensuring role '${PG_USER}' exists…"
if [ -z "$(run_sql "SELECT 1 FROM pg_roles WHERE rolname='${PG_USER}'")" ]; then
  run_sql "CREATE ROLE ${PG_USER} WITH LOGIN PASSWORD '${PG_PASS}' SUPERUSER;"
fi

for db in "$DEV_DB" "$TEST_DB"; do
  echo "→ Ensuring database '${db}' exists…"
  if [ -z "$(run_sql "SELECT 1 FROM pg_database WHERE datname='${db}'")" ]; then
    run_sql "CREATE DATABASE ${db} OWNER ${PG_USER};"
  fi
done

echo "→ Applying migrations to '${DEV_DB}'…"
DATABASE_URL="postgresql://${PG_USER}:${PG_PASS}@127.0.0.1:5432/${DEV_DB}?schema=public" \
  pnpm prisma migrate deploy >/dev/null

echo "✓ Database ready (dev: ${DEV_DB}, test: ${TEST_DB})."

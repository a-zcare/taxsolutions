#!/usr/bin/env bash
set -euo pipefail
: "${RESTORE_DATABASE:?A fresh isolated database is required}"
[[ "$RESTORE_DATABASE" == *_restore_test ]] || { echo 'Refusing a non-test restore target' >&2; exit 1; }
# PGHOST/PGUSER/PGPASSWORD point at the isolated target server, not production.
restic dump latest database.dump | pg_restore --dbname="$RESTORE_DATABASE" --no-owner --no-acl --exit-on-error
psql --dbname="$RESTORE_DATABASE" -X -v ON_ERROR_STOP=1 -c "SELECT count(*) AS tables FROM information_schema.tables WHERE table_schema='public';"

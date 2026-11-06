#!/bin/sh
set -eu
psql -Xq -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv app_password DB_APP_PASSWORD
\getenv migration_password DB_MIGRATION_PASSWORD
\getenv backup_password DB_BACKUP_PASSWORD
CREATE ROLE tax_app LOGIN PASSWORD :'app_password';
CREATE ROLE tax_migrator LOGIN PASSWORD :'migration_password';
CREATE ROLE tax_backup LOGIN PASSWORD :'backup_password';
ALTER DATABASE taxsolutions OWNER TO tax_migrator;
ALTER SCHEMA public OWNER TO tax_migrator;
GRANT CONNECT ON DATABASE taxsolutions TO tax_app,tax_backup;
GRANT USAGE ON SCHEMA public TO tax_app,tax_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE tax_migrator IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO tax_app;
ALTER DEFAULT PRIVILEGES FOR ROLE tax_migrator IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO tax_app;
ALTER DEFAULT PRIVILEGES FOR ROLE tax_migrator IN SCHEMA public GRANT SELECT ON TABLES TO tax_backup;
CREATE EXTENSION IF NOT EXISTS btree_gist;
SQL

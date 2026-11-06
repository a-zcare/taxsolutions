#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${RESTIC_REPOSITORY:?Configure an encrypted off-host repository}"
: "${RESTIC_PASSWORD:?Configure an independent backup secret}"
case "$RESTIC_REPOSITORY" in
  sftp:*|s3:https://*) ;;
  *) [[ "${APP_ENV:-}" == test && "${BACKUP_ALLOW_LOCAL_TEST:-}" == true ]] || { echo 'Off-host repository required' >&2; exit 1; } ;;
esac
# SSH keys and pinned known_hosts must already exist. Never disable host checking.
restic snapshots --json >/dev/null
result=$(mktemp)
trap 'rm -f "$result"' EXIT
pg_dump --format=custom --no-owner --no-acl | restic backup --stdin --stdin-filename database.dump --json > "$result"
snapshot=$(jq -r 'select(.message_type=="summary") | .snapshot_id' "$result")
[[ "$snapshot" =~ ^[a-f0-9]{8,64}$ ]] || exit 1
restic check
mkdir -p /ops-state
jq -n --arg snapshot "$snapshot" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{snapshot:$snapshot,at:$at}' > /ops-state/backup-receipt.json
echo "Encrypted backup verified; snapshot $snapshot"
# Retention deletion is deliberately a separate operator-reviewed operation.

import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
const connection = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});
await connection.connect();
const existing = await connection.query(
  "SELECT to_regclass('public._prisma_migrations') AS present",
);
if (existing.rows[0].present) {
  if (process.env.MIGRATION_APPROVED !== 'true')
    throw Error(
      'Explicit MIGRATION_APPROVED=true required for existing databases',
    );
  const receipt = JSON.parse(
    await readFile('/ops-state/backup-receipt.json', 'utf8'),
  ) as { snapshot: string; at: string };
  if (
    !/^[a-f0-9]{8,64}$/.test(receipt.snapshot) ||
    !Number.isFinite(Date.parse(receipt.at)) ||
    Date.parse(receipt.at) > Date.now() ||
    Date.now() - Date.parse(receipt.at) > 86400000
  )
    throw Error('A successful backup within 24 hours is required');
}
for (const script of ['db:migrate', 'db:seed']) {
  const r = spawnSync('npm', ['run', script], {
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status) process.exit(r.status);
}
await connection.query(
  'REVOKE ALL ON TABLE "_prisma_migrations" FROM tax_app; REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "AuditEvent" FROM tax_app',
);
await connection.end();
console.log('Migrations and least-privilege grants complete.');

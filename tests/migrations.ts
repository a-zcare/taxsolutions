import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
if (
  process.env.APP_ENV !== 'test' ||
  !process.env.TEST_DATABASE_URL?.includes('taxsolutions_test')
)
  throw Error('Isolated test database configuration required');
const adminUrl = new URL(process.env.TEST_DATABASE_URL);
adminUrl.pathname = '/postgres';
const admin = new pg.Client({ connectionString: adminUrl.href });
await admin.connect();
const name =
  'taxsolutions_upgrade_' + randomUUID().replaceAll('-', '') + '_test';
await admin.query(`CREATE DATABASE "${name}"`);
const target = new URL(adminUrl);
target.pathname = '/' + name;
const client = new pg.Client({ connectionString: target.href });
await client.connect();
try {
  await client.query(
    await readFile(
      'prisma/migrations/20261105000000_init/migration.sql',
      'utf8',
    ),
  );
  const id = randomUUID();
  await client.query(
    'INSERT INTO "Service" (id,translations,price,"priceType") VALUES ($1,$2,1000,$3)',
    ['migration-test', '{}', 'FIXED'],
  );
  await client.query(
    'INSERT INTO "Booking" (id,"serviceId",start,"end",name,email,phone,comment,locale,"tokenHash") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [
      id,
      'migration-test',
      '2027-01-04T10:00Z',
      '2027-01-04T11:00Z',
      'Synthetic retained client',
      'migration@example.invalid',
      '+37120000000',
      'Synthetic retained comment',
      'en',
      randomUUID(),
    ],
  );
  await client.query(
    await readFile(
      'prisma/migrations/20261106000000_platform_v2/migration.sql',
      'utf8',
    ),
  );
  const row = (await client.query('SELECT * FROM "Booking" WHERE id=$1', [id]))
    .rows[0];
  assert.equal(row.name, 'Synthetic retained client');
  assert.equal(row.comment, 'Synthetic retained comment');
  assert.equal(row.resourceId, 'default');
  assert.equal(row.start.getTime(), row.blockedStart.getTime());
  assert.equal(row.end.getTime(), row.blockedEnd.getTime());
  assert.equal(
    (await client.query('SELECT count(*) FROM "Staff"')).rows[0].count,
    '0',
  );
  console.log(
    'PASS V1 → V2 migration preserves existing appointment data and safely backfills resource ranges',
  );
} finally {
  await client.end();
  await admin.query(`DROP DATABASE "${name}"`);
  await admin.end();
}

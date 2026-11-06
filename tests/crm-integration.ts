// Synthetic records are retained in the isolated test database; no existing records are deleted.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
if (!process.env.TEST_DATABASE_URL) throw Error('TEST_DATABASE_URL required');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const { requireTestDatabase, prepareTestOwner } = await import('./fixtures');
requireTestDatabase();
const { db } = await import('../src/lib/db');
const { workspaceData, workspaceAction } =
  await import('../src/lib/v2/workspace');
const { seal } = await import('../src/lib/v2/crypto');
const ownerId = await prepareTestOwner();
const owner = await db.staff.findUniqueOrThrow({ where: { id: ownerId } });
const suffix = randomUUID();
const actors = [];
for (const name of ['A', 'B']) {
  const id = randomUUID();
  actors.push(
    await db.staff.create({
      data: {
        id,
        email: `crm-${name.toLowerCase()}-${suffix}@example.invalid`,
        name: `Synthetic ${name}`,
        role: 'ACCOUNTANT',
        passwordHash: 'unusable-test-value',
        totpCiphertext: seal('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', `totp:${id}`),
      },
    }),
  );
}
const [a, b] = actors;
const service = await db.service.create({
  data: {
    id: `crm-${suffix}`,
    translations: {
      lv: { name: 'Tests' },
      en: { name: 'Synthetic service' },
      ru: { name: 'Тест' },
    },
    price: 1000,
    priceType: 'FIXED',
    duration: 60,
  },
});
const bookingIds: string[] = [];
for (const [staff, start, end] of [
  [a, '2027-01-03T21:00Z', '2027-01-03T22:30Z'],
  [a, '2027-01-04T07:00Z', '2027-01-04T08:00Z'],
  [b, '2027-01-04T07:00Z', '2027-01-04T08:00Z'],
] as const) {
  const r = await db.booking.create({
    data: {
      serviceId: service.id,
      staffId: staff.id,
      resourceId: `staff:${staff.id}`,
      start: new Date(start),
      end: new Date(end),
      name: 'Synthetic calendar client',
      email: `calendar-${suffix}@example.invalid`,
      phone: '',
      comment: 'Synthetic note',
      locale: 'en',
      tokenHash: randomUUID(),
    },
  });
  bookingIds.push(r.id);
}
const client = await workspaceAction(owner, 'client', {
  name: 'Synthetic CRM Client',
  email: `client-${suffix}@example.invalid`,
  phone: '',
  locale: 'en',
  status: 'ACTIVE',
  ownerId: a.id,
});
const task = await workspaceAction(owner, 'task', {
  title: 'Synthetic midnight deadline',
  dueAt: '2027-01-03T22:00:00.000Z',
  assignedId: a.id,
  clientId: client.id,
  bookingId: null,
});
const result = await workspaceData(
  a,
  new URLSearchParams({
    view: 'calendar',
    date: '2027-01-04',
    mode: 'day',
    kind: 'bookings',
  }),
);
assert('items' in result);
const json = JSON.parse(JSON.stringify(result));
assert.equal(json.items.length, 2);
assert(
  json.items.some((r: { id: string }) => r.id === bookingIds[0]),
  'cross-midnight event must be visible',
);
assert(
  !json.items.some((r: { id: string }) => r.id === bookingIds[2]),
  'other staff record must be hidden',
);
assert(!JSON.stringify(json).match(/tokenHash|Ciphertext|passwordHash/));
assert.equal(json.start, '2027-01-03T22:00:00.000Z');
assert.equal(json.timezone, 'Europe/Riga');
await assert.rejects(
  workspaceData(
    a,
    new URLSearchParams({
      view: 'calendar',
      date: '2027-01-04',
      staffId: b.id,
      kind: 'bookings',
    }),
  ),
  /FORBIDDEN/,
);
await assert.rejects(
  workspaceData(
    a,
    new URLSearchParams({ view: 'calendar', date: '2027-01-04', mode: 'year' }),
  ),
);
await assert.rejects(
  workspaceData(
    a,
    new URLSearchParams({
      view: 'calendar',
      date: '2027-01-04',
      status: 'INJECT',
    }),
  ),
);
const tasks = JSON.parse(
  JSON.stringify(
    await workspaceData(
      a,
      new URLSearchParams({
        view: 'calendar',
        date: '2027-01-04',
        mode: 'day',
        kind: 'tasks',
      }),
    ),
  ),
);
assert(tasks.items.some((r: { id: string }) => r.id === task.id));
await assert.rejects(
  workspaceAction(b, 'taskStatus', { id: task.id, version: 1, status: 'DONE' }),
  /NOT_FOUND/,
);
const clients = JSON.parse(
  JSON.stringify(
    await workspaceData(
      b,
      new URLSearchParams({ view: 'clients', q: `client-${suffix}` }),
    ),
  ),
);
assert.equal(clients.items.length, 0);
const dashboard = JSON.parse(
  JSON.stringify(
    await workspaceData(a, new URLSearchParams({ view: 'dashboard' })),
  ),
);
assert.equal(
  dashboard.clients,
  await db.client.count({ where: { ownerId: a.id } }),
);
assert(
  dashboard.nextBookings.every((r: { id: string }) => r.id !== bookingIds[2]),
);
assert.equal(typeof dashboard.asOf, 'string');
await db.$disconnect();
console.log(
  'PASS CRM calendar boundaries/overlaps, scoped records, no secrets, filter validation, task IDOR and database-backed KPI; synthetic fixtures retained',
);

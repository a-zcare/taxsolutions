import assert from 'node:assert/strict';
if (!process.env.TEST_DATABASE_URL?.includes('taxsolutions_test'))
  throw Error(
    'Set TEST_DATABASE_URL to a dedicated taxsolutions_test database.',
  );
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const { db } = await import('../src/lib/db');
const { createBooking, cancelBooking } = await import('../src/lib/bookings');
const { defaultServices, defaultSchedule } =
  await import('../src/lib/defaults');
const { slotsForDay, dateInRiga } = await import('../src/lib/calendar');
const { deliverMail } = await import('../src/lib/mail');
const id = `integration-${Date.now()}`;
let passed = 0;
const check = (message: string) => {
  passed++;
  console.log(`PASS ${message}`);
};
try {
  await db.service.create({ data: { ...defaultServices[0], id } });
  const date = new Date(Date.now() + 86400000);
  while (
    !defaultSchedule.weekdays.includes(
      new Date(`${dateInRiga(date)}T12:00Z`).getUTCDay(),
    )
  )
    date.setUTCDate(date.getUTCDate() + 1);
  const available = slotsForDay(dateInRiga(date), 60, defaultSchedule, []);
  const input = {
    serviceId: id,
    start: available[0],
    name: 'Integration Test',
    email: 'test@example.invalid',
    phone: '+371 20000000',
    comment: 'Test only',
    locale: 'lv',
    consent: true,
    website: '',
  };
  const race = await Promise.allSettled(
    Array.from({ length: 8 }, () => createBooking(input)),
  );
  assert.equal(race.filter((r) => r.status === 'fulfilled').length, 1);
  check('8 concurrent requests produce exactly one appointment');
  const winner = race.find((r) => r.status === 'fulfilled');
  assert(winner?.status === 'fulfilled');
  const created = winner.value;
  assert.equal(await db.outbox.count({ where: { to: input.email } }), 1);
  check('booking and email outbox commit atomically');
  const b = await db.booking.findUniqueOrThrow({ where: { id: created.id } });
  assert.notEqual(b.tokenHash, created.cancelToken);
  assert.equal(b.tokenHash.length, 64);
  check('cancellation tokens stored as SHA-256 hashes');
  await assert.rejects(
    db.booking.create({
      data: {
        ...b,
        id: crypto.randomUUID(),
        tokenHash: crypto.randomUUID(),
        start: new Date(b.start.getTime() + 1800000),
        end: new Date(b.end.getTime() + 1800000),
      },
    }),
  );
  check('database rejects overlapping direct inserts');
  await assert.rejects(
    createBooking({
      ...input,
      start: new Date(b.start.getTime() + 1800000).toISOString(),
    }),
  );
  check('overlapping intervals rejected by booking logic');
  const { consent: _, ...withoutConsent } = input;
  await assert.rejects(createBooking(withoutConsent));
  await assert.rejects(createBooking({ ...input, website: 'spam' }));
  check('consent and honeypot validation enforced');
  await assert.rejects(cancelBooking('f'.repeat(64)));
  check('invalid cancellation token rejected');
  await cancelBooking(created.cancelToken);
  await cancelBooking(created.cancelToken);
  assert.equal(
    (await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status,
    'CANCELLED',
  );
  check('cancellation is idempotent');
  const replacement = await createBooking(input);
  check('cancelled appointment releases slot');
  const mail = await deliverMail();
  assert.equal(mail.configured, true);
  assert(mail.sent >= 3);
  assert.equal(
    await db.outbox.count({ where: { to: input.email, sentAt: null } }),
    0,
  );
  check('SMTP worker delivers queued messages through Mailpit');
  await cancelBooking(replacement.cancelToken);
  console.log(`${passed} integration checks passed.`);
} finally {
  await db.booking.deleteMany({ where: { serviceId: id } });
  await db.service.delete({ where: { id } });
  await db.outbox.deleteMany({ where: { to: 'test@example.invalid' } });
  await db.$disconnect();
}

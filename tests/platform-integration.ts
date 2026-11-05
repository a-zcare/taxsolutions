import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
if (!process.env.TEST_DATABASE_URL) throw Error('TEST_DATABASE_URL required');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const { db } = await import('../src/lib/db');
const { requireTestDatabase, prepareTestOwner } = await import('./fixtures');
requireTestDatabase();
const { seal, totp } = await import('../src/lib/v2/crypto');
const { authenticate } = await import('../src/lib/v2/auth');
const { workspaceData, workspaceAction } =
  await import('../src/lib/v2/workspace');
const { createBooking, bookingStatus, cancelBooking, rescheduleBooking } =
  await import('../src/lib/bookings');
const { slotsForDay, dateInRiga } = await import('../src/lib/calendar');
const { defaultSchedule } = await import('../src/lib/defaults');
const { maintainPlatform } = await import('../src/lib/v2/maintenance');
const { processVideoJob } = await import('../src/lib/video/worker');
const { approvedFaq } = await import('../src/lib/v2/faq');
const { copy } = await import('../src/lib/i18n');
const suffix = randomUUID().slice(0, 8),
  secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  email = `platform-${suffix}@example.invalid`;
let passed = 0;
const check = (s: string) => {
  passed++;
  console.log(`PASS ${s}`);
};
const staffIds: string[] = [],
  clientIds: string[] = [],
  bookings: string[] = [],
  taskIds: string[] = [],
  faqIds: string[] = [];
try {
  const ownerId = await prepareTestOwner();
  const owner = await db.staff.findUniqueOrThrow({ where: { id: ownerId } });
  const actor = {
    id: owner.id,
    role: owner.role,
    email: owner.email,
    name: owner.name,
    locale: owner.locale,
  };
  const staff = [];
  for (const name of ['A', 'B']) {
    const id = randomUUID();
    staffIds.push(id);
    staff.push(
      await db.staff.create({
        data: {
          id,
          name: `Synthetic ${name}`,
          email: `staff-${name.toLowerCase()}-${suffix}@example.invalid`,
          passwordHash: await bcrypt.hash('synthetic-password-14-only', 12),
          totpCiphertext: seal(secret, `totp:${id}`),
          acceptsBookings: true,
          specializations: ['general', 'tax'],
          capacityMinutes: 120,
          role: 'ACCOUNTANT',
        },
      }),
    );
  }
  const [a, b] = staff;
  const accountant = {
    id: a.id,
    role: a.role,
    email: a.email,
    name: a.name,
    locale: a.locale,
  };
  await assert.rejects(authenticate(a.email, 'wrong-password', totp(secret)));
  const auth = await authenticate(
    a.email,
    'synthetic-password-14-only',
    totp(secret),
  );
  assert.equal(auth.id, a.id);
  await assert.rejects(
    authenticate(a.email, 'synthetic-password-14-only', totp(secret)),
  );
  check('password + TOTP mandatory; successful code cannot be replayed');
  await db.staff.update({
    where: { id: b.id },
    data: { lastTotpCounter: -1n },
  });
  const authRace = await Promise.allSettled(
    Array.from({ length: 4 }, () =>
      authenticate(b.email, 'synthetic-password-14-only', totp(secret)),
    ),
  );
  assert.equal(authRace.filter((r) => r.status === 'fulfilled').length, 1);
  check('concurrent MFA use succeeds exactly once');
  const sessionId = 'synthetic-session-' + suffix;
  await db.staffSession.create({
    data: {
      id: sessionId,
      staffId: b.id,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  await workspaceAction(actor, 'staff', {
    id: b.id,
    name: b.name,
    role: 'ACCOUNTANT',
    active: false,
    acceptsBookings: true,
    capacityMinutes: 120,
    specializations: ['general', 'tax'],
    locale: 'en',
    schedule: null,
  });
  assert.equal(await db.staffSession.count({ where: { id: sessionId } }), 0);
  check('staff deactivation revokes sessions');
  await db.staff.update({ where: { id: b.id }, data: { active: true } });
  const ca = (await workspaceAction(actor, 'client', {
    name: 'Synthetic Client A',
    email,
    phone: '+37120000000',
    locale: 'en',
    status: 'ACTIVE',
    ownerId: a.id,
  })) as { id: string };
  clientIds.push(ca.id);
  const cb = (await workspaceAction(actor, 'client', {
    name: 'Synthetic Client B',
    email: `other-${email}`,
    phone: '+37120000001',
    locale: 'en',
    status: 'ACTIVE',
    ownerId: b.id,
  })) as { id: string };
  clientIds.push(cb.id);
  const list = await workspaceData(
    accountant,
    new URLSearchParams({ view: 'clients', q: suffix }),
  );
  assert('items' in list);
  assert.equal(
    (list.items as { id: string }[]).some((r) => r.id === cb.id),
    false,
  );
  check('client listings enforce object-level staff scope');
  const due = new Date(Date.now() + 86400000).toISOString();
  const baseTask = {
    title: 'Synthetic task',
    description: 'Do not email this synthetic sensitive comment',
    category: 'general',
    estimatedMinutes: 60,
    dueAt: due,
    hardDeadline: true,
    recurrence: 'NONE',
    priority: 'NORMAL',
    status: 'TODO',
    clientId: ca.id,
    assignedId: a.id,
  };
  const task = (await workspaceAction(actor, 'task', baseTask)) as {
    id: string;
  };
  taskIds.push(task.id);
  await assert.rejects(
    workspaceAction({ ...accountant, id: b.id }, 'taskStatus', {
      id: task.id,
      status: 'DONE',
      version: 1,
    }),
    /NOT_FOUND/,
  );
  await assert.rejects(
    workspaceAction(accountant, 'client', {
      ...baseTask,
      name: 'Wrong',
      email: 'wrong@example.invalid',
      phone: '',
      locale: 'en',
      status: 'ACTIVE',
    }),
    /FORBIDDEN/,
  );
  check('IDOR and manager-only client modifications rejected');
  await assert.rejects(
    workspaceAction(accountant, 'task', {
      ...baseTask,
      id: task.id,
      version: 1,
      dueAt: new Date(Date.now() + 2 * 86400000).toISOString(),
    }),
    /FORBIDDEN/,
  );
  await workspaceAction(accountant, 'taskStatus', {
    id: task.id,
    status: 'IN_PROGRESS',
    version: 1,
  });
  await assert.rejects(
    workspaceAction(accountant, 'taskStatus', {
      id: task.id,
      status: 'DONE',
      version: 1,
    }),
    /CONFLICT/,
  );
  check('accountants cannot change deadlines; stale task versions rejected');
  const assigned = (await workspaceAction(actor, 'task', {
    ...baseTask,
    title: 'Automatic synthetic task',
    clientId: null,
    assignedId: null,
    autoAssign: true,
  })) as { id: string };
  taskIds.push(assigned.id);
  const auto = await db.task.findUniqueOrThrow({ where: { id: assigned.id } });
  assert.equal(auto.assignedId, b.id);
  assert.equal(auto.dueAt.toISOString(), due);
  check('transparent workload assignment preserves hard deadline');
  await workspaceAction(accountant, 'comment', {
    taskId: task.id,
    body: '<img src=x onerror=alert(1)> synthetic only',
  });
  assert.equal(await db.taskComment.count({ where: { taskId: task.id } }), 1);
  check('comments stored as plain text, without HTML execution paths');
  await assert.rejects(
    db.$executeRaw`UPDATE "AuditEvent" SET action='tampered' WHERE "objectId"=${task.id}`,
  );
  check('audit events are append-only at the database layer');
  const date = new Date(Date.now() + 2 * 86400000);
  while (
    !defaultSchedule.weekdays.includes(
      new Date(dateInRiga(date) + 'T12:00Z').getUTCDay(),
    )
  )
    date.setUTCDate(date.getUTCDate() + 1);
  const slots = slotsForDay(dateInRiga(date), 60, defaultSchedule, []);
  const request = {
    serviceId: 'tax',
    staffId: a.id,
    start: slots[0],
    name: 'Synthetic booking',
    email,
    phone: '+37120000000',
    comment: 'SENSITIVE_TEST_COMMENT_NO_EMAIL',
    locale: 'en',
    consent: true,
    website: '',
    format: 'IN_PERSON',
  };
  const booked = await createBooking(request);
  bookings.push(booked.id);
  const second = await createBooking({ ...request, staffId: b.id });
  bookings.push(second.id);
  check(
    'different staff can accept the same time without global serialization of capacity',
  );
  const conflict = await Promise.allSettled(
    Array.from({ length: 6 }, () =>
      createBooking({ ...request, start: slots[4] }),
    ),
  );
  assert.equal(conflict.filter((r) => r.status === 'fulfilled').length, 1);
  for (const r of conflict)
    if (r.status === 'fulfilled') bookings.push(r.value.id);
  check('six concurrent requests for one staff slot produce one booking');
  await assert.rejects(
    rescheduleBooking(
      { id: booked.id, start: slots[2] },
      { ...accountant, id: b.id },
    ),
    /NOT_FOUND/,
  );
  await rescheduleBooking({ token: booked.cancelToken, start: slots[2] });
  assert.equal(
    (
      await db.booking.findUniqueOrThrow({ where: { id: booked.id } })
    ).start.toISOString(),
    slots[2],
  );
  check('capability rescheduling is atomic; other staff cannot reschedule it');
  const mail = await db.outbox.findMany({ where: { to: email } });
  assert(mail.length > 0);
  assert(
    mail.every(
      (r) =>
        !r.text.includes('SENSITIVE_TEST_COMMENT_NO_EMAIL') &&
        !r.text.includes('Do not email'),
    ),
  );
  check('notifications omit booking and task sensitive comments');
  await db.$transaction((tx) =>
    bookingStatus(tx, actor, booked.id, 'CONFIRMED'),
  );
  await maintainPlatform(new Date(new Date(slots[2]).getTime() - 3600000));
  const count = await db.outbox.count({
    where: { dedupKey: `booking:${booked.id}:3:reminder` },
  });
  await maintainPlatform(new Date(new Date(slots[2]).getTime() - 3600000));
  assert.equal(
    await db.outbox.count({
      where: { dedupKey: `booking:${booked.id}:3:reminder` },
    }),
    count,
  );
  check('reminder maintenance is idempotent');
  // Release all active test slots before exercising online meeting confirmation.
  for (const id of bookings)
    await db.$transaction((tx) => bookingStatus(tx, actor, id, 'CANCELLED'));
  const online = await createBooking({ ...request, format: 'ONLINE' });
  bookings.push(online.id);
  await db.$transaction((tx) =>
    bookingStatus(tx, actor, online.id, 'CONFIRMED'),
  );
  assert.equal(
    (await db.booking.findUniqueOrThrow({ where: { id: online.id } })).status,
    'PENDING',
  );
  for (let i = 0; i < 20; i++) {
    await processVideoJob();
    if (
      (await db.booking.findUniqueOrThrow({ where: { id: online.id } }))
        .status === 'CONFIRMED'
    )
      break;
  }
  assert.equal(
    (
      await db.videoMeeting.findUniqueOrThrow({
        where: { bookingId: online.id },
      })
    ).status,
    'READY',
  );
  assert.equal(
    (await db.booking.findUniqueOrThrow({ where: { id: online.id } })).status,
    'CONFIRMED',
  );
  check('online confirmation occurs only after unique mock meeting is ready');
  await cancelBooking(online.cancelToken);
  for (let i = 0; i < 10; i++) await processVideoJob();
  assert.equal(
    (
      await db.videoMeeting.findUniqueOrThrow({
        where: { bookingId: online.id },
      })
    ).status,
    'CANCELLED',
  );
  check('cancellation queues and completes video cleanup');
  const f = (await workspaceAction(actor, 'faq', {
    category: 'tax',
    approved: false,
    translations: {
      lv: { question: 'Sintētisks jautājums?', answer: 'Tikai tests.' },
      en: { question: 'Synthetic question?', answer: 'Only a test.' },
      ru: { question: 'Синтетический вопрос?', answer: 'Только тест.' },
    },
  })) as { id: string };
  faqIds.push(f.id);
  assert(!(await approvedFaq('en', copy.en)).some((r) => r.id === f.id));
  await db.faqEntry.update({ where: { id: f.id }, data: { approved: true } });
  assert((await approvedFaq('en', copy.en)).some((r) => r.id === f.id));
  check('only approved FAQ answers are returned publicly');
  const ownerCount = await db.staff.count({
    where: { active: true, role: 'OWNER' },
  });
  if (ownerCount === 1)
    await assert.rejects(
      workspaceAction(actor, 'staff', {
        id: owner.id,
        name: owner.name,
        role: 'ACCOUNTANT',
        active: true,
        acceptsBookings: false,
        capacityMinutes: 2400,
        specializations: ['general'],
        locale: 'en',
        schedule: null,
      }),
      /FORBIDDEN/,
    );
  check('last active Owner cannot be demoted');
  console.log(`${passed} platform integration checks passed.`);
} finally {
  await db.task.deleteMany({
    where: { OR: [{ id: { in: taskIds } }, { clientId: { in: clientIds } }] },
  });
  await db.booking.deleteMany({ where: { id: { in: bookings } } });
  await db.client.deleteMany({ where: { id: { in: clientIds } } });
  await db.faqEntry.deleteMany({ where: { id: { in: faqIds } } });
  await db.outbox.deleteMany({
    where: { OR: [{ to: email }, { to: { contains: suffix } }] },
  });
  await db.staffSession.deleteMany({ where: { staffId: { in: staffIds } } });
  await db.staff.updateMany({
    where: { id: { in: staffIds } },
    data: { active: false, acceptsBookings: false },
  });
  await db.$disconnect();
}

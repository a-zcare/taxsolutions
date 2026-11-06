import { z } from 'zod';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { randomUUID, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { newTotpSecret, seal } from './crypto';
import { hash, token } from '../security';
import type { Prisma } from '@prisma/client';
import { db } from '../db';
import { audit } from './audit';
import {
  assertManager,
  assertOwner,
  assertAssigned,
  clientScope,
  taskScope,
  bookingScope,
  manager,
  type Actor,
} from './policy';
import { chooseAssignee } from './planner';
import { notify } from './notifications';
import { bookingStatus, rescheduleBooking } from '../bookings';
import { scheduleInput } from '../validation';
import { calendarRange } from './crm-calendar';
const nullableId = z.uuid().nullable().optional();
const clientInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(120),
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  phone: z.string().trim().max(30),
  locale: z.enum(['lv', 'en', 'ru']),
  status: z.enum(['NEW', 'ACTIVE', 'CLOSED']),
  ownerId: nullableId,
});
const taskInput = z.object({
  id: z.uuid().optional(),
  version: z.number().int().optional(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).default(''),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']).default('TODO'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  category: z
    .string()
    .regex(/^[a-z0-9-]{1,80}$/)
    .default('general'),
  estimatedMinutes: z.number().int().min(15).max(2400).default(60),
  dueAt: z.iso.datetime(),
  hardDeadline: z.boolean().default(true),
  recurrence: z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']).default('NONE'),
  assignedId: nullableId,
  clientId: nullableId,
  bookingId: nullableId,
  autoAssign: z.boolean().default(false),
});
const faqInput = z.object({
  id: z.uuid().optional(),
  category: z.enum([
    'general',
    'accounting',
    'tax',
    'payroll',
    'annual',
    'registration',
  ]),
  approved: z.boolean(),
  translations: z.object(
    Object.fromEntries(
      ['lv', 'en', 'ru'].map((l) => [
        l,
        z.object({
          question: z.string().trim().min(5).max(300),
          answer: z.string().trim().min(5).max(3000),
        }),
      ]),
    ),
  ),
});
export async function workspaceData(actor: Actor, search: URLSearchParams) {
  const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .parse(search.get('page') ?? 1),
    query = z
      .string()
      .max(120)
      .parse(search.get('q') ?? ''),
    view = z
      .enum([
        'dashboard',
        'tasks',
        'clients',
        'bookings',
        'staff',
        'faq',
        'audit',
        'video',
        'inquiries',
        'calendar',
      ])
      .parse(search.get('view') ?? 'dashboard');
  const take = 50,
    skip = (page - 1) * take;
  const now = new Date();
  const today = formatInTimeZone(now, 'Europe/Riga', 'yyyy-MM-dd');
  const next = new Date(today + 'T12:00Z');
  next.setUTCDate(next.getUTCDate() + 1);
  const dayStart = fromZonedTime(today + 'T00:00:00', 'Europe/Riga'),
    dayEnd = fromZonedTime(
      next.toISOString().slice(0, 10) + 'T00:00:00',
      'Europe/Riga',
    );
  const status = search.get('status') ?? '',
    staffFilter = z
      .uuid()
      .optional()
      .parse(search.get('staffId') || undefined),
    day = z.iso
      .date()
      .optional()
      .parse(search.get('day') || undefined);
  if (staffFilter && !manager(actor) && staffFilter !== actor.id)
    throw Error('FORBIDDEN');
  let dayRange: { gte: Date; lt: Date } | undefined;
  if (day) {
    const d = new Date(day + 'T12:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    dayRange = {
      gte: fromZonedTime(day + 'T00:00:00', 'Europe/Riga'),
      lt: fromZonedTime(
        d.toISOString().slice(0, 10) + 'T00:00:00',
        'Europe/Riga',
      ),
    };
  }
  const taskWhere: Prisma.TaskWhereInput = {
    AND: [
      taskScope(actor),
      staffFilter ? { assignedId: staffFilter } : {},
      dayRange ? { dueAt: dayRange } : {},
      status === 'overdue'
        ? { status: { in: ['TODO', 'IN_PROGRESS'] }, dueAt: { lt: now } }
        : ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'].includes(status)
          ? { status }
          : {},
      query ? { title: { contains: query, mode: 'insensitive' } } : {},
    ],
  };
  const clientWhere: Prisma.ClientWhereInput = {
    AND: [
      clientScope(actor),
      ['NEW', 'ACTIVE', 'CLOSED'].includes(status) ? { status } : {},
      query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {},
    ],
  };
  const bookWhere: Prisma.BookingWhereInput = {
    AND: [
      bookingScope(actor),
      staffFilter ? { staffId: staffFilter } : {},
      dayRange ? { start: dayRange } : {},
      ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'].includes(status)
        ? { status }
        : {},
      query ? { name: { contains: query, mode: 'insensitive' } } : {},
    ],
  };
  if (view === 'dashboard') {
    const [
      newBookings,
      upcoming,
      today,
      overdue,
      clients,
      unassigned,
      failedVideo,
      failedMail,
    ] = await Promise.all([
      db.booking.count({
        where: { AND: [bookingScope(actor), { status: 'PENDING' }] },
      }),
      db.booking.count({
        where: {
          AND: [
            bookingScope(actor),
            { status: 'CONFIRMED', start: { gte: now } },
          ],
        },
      }),
      db.task.count({
        where: {
          AND: [
            taskScope(actor),
            {
              status: { in: ['TODO', 'IN_PROGRESS'] },
              dueAt: { gte: dayStart, lt: dayEnd },
            },
          ],
        },
      }),
      db.task.count({
        where: {
          AND: [
            taskScope(actor),
            { status: { in: ['TODO', 'IN_PROGRESS'] }, dueAt: { lt: now } },
          ],
        },
      }),
      db.client.count({ where: clientScope(actor) }),
      manager(actor)
        ? db.task.count({
            where: {
              assignedId: null,
              status: { in: ['TODO', 'IN_PROGRESS'] },
            },
          })
        : 0,
      db.videoJob.count({
        where: {
          booking: bookingScope(actor),
          status: { in: ['FAILED', 'NEEDS_REVIEW'] },
        },
      }),
      manager(actor)
        ? db.outbox.count({ where: { failedAt: { not: null } } })
        : 0,
    ]);
    const [nextBookings, dueTasks] = await Promise.all([
      db.booking.findMany({
        where: {
          AND: [
            bookingScope(actor),
            { start: { gte: now }, status: { in: ['PENDING', 'CONFIRMED'] } },
          ],
        },
        select: { id: true, name: true, start: true, status: true },
        orderBy: { start: 'asc' },
        take: 5,
      }),
      db.task.findMany({
        where: {
          AND: [
            taskScope(actor),
            { dueAt: { lt: dayEnd }, status: { in: ['TODO', 'IN_PROGRESS'] } },
          ],
        },
        select: { id: true, title: true, dueAt: true, status: true },
        orderBy: { dueAt: 'asc' },
        take: 5,
      }),
    ]);
    return {
      nextBookings,
      dueTasks,
      asOf: now.toISOString(),
      newBookings,
      upcoming,
      today,
      overdue,
      clients,
      unassigned,
      failedVideo,
      failedMail,
    };
  }
  if (view === 'calendar') {
    const anchor = z.iso
      .date()
      .parse(search.get('date') ?? `${search.get('month')}-01`);
    const mode = z
      .enum(['day', 'week', 'month'])
      .parse(search.get('mode') ?? 'month');
    const kind = z
      .enum(['tasks', 'bookings'])
      .parse(search.get('kind') ?? 'bookings');
    const range = calendarRange(anchor, mode);
    const staffWhere = staffFilter
      ? kind === 'tasks'
        ? { assignedId: staffFilter }
        : { staffId: staffFilter }
      : {};
    const items =
      kind === 'tasks'
        ? await db.task.findMany({
            where: {
              AND: [
                taskScope(actor),
                staffWhere,
                { dueAt: { gte: range.start, lt: range.end } },
                status
                  ? {
                      status: z
                        .enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'])
                        .parse(status),
                    }
                  : {},
              ],
            },
            select: {
              id: true,
              title: true,
              dueAt: true,
              status: true,
              priority: true,
              version: true,
              assigned: { select: { name: true } },
            },
            orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
            take: 501,
          })
        : await db.booking.findMany({
            where: {
              AND: [
                bookingScope(actor),
                staffWhere,
                { start: { lt: range.end }, end: { gt: range.start } },
                status
                  ? {
                      status: z
                        .enum([
                          'PENDING',
                          'CONFIRMED',
                          'COMPLETED',
                          'CANCELLED',
                        ])
                        .parse(status),
                    }
                  : {},
              ],
            },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              comment: true,
              start: true,
              end: true,
              status: true,
              format: true,
              version: true,
              serviceId: true,
              service: { select: { translations: true } },
              staff: { select: { name: true } },
            },
            orderBy: [{ start: 'asc' }, { id: 'asc' }],
            take: 501,
          });
    const truncated = items.length > 500;
    const visible = items.slice(0, 500);
    const dates: Record<string, number> = {};
    for (const row of visible) {
      const key = formatInTimeZone(
        'dueAt' in row ? row.dueAt : row.start,
        'Europe/Riga',
        'yyyy-MM-dd',
      );
      dates[key] = (dates[key] ?? 0) + 1;
    }
    return {
      items: visible,
      dates,
      days: range.days,
      start: range.start,
      end: range.end,
      truncated,
      timezone: 'Europe/Riga',
    };
  }
  if (view === 'inquiries') {
    const where = manager(actor) ? {} : { assignedId: actor.id };
    return {
      items: await db.inquiry.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      total: await db.inquiry.count({ where }),
      page,
    };
  }
  if (view === 'tasks') {
    const [items, total] = await Promise.all([
      db.task.findMany({
        where: taskWhere,
        orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
        take,
        skip,
        include: {
          assigned: { select: { id: true, name: true } },
          client: { select: { id: true, name: true } },
          comments: {
            take: 20,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              body: true,
              createdAt: true,
              author: { select: { name: true } },
            },
          },
        },
      }),
      db.task.count({ where: taskWhere }),
    ]);
    return { items, total, page };
  }
  if (view === 'clients') {
    const [items, total] = await Promise.all([
      db.client.findMany({
        where: clientWhere,
        take,
        skip,
        orderBy: { updatedAt: 'desc' },
      }),
      db.client.count({ where: clientWhere }),
    ]);
    return { items, total, page };
  }
  if (view === 'bookings') {
    const select = {
      id: true,
      serviceId: true,
      staffId: true,
      clientId: true,
      format: true,
      start: true,
      end: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      comment: true,
      version: true,
      meeting: { select: { provider: true, status: true } },
    };
    const [items, total] = await Promise.all([
      db.booking.findMany({
        where: bookWhere,
        select,
        take,
        skip,
        orderBy: { start: 'desc' },
      }),
      db.booking.count({ where: bookWhere }),
    ]);
    return { items, total, page };
  }
  if (view === 'staff') {
    const items = await db.staff.findMany({
      where: manager(actor) ? {} : { id: actor.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        acceptsBookings: true,
        specializations: true,
        capacityMinutes: true,
        locale: true,
        schedule: true,
      },
      orderBy: { name: 'asc' },
    });
    return { items, total: items.length, page: 1 };
  }
  if (view === 'faq') {
    const items = await db.faqEntry.findMany({
      where: manager(actor) ? {} : { approved: true },
      orderBy: { createdAt: 'asc' },
      take,
      skip,
    });
    return {
      items,
      total: await db.faqEntry.count({
        where: manager(actor) ? {} : { approved: true },
      }),
      page,
    };
  }
  if (view === 'audit') {
    assertManager(actor);
    return {
      items: await db.auditEvent.findMany({
        take,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      total: await db.auditEvent.count(),
      page,
    };
  }
  const [connections, jobs] = await Promise.all([
    db.oAuthConnection.findMany({
      where: manager(actor) ? {} : { staffId: actor.id },
      select: {
        id: true,
        staffId: true,
        provider: true,
        enabled: true,
        updatedAt: true,
      },
    }),
    db.videoJob.findMany({
      where: { booking: bookingScope(actor) },
      take,
      skip,
      select: {
        id: true,
        bookingId: true,
        provider: true,
        status: true,
        errorCode: true,
        attempts: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  return {
    connections,
    items: jobs,
    total: await db.videoJob.count({ where: { booking: bookingScope(actor) } }),
    page,
  };
}
async function checkLinks(
  tx: Prisma.TransactionClient,
  actor: Actor,
  clientId?: string | null,
  bookingId?: string | null,
) {
  if (
    clientId &&
    !(await tx.client.findFirst({
      where: { AND: [{ id: clientId }, clientScope(actor)] },
    }))
  )
    throw Error('NOT_FOUND');
  if (
    bookingId &&
    !(await tx.booking.findFirst({
      where: { AND: [{ id: bookingId }, bookingScope(actor)] },
    }))
  )
    throw Error('NOT_FOUND');
}
async function autoAssign(
  tx: Prisma.TransactionClient,
  category: string,
  minutes: number,
) {
  const staff = await tx.staff.findMany({
    where: { active: true, specializations: { has: category } },
    select: { id: true, capacityMinutes: true, specializations: true },
  });
  const tasks = await tx.task.findMany({
    where: { status: { in: ['TODO', 'IN_PROGRESS'] } },
    select: { assignedId: true, estimatedMinutes: true, dueAt: true },
  });
  return chooseAssignee(
    staff.map((s) => ({
      ...s,
      loadMinutes: tasks
        .filter((t) => t.assignedId === s.id)
        .reduce(
          (n, t) => n + t.estimatedMinutes * (t.dueAt < new Date() ? 2 : 1),
          0,
        ),
    })),
    category,
    minutes,
  );
}
export async function workspaceAction(
  actor: Actor,
  action: string,
  raw: unknown,
) {
  if (action === 'reschedule') {
    const v = z
      .object({
        id: z.uuid(),
        start: z.iso.datetime(),
        staffId: z.uuid().optional(),
      })
      .parse(raw);
    if (v.staffId) assertManager(actor);
    return rescheduleBooking(v, actor);
  }
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(740217)`;
      if (action === 'inquiry') {
        const v = z
          .object({
            id: z.uuid(),
            status: z.enum(['NEW', 'ASSIGNED', 'CLOSED']),
            assignedId: nullableId,
          })
          .parse(raw);
        const row = await tx.inquiry.findUnique({ where: { id: v.id } });
        if (!row) throw Error('NOT_FOUND');
        assertAssigned(actor, row.assignedId);
        if (!manager(actor) && v.assignedId !== row.assignedId)
          throw Error('FORBIDDEN');
        if (
          v.assignedId &&
          !(await tx.staff.findFirst({
            where: { id: v.assignedId, active: true },
          }))
        )
          throw Error('INVALID');
        await tx.inquiry.update({
          where: { id: row.id },
          data: { status: v.status, assignedId: v.assignedId },
        });
        await audit(tx, actor, 'INQUIRY_UPDATE', 'Inquiry', row.id, [
          'status',
          'assignedId',
        ]);
        return { id: row.id };
      }
      if (action === 'eraseClient') {
        assertOwner(actor);
        const v = z
          .object({ id: z.uuid(), confirmEmail: z.email() })
          .parse(raw);
        const row = await tx.client.findUniqueOrThrow({ where: { id: v.id } });
        if (row.email !== v.confirmEmail.toLowerCase()) throw Error('INVALID');
        if (
          await tx.booking.count({
            where: {
              email: row.email,
              OR: [
                {
                  status: { in: ['PENDING', 'CONFIRMED'] },
                  end: { gt: new Date() },
                },
                {
                  meeting: {
                    status: { not: 'CANCELLED' },
                    externalId: { not: null },
                  },
                },
              ],
            },
          })
        )
          throw Error('CONFLICT');
        await tx.task.deleteMany({
          where: {
            OR: [{ clientId: row.id }, { booking: { email: row.email } }],
          },
        });
        await tx.booking.deleteMany({ where: { email: row.email } });
        await tx.inquiry.deleteMany({ where: { email: row.email } });
        await tx.outbox.deleteMany({ where: { to: row.email } });
        await tx.client.delete({ where: { id: row.id } });
        await audit(tx, actor, 'CLIENT_ERASE', 'Client', row.id);
        return { id: row.id };
      }
      if (action === 'inviteStaff') {
        assertOwner(actor);
        const v = z
          .object({
            email: z.email().max(254),
            name: z.string().trim().min(2).max(120),
            role: z.enum(['OWNER', 'ADMIN', 'ACCOUNTANT']),
            locale: z.enum(['lv', 'en', 'ru']),
          })
          .parse(raw);
        const id = randomUUID(),
          invite = token();
        await tx.staff.create({
          data: {
            ...v,
            id,
            email: v.email.toLowerCase(),
            active: false,
            passwordHash: await bcrypt.hash(
              randomBytes(32).toString('hex'),
              12,
            ),
            totpCiphertext: seal(newTotpSecret(), `totp:${id}`),
            enrolTokenHash: hash(invite),
            enrolExpiresAt: new Date(Date.now() + 24 * 3600000),
          },
        });
        await audit(tx, actor, 'STAFF_INVITE', 'Staff', id, ['role']);
        return {
          id,
          enrollmentUrl: `${process.env.APP_URL}/enroll?token=${invite}`,
        };
      }
      if (action === 'client') {
        assertManager(actor);
        const v = clientInput.parse(raw);
        if (
          v.ownerId &&
          !(await tx.staff.findFirst({
            where: { id: v.ownerId, active: true },
          }))
        )
          throw Error('INVALID');
        const { id, ...data } = v;
        const row = id
          ? await tx.client.update({ where: { id }, data })
          : await tx.client.create({ data });
        await audit(
          tx,
          actor,
          'CLIENT_SAVE',
          'Client',
          row.id,
          Object.keys(data),
        );
        return { id: row.id };
      }
      if (action === 'task') {
        const v = taskInput.parse(raw);
        if (v.id) {
          const old = await tx.task.findUnique({ where: { id: v.id } });
          if (!old) throw Error('NOT_FOUND');
          assertAssigned(actor, old.assignedId);
          if (v.version !== old.version) throw Error('CONFLICT');
          if (
            !manager(actor) &&
            ((v.assignedId !== undefined && v.assignedId !== actor.id) ||
              v.clientId !== old.clientId ||
              v.bookingId !== old.bookingId ||
              v.dueAt !== old.dueAt.toISOString() ||
              v.recurrence !== old.recurrence ||
              v.autoAssign)
          )
            throw Error('FORBIDDEN');
        }
        if (
          !manager(actor) &&
          (!v.id || (v.assignedId && v.assignedId !== actor.id))
        )
          throw Error('FORBIDDEN');
        await checkLinks(tx, actor, v.clientId, v.bookingId);
        const { id, version, autoAssign: assign, ...data } = v;
        void version;
        let assignedId = v.assignedId;
        if (assign) {
          assertManager(actor);
          assignedId = await autoAssign(tx, v.category, v.estimatedMinutes);
        }
        if (
          assignedId &&
          !(await tx.staff.findFirst({
            where: { id: assignedId, active: true },
          }))
        )
          throw Error('INVALID');
        const row = id
          ? await tx.task.update({
              where: { id },
              data: {
                ...data,
                dueAt: new Date(v.dueAt),
                assignedId,
                version: { increment: 1 },
              },
            })
          : await tx.task.create({
              data: {
                ...data,
                dueAt: new Date(v.dueAt),
                assignedId,
                createdById: actor.id,
              },
            });
        await audit(tx, actor, 'TASK_SAVE', 'Task', row.id, Object.keys(data));
        if (row.assignedId) {
          const staff = await tx.staff.findUniqueOrThrow({
            where: { id: row.assignedId },
          });
          await notify(tx, {
            to: staff.email,
            locale: staff.locale,
            kind: 'task',
            id: row.id,
            dedup: `task:${row.id}:${row.version}`,
            link: `${process.env.APP_URL}/workspace`,
          });
        }
        return { id: row.id };
      }
      if (action === 'taskStatus') {
        const v = z
          .object({
            id: z.uuid(),
            status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']),
            version: z.number().int(),
          })
          .parse(raw);
        const row = await tx.task.findUnique({ where: { id: v.id } });
        if (!row) throw Error('NOT_FOUND');
        assertAssigned(actor, row.assignedId);
        if (row.version !== v.version) throw Error('CONFLICT');
        await tx.task.update({
          where: { id: row.id },
          data: { status: v.status, version: { increment: 1 } },
        });
        await audit(tx, actor, 'TASK_STATUS', 'Task', row.id, ['status']);
        return { id: row.id };
      }
      if (action === 'comment') {
        const v = z
          .object({
            taskId: z.uuid(),
            body: z.string().trim().min(1).max(2000),
          })
          .parse(raw);
        const task = await tx.task.findUnique({ where: { id: v.taskId } });
        if (!task) throw Error('NOT_FOUND');
        assertAssigned(actor, task.assignedId);
        await tx.taskComment.create({ data: { ...v, authorId: actor.id } });
        await audit(tx, actor, 'TASK_COMMENT', 'Task', task.id);
        return { id: task.id };
      }
      if (action === 'bookingStatus') {
        const v = z
          .object({
            id: z.uuid(),
            status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']),
          })
          .parse(raw);
        await bookingStatus(tx, actor, v.id, v.status);
        return { id: v.id };
      }
      if (action === 'linkClient') {
        assertManager(actor);
        const v = z
          .object({ bookingId: z.uuid(), clientId: z.uuid() })
          .parse(raw);
        await checkLinks(tx, actor, v.clientId, v.bookingId);
        await tx.booking.update({
          where: { id: v.bookingId },
          data: { clientId: v.clientId },
        });
        await audit(tx, actor, 'BOOKING_CLIENT_LINK', 'Booking', v.bookingId, [
          'clientId',
        ]);
        return { id: v.bookingId };
      }
      if (action === 'staff') {
        assertOwner(actor);
        const v = z
          .object({
            id: z.uuid(),
            name: z.string().trim().min(2).max(120),
            role: z.enum(['OWNER', 'ADMIN', 'ACCOUNTANT']),
            active: z.boolean(),
            acceptsBookings: z.boolean(),
            capacityMinutes: z.number().int().min(60).max(10080),
            specializations: z
              .array(z.string().regex(/^[a-z0-9-]{1,80}$/))
              .max(30),
            locale: z.enum(['lv', 'en', 'ru']),
            schedule: scheduleInput.nullable(),
          })
          .parse(raw);
        const old = await tx.staff.findUniqueOrThrow({ where: { id: v.id } });
        if (
          old.role === 'OWNER' &&
          (!v.active || v.role !== 'OWNER') &&
          (await tx.staff.count({ where: { active: true, role: 'OWNER' } })) <=
            1
        )
          throw Error('FORBIDDEN');
        const { id, ...data } = v;
        await tx.staff.update({
          where: { id },
          data: data as Prisma.StaffUpdateInput,
        });
        if (old.role !== v.role || old.active !== v.active)
          await tx.staffSession.deleteMany({ where: { staffId: id } });
        await audit(tx, actor, 'STAFF_UPDATE', 'Staff', id, Object.keys(data));
        return { id };
      }
      if (action === 'faq') {
        assertManager(actor);
        const { id, ...v } = faqInput.parse(raw);
        const row = id
          ? await tx.faqEntry.update({ where: { id }, data: v })
          : await tx.faqEntry.create({ data: v });
        await audit(tx, actor, 'FAQ_SAVE', 'FaqEntry', row.id, [
          'category',
          'translations',
          'approved',
        ]);
        return { id: row.id };
      }
      if (action === 'disconnectOAuth') {
        const v = z.object({ id: z.uuid() }).parse(raw);
        const c = await tx.oAuthConnection.findUnique({ where: { id: v.id } });
        if (!c || (c.staffId !== actor.id && actor.role !== 'OWNER'))
          throw Error('NOT_FOUND');
        await tx.oAuthConnection.delete({ where: { id: v.id } });
        await audit(tx, actor, 'OAUTH_DISCONNECT', 'OAuthConnection', v.id);
        return { id: v.id };
      }
      if (action === 'retryVideo') {
        assertManager(actor);
        const { id } = z.object({ id: z.uuid() }).parse(raw);
        const job = await tx.videoJob.findUnique({ where: { id } });
        if (!job || !['FAILED', 'NEEDS_REVIEW'].includes(job.status))
          throw Error('INVALID');
        if (job.status === 'NEEDS_REVIEW')
          throw Error('MANUAL_RECONCILIATION_REQUIRED');
        await tx.videoJob.update({
          where: { id },
          data: {
            status: 'QUEUED',
            attempts: 0,
            nextAttempt: new Date(),
            errorCode: null,
          },
        });
        await audit(tx, actor, 'VIDEO_RETRY', 'VideoJob', id);
        return { id };
      }
      throw Error('INVALID');
    },
    { timeout: 15000 },
  );
}

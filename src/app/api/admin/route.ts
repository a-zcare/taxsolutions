import { NextResponse } from 'next/server';
import { requireAdmin, sameOrigin } from '@/lib/security';
import { db } from '@/lib/db';
import { failure, json } from '@/lib/http';
import { serviceInput, scheduleInput, contactsInput } from '@/lib/validation';
import { z } from 'zod';
import { copy } from '@/lib/i18n';
import type { Prisma } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const search = new URL(req.url).searchParams;
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .parse(search.get('page') ?? 1);
    const filter = z
      .enum([
        'all',
        'upcoming',
        'PENDING',
        'CONFIRMED',
        'CANCELLED',
        'COMPLETED',
      ])
      .parse(search.get('filter') ?? 'upcoming');
    const upcoming: Prisma.BookingWhereInput = {
      start: { gte: new Date() },
      status: { in: ['PENDING', 'CONFIRMED'] },
    };
    const where: Prisma.BookingWhereInput =
      filter === 'all'
        ? {}
        : filter === 'upcoming'
          ? upcoming
          : { status: filter };
    const [bookings, services, settings, unsent, bookingCount, upcomingCount] =
      await Promise.all([
        db.booking.findMany({
          where,
          orderBy: { start: filter === 'upcoming' ? 'asc' : 'desc' },
          take: 50,
          skip: (page - 1) * 50,
          select: {
            id: true,
            serviceId: true,
            start: true,
            end: true,
            name: true,
            email: true,
            phone: true,
            comment: true,
            status: true,
            locale: true,
            createdAt: true,
          },
        }),
        db.service.findMany({ orderBy: { id: 'asc' } }),
        db.setting.findMany(),
        db.outbox.count({ where: { sentAt: null } }),
        db.booking.count({ where }),
        db.booking.count({ where: upcoming }),
      ]);
    return NextResponse.json(
      {
        bookings,
        services,
        settings,
        unsent,
        bookingCount,
        upcomingCount,
        page,
        pages: Math.max(1, Math.ceil(bookingCount / 50)),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    await sameOrigin();
    await requireAdmin();
    const v = z
      .object({
        action: z.enum([
          'status',
          'service',
          'schedule',
          'contacts',
          'content',
        ]),
        data: z.unknown(),
      })
      .parse(await json(req));
    if (v.action === 'status') {
      const data = z
        .object({
          id: z.uuid(),
          status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']),
        })
        .parse(v.data);
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(740217)`;
        const b = await tx.booking.findUniqueOrThrow({
          where: { id: data.id },
        });
        if (b.status === 'CANCELLED' && data.status !== 'CANCELLED')
          throw new Error('INVALID');
        if (data.status === 'COMPLETED' && b.end > new Date())
          throw new Error('INVALID');
        await tx.booking.update({
          where: { id: data.id },
          data: { status: data.status },
        });
        if (b.status !== data.status)
          await tx.outbox.create({
            data: {
              to: b.email,
              subject: 'TaxSolutions',
              text: `${copy[b.locale as keyof typeof copy].nav[3]}: ${formatInTimeZone(b.start, 'Europe/Riga', 'dd.MM.yyyy HH:mm')} (Europe/Riga)\n${{ lv: { PENDING: 'Gaida apstiprinājumu', CONFIRMED: 'Apstiprināts', CANCELLED: 'Atcelts', COMPLETED: 'Pabeigts' }, en: { PENDING: 'Pending', CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled', COMPLETED: 'Completed' }, ru: { PENDING: 'Ожидает подтверждения', CONFIRMED: 'Подтверждено', CANCELLED: 'Отменено', COMPLETED: 'Завершено' } }[b.locale as 'lv' | 'en' | 'ru'][data.status]}`,
            },
          });
      });
    }
    if (v.action === 'service') {
      const data = serviceInput.parse(v.data);
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(740217)`;
        await tx.service.upsert({
          where: { id: data.id },
          create: data,
          update: data,
        });
      });
    }
    if (v.action === 'schedule') {
      const data = scheduleInput.parse(v.data);
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(740217)`;
        await tx.setting.upsert({
          where: { key: 'schedule' },
          create: { key: 'schedule', value: data },
          update: { value: data },
        });
      });
    }
    if (v.action === 'contacts') {
      const data = contactsInput.parse(v.data);
      await db.setting.upsert({
        where: { key: 'contacts' },
        create: { key: 'contacts', value: data },
        update: { value: data },
      });
    }
    if (v.action === 'content') {
      const { locale, value } = z
        .object({
          locale: z.enum(['lv', 'en', 'ru']),
          value: z.record(z.string(), z.unknown()),
        })
        .parse(v.data);
      const defaults = copy[locale];
      if (Object.keys(value).some((k) => !(k in defaults)))
        throw new Error('INVALID');
      for (const [key, val] of Object.entries(value)) {
        const original = defaults[key as keyof typeof defaults];
        if (typeof original === 'string') {
          if (typeof val !== 'string' || val.length > 15000)
            throw new Error('INVALID');
        } else if (
          !Array.isArray(val) ||
          val.length !== original.length ||
          val.some((x, i) =>
            typeof original[i] === 'string'
              ? typeof x !== 'string'
              : !Array.isArray(x) ||
                x.length !== 2 ||
                x.some((y) => typeof y !== 'string'),
          )
        )
          throw new Error('INVALID');
      }
      await db.setting.upsert({
        where: { key: `content.${locale}` },
        create: { key: `content.${locale}`, value: value as never },
        update: { value: value as never },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}

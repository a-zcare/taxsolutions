import { db } from '../db';
import { provider, type MeetingResult } from './providers';
import { accessToken } from './oauth';
import { VideoError } from './http';
import { seal } from '../v2/crypto';
import { audit } from '../v2/audit';
import { bookingEvent } from '../v2/booking-events';
export async function processVideoJob() {
  const job = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT j.id FROM "VideoJob" j WHERE ((j.status='QUEUED' AND j."nextAttempt"<=now()) OR (j.status='RUNNING' AND j."leaseUntil"<now())) AND NOT EXISTS (SELECT 1 FROM "VideoJob" x WHERE x."bookingId"=j."bookingId" AND x.status='RUNNING' AND x."leaseUntil">now()) ORDER BY j.version,j."createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
    if (!rows.length) return null;
    return tx.videoJob.update({
      where: { id: rows[0].id },
      data: {
        status: 'RUNNING',
        attempts: { increment: 1 },
        leaseUntil: new Date(Date.now() + 600000),
      },
    });
  });
  if (!job) return false;
  try {
    const b = await db.booking.findUniqueOrThrow({
      where: { id: job.bookingId },
      include: { meeting: true },
    });
    if (
      job.action !== 'DELETE' &&
      (b.version !== job.version ||
        ['CANCELLED', 'COMPLETED'].includes(b.status))
    ) {
      await db.videoJob.updateMany({
        where: { id: job.id, status: 'RUNNING', attempts: job.attempts },
        data: { status: 'DONE', leaseUntil: null },
      });
      return true;
    }
    const p = provider(job.provider, (force) =>
      accessToken(b.staffId ?? '', job.provider, force),
    );
    let result: MeetingResult | undefined;
    if (job.action === 'DELETE') {
      if (b.meeting?.externalId) await p.cancel(b.meeting.externalId);
    } else {
      await db.videoJob.update({
        where: { id: job.id },
        data: { externalAttemptAt: new Date() },
      });
      const input = {
        bookingId: b.id,
        start: b.start,
        end: b.end,
        recoverOnly: job.provider === 'zoom' && Boolean(job.externalAttemptAt),
      };
      result = b.meeting?.externalId
        ? await p.update(b.meeting.externalId, input)
        : await p.create(input);
    }
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(740217)`;
      // Fence a worker whose lease was reclaimed while its API call was in flight.
      const claim = await tx.videoJob.findUnique({ where: { id: job.id } });
      if (
        !claim ||
        claim.status !== 'RUNNING' ||
        claim.attempts !== job.attempts
      )
        return;
      const current = await tx.booking.findUnique({ where: { id: b.id } });
      if (!current) return;
      if (job.action === 'DELETE') {
        await tx.videoMeeting.update({
          where: { bookingId: b.id },
          data: { status: 'CANCELLED', joinUrlCiphertext: null },
        });
      } else if (result) {
        await tx.videoMeeting.update({
          where: { bookingId: b.id },
          data: {
            externalId: result.externalId,
            joinUrlCiphertext: seal(result.joinUrl, `video:${b.id}`),
            status:
              current.version === job.version
                ? 'READY'
                : current.status === 'CANCELLED'
                  ? 'CANCELLING'
                  : 'QUEUED',
          },
        });
        if (current.version === job.version && current.status === 'PENDING') {
          const confirmed = await tx.booking.update({
            where: { id: b.id },
            data: { status: 'CONFIRMED' },
          });
          await bookingEvent(tx, confirmed, 'confirmed', result.joinUrl);
        }
      }
      await tx.videoJob.update({
        where: { id: job.id },
        data: { status: 'DONE', leaseUntil: null, errorCode: null },
      });
      await audit(tx, null, 'VIDEO_' + job.action, 'Booking', b.id);
    });
  } catch (error) {
    const e = error instanceof VideoError ? error : new VideoError('INTERNAL');
    const uncertain = job.provider === 'zoom' && e.uncertain;
    const status = uncertain
      ? 'NEEDS_REVIEW'
      : e.retryable && job.attempts < 5
        ? 'QUEUED'
        : 'FAILED';
    const changed = await db.videoJob.updateMany({
      where: { id: job.id, status: 'RUNNING', attempts: job.attempts },
      data: {
        status,
        leaseUntil: null,
        errorCode: e.code,
        nextAttempt: new Date(
          Date.now() + Math.min(60, 2 ** job.attempts) * 60000,
        ),
        ...(e.code === 'HTTP_429' ? { externalAttemptAt: null } : {}),
      },
    });
    if (!changed.count) return true;
    await db.videoMeeting.updateMany({
      where: { bookingId: job.bookingId, version: job.version },
      data: { status: status === 'QUEUED' ? 'QUEUED' : 'FAILED' },
    });
  }
  return true;
}

import type { Booking, Prisma } from '@prisma/client';
import { notify } from './notifications';
import { unseal } from './crypto';
export const enabledVideoProviders = () =>
  (process.env.VIDEO_ENABLED_PROVIDERS ?? '')
    .split(',')
    .filter((p) => ['google', 'microsoft', 'zoom'].includes(p));
export async function bookingEvent(
  tx: Prisma.TransactionClient,
  b: Booking,
  kind: 'requested' | 'confirmed' | 'cancelled' | 'rescheduled' | 'reminder',
  videoLink?: string,
) {
  let link = videoLink;
  if (!link && b.manageTokenCiphertext && kind !== 'cancelled')
    link = `${process.env.APP_URL ?? 'http://localhost:3000'}/${b.locale}/cancel?token=${unseal(b.manageTokenCiphertext, `booking:${b.id}`)}`;
  await notify(tx, {
    to: b.email,
    locale: b.locale,
    kind,
    id: b.id,
    start: b.start,
    link,
    dedup: `booking:${b.id}:${b.version}:${kind}`,
  });
  if (b.staffId) {
    const staff = await tx.staff.findUnique({ where: { id: b.staffId } });
    if (staff?.active)
      await notify(tx, {
        to: staff.email,
        locale: staff.locale,
        kind,
        id: b.id,
        start: b.start,
        link: `${process.env.APP_URL}/workspace`,
        dedup: `staff:${b.id}:${b.version}:${kind}`,
      });
  }
}
export async function queueVideo(
  tx: Prisma.TransactionClient,
  b: Booking,
  action?: 'DELETE',
) {
  const existing = await tx.videoMeeting.findUnique({
    where: { bookingId: b.id },
  });
  if (action === 'DELETE' && !existing) return;
  if (!b.staffId) throw Error('VIDEO_NOT_CONFIGURED');
  const connection = await tx.oAuthConnection.findFirst({
    where: {
      staffId: b.staffId,
      enabled: true,
      provider: { in: enabledVideoProviders() },
    },
    orderBy: { provider: 'asc' },
  });
  const provider = existing?.externalId
    ? existing.provider
    : (connection?.provider ??
      (process.env.ENABLE_MOCK_VIDEO === 'true' &&
      process.env.APP_ENV === 'test'
        ? 'mock'
        : undefined));
  if (!provider) throw Error('VIDEO_NOT_CONFIGURED');
  const jobAction = action ?? (existing?.externalId ? 'UPDATE' : 'CREATE');
  await tx.videoMeeting.upsert({
    where: { bookingId: b.id },
    create: {
      bookingId: b.id,
      provider,
      status: action ? 'CANCELLING' : 'QUEUED',
      version: b.version,
    },
    update: {
      provider,
      status: action ? 'CANCELLING' : 'QUEUED',
      version: b.version,
    },
  });
  await tx.videoJob.upsert({
    where: {
      bookingId_version_action: {
        bookingId: b.id,
        version: b.version,
        action: jobAction,
      },
    },
    update: {},
    create: {
      bookingId: b.id,
      version: b.version,
      action: jobAction,
      provider,
    },
  });
}

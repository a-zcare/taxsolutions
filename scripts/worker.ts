import { deliverMail } from '../src/lib/mail';
import { db } from '../src/lib/db';
let stopping = false;
process.on('SIGTERM', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});
while (!stopping) {
  try {
    await deliverMail();
    await db.booking.deleteMany({
      where: { end: { lt: new Date(Date.now() - 180 * 86400000) } },
    });
    await db.outbox.deleteMany({
      where: {
        OR: [
          { sentAt: { lt: new Date(Date.now() - 30 * 86400000) } },
          { createdAt: { lt: new Date(Date.now() - 180 * 86400000) } },
        ],
      },
    });
    await db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch {
    console.error('Worker cycle failed; retrying. No personal data logged.');
  }
  await new Promise((r) => setTimeout(r, 5000));
}
await db.$disconnect();

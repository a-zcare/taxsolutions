import { deliverMail } from '../src/lib/mail';
import { db } from '../src/lib/db';
import { maintainPlatform } from '../src/lib/v2/maintenance';
import { processVideoJob } from '../src/lib/video/worker';
let stopping = false;
process.on('SIGTERM', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});
while (!stopping) {
  try {
    await maintainPlatform();
    await processVideoJob();
    await deliverMail();
  } catch {
    console.error(
      'Worker cycle failed; retrying. Personal data and credentials omitted.',
    );
  }
  if (!stopping) await new Promise((r) => setTimeout(r, 5000));
}
await db.$disconnect();

import nodemailer from 'nodemailer';
import { db } from './db';
export async function deliverMail() {
  if (!process.env.SMTP_HOST) return { configured: false, sent: 0 };
  let sent = 0;
  // Lock rows throughout delivery. Multiple workers cannot send the same row concurrently.
  await db.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<
        {
          id: string;
          to: string;
          subject: string;
          text: string;
          attempts: number;
        }[]
      >`SELECT * FROM "Outbox" WHERE "sentAt" IS NULL AND "nextAttempt"<=now() ORDER BY "createdAt" LIMIT 10 FOR UPDATE SKIP LOCKED`;
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
        connectionTimeout: 10000,
        socketTimeout: 10000,
      });
      for (const row of rows) {
        try {
          await transport.sendMail({
            from: process.env.SMTP_FROM,
            to: row.to,
            subject: row.subject,
            text: row.text,
            messageId: `<${row.id}@taxsolutions>`,
          });
          await tx.outbox.update({
            where: { id: row.id },
            data: { sentAt: new Date() },
          });
          sent++;
        } catch {
          await tx.outbox.update({
            where: { id: row.id },
            data: {
              attempts: { increment: 1 },
              nextAttempt: new Date(
                Date.now() +
                  Math.min(1440, 2 ** Math.min(row.attempts, 10)) * 60000,
              ),
            },
          });
        }
      }
    },
    { timeout: 120000 },
  );
  return { configured: true, sent };
}

import { db } from '@/lib/db';
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    if (process.env.APP_ENV === 'production') {
      const row = await db.setting.findUnique({
        where: { key: 'worker.heartbeat' },
      });
      const at = (row?.value as { at?: string })?.at;
      if (
        !at ||
        !Number.isFinite(Date.parse(at)) ||
        Date.parse(at) > Date.now() + 60000 ||
        Date.now() - Date.parse(at) > 5 * 60000
      )
        return Response.json({ status: 'degraded' }, { status: 503 });
    }
    return Response.json({ status: 'ok' });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}

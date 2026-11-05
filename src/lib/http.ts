import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
export function failure(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const status =
    error instanceof ZodError ||
    message === 'INVALID' ||
    message === 'VIDEO_NOT_CONFIGURED'
      ? 400
      : message === 'NOT_FOUND'
        ? 404
        : message === 'ORIGIN' || message === 'FORBIDDEN'
          ? 403
          : message === 'UNAUTHORIZED'
            ? 401
            : message === 'RATE'
              ? 429
              : message === 'CONFLICT' ||
                  message.includes('23P01') ||
                  message.includes('P2002')
                ? 409
                : 500;
  if (status === 500) console.error('Request failed. Personal data omitted.');
  return NextResponse.json(
    {
      error:
        status === 500
          ? 'SERVER_ERROR'
          : status === 400
            ? 'INVALID'
            : status === 409
              ? 'CONFLICT'
              : message,
    },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function json(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > 16384)
    throw Error('INVALID');
  const reader = request.body?.getReader();
  if (!reader) throw Error('INVALID');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 16384) {
      await reader.cancel();
      throw Error('INVALID');
    }
    chunks.push(part.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Error('INVALID');
  }
}

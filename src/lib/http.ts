import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
export function failure(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const status =
    error instanceof ZodError || message === 'INVALID'
      ? 400
      : message === 'ORIGIN'
        ? 403
        : message === 'UNAUTHORIZED'
          ? 401
          : message === 'RATE'
            ? 429
            : message === 'CONFLICT' || message.includes('23P01')
              ? 409
              : 500;
  if (status === 500) console.error('Request failed. Personal data omitted.');
  return NextResponse.json(
    { error: status === 500 ? 'SERVER_ERROR' : message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function json(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > 16384)
    throw new Error('INVALID');
  const text = await request.text();
  if (text.length > 16384) throw new Error('INVALID');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('INVALID');
  }
}

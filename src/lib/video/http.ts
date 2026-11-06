export class VideoError extends Error {
  constructor(
    public code: string,
    public retryable = false,
    public uncertain = false,
  ) {
    super(code);
  }
}
const hosts = new Set([
  'www.googleapis.com',
  'oauth2.googleapis.com',
  'graph.microsoft.com',
  'login.microsoftonline.com',
  'api.zoom.us',
  'zoom.us',
]);
export function allowedApiUrl(raw: string) {
  const u = new URL(raw);
  if (
    u.protocol !== 'https:' ||
    !hosts.has(u.hostname) ||
    (u.port && u.port !== '443') ||
    u.username ||
    u.password
  )
    throw new VideoError('UNSAFE_ENDPOINT');
  return u;
}
export async function safeRequest(raw: string, init: RequestInit = {}) {
  const url = allowedApiUrl(raw);
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new VideoError('NETWORK', true, true);
  }
  if (!response.ok) {
    const retry =
      response.status === 429 ||
      response.status >= 500 ||
      response.status === 408;
    await response.body?.cancel();
    throw new VideoError(
      `HTTP_${response.status}`,
      retry,
      response.status >= 500 || response.status === 408,
    );
  }
  if (response.status === 204) return {} as Record<string, unknown>;
  const reader = response.body?.getReader();
  if (!reader) return {};
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const p = await reader.read();
    if (p.done) break;
    size += p.value.length;
    if (size > 262144) {
      await reader.cancel();
      throw new VideoError('RESPONSE_TOO_LARGE');
    }
    chunks.push(p.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString()) as Record<
      string,
      unknown
    >;
  } catch {
    throw new VideoError('INVALID_RESPONSE');
  }
}
export function meetingUrl(raw: unknown, provider: string) {
  if (typeof raw !== 'string') throw new VideoError('LINK_PENDING', true);
  const u = new URL(raw);
  const valid =
    provider === 'google'
      ? u.hostname === 'meet.google.com'
      : provider === 'microsoft'
        ? ['teams.microsoft.com', 'teams.live.com'].includes(u.hostname)
        : provider === 'mock'
          ? u.hostname === 'video.example.invalid'
          : u.hostname === 'zoom.us' || u.hostname.endsWith('.zoom.us');
  if (
    !valid ||
    u.protocol !== 'https:' ||
    (u.port && u.port !== '443') ||
    u.username ||
    u.password
  )
    throw new VideoError('UNSAFE_MEETING_URL');
  return u.href;
}

import { NextResponse, type NextRequest } from 'next/server';
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  const locale = request.nextUrl.pathname.split('/')[1];
  headers.set(
    'x-site-locale',
    ['lv', 'en', 'ru'].includes(locale) ? locale : 'lv',
  );
  return NextResponse.next({ request: { headers } });
}
export const config = {
  matcher: [
    '/((?!api|_next|icon.svg|robots.txt|sitemap.xml|opengraph-image).*)',
  ],
};

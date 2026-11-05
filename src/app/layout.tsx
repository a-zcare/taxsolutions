import './globals.css';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
  title: { default: 'TaxSolutions', template: '%s | TaxSolutions' },
  description:
    'Multilingual accounting and tax services website with online appointment booking, availability calendar, and transparent pricing.',
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = (await headers()).get('x-site-locale') ?? 'lv';
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}

import Link from 'next/link';
import Language from './Language';
import type { Copy } from '@/lib/i18n';
export const anchors = [
  'about',
  'services',
  'pricing',
  'booking',
  'faq',
  'contact',
];
export function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>
        Tax<span className="logo-light">Solutions</span>
        <small>ACCOUNTING & TAX</small>
      </span>
    </span>
  );
}
export default function Header({ locale, c }: { locale: string; c: Copy }) {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link aria-label="TaxSolutions" href={`/${locale}`}>
          <Logo />
        </Link>
        <nav className="desktop-nav">
          {anchors
            .filter((a) => a !== 'booking')
            .map((a) => (
              <a key={a} href={`/${locale}#${a}`}>
                {c.nav[anchors.indexOf(a)]}
              </a>
            ))}
        </nav>
        <Language locale={locale} />
        <a className="button small header-book" href={`/${locale}#booking`}>
          {c.book}
          <span aria-hidden="true">↗</span>
        </a>
        <details className="mobile-menu">
          <summary aria-label={c.nav.join(', ')}>☰</summary>
          <nav>
            {anchors.map((a, i) => (
              <a key={a} href={`/${locale}#${a}`}>
                {c.nav[i]}
              </a>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}

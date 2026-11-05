'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
export default function Language({ locale }: { locale: string }) {
  const path = usePathname();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <nav className="languages" aria-label="Language">
      {['lv', 'en', 'ru'].map((l) => (
        <a
          key={l}
          href={path.replace(/^\/(lv|en|ru)/, `/${l}`)}
          lang={l}
          hrefLang={l}
          aria-current={l === locale ? 'page' : undefined}
        >
          {l.toUpperCase()}
        </a>
      ))}
    </nav>
  );
}

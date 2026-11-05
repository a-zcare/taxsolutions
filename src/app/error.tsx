'use client';
import { usePathname } from 'next/navigation';
export default function ErrorPage({ reset }: { reset: () => void }) {
  const locale = usePathname().split('/')[1];
  const text =
    locale === 'ru'
      ? ['Не удалось загрузить страницу', 'Повторить попытку']
      : locale === 'en'
        ? ['Unable to load the page', 'Try again']
        : ['Neizdevās ielādēt lapu', 'Mēģināt vēlreiz'];
  return (
    <main className="container legal-page">
      <h1>{text[0]}</h1>
      <button className="button" onClick={reset}>
        {text[1]}
      </button>
    </main>
  );
}

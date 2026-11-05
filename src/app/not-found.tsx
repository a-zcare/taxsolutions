import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="container legal-page">
      <p className="section-label">TaxSolutions / 404</p>
      <h1>Lapa nav atrasta</h1>
      <p>Page not found · Страница не найдена</p>
      <nav className="hero-actions">
        <Link className="button" href="/lv">
          Sākumlapa
        </Link>
        <Link className="button secondary" href="/en">
          Home
        </Link>
        <Link className="button secondary" href="/ru">
          Главная
        </Link>
      </nav>
    </main>
  );
}

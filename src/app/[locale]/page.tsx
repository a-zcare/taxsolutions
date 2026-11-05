import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  ChartNoAxesCombined,
  ReceiptText,
  Users,
  Files,
  Building2,
  Calculator,
  ShieldCheck,
  Globe2,
  Video,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';
import { db } from '@/lib/db';
import { isLocale, copy } from '@/lib/i18n';
import { content, contacts } from '@/lib/content';
import type { Translations } from '@/lib/defaults';
import Header, { Logo } from '@/components/Header';
import BookingForm from '@/components/BookingForm';
import ContactForm from '@/components/ContactForm';
export const dynamic = 'force-dynamic';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const c = copy[locale];
  return {
    title:
      locale === 'lv'
        ? 'Grāmatvedība un nodokļu konsultācijas'
        : locale === 'en'
          ? 'Accounting & tax consultations'
          : 'Бухгалтерия и налоговые консультации',
    description: c.intro,
    alternates: {
      canonical: `/${locale}`,
      languages: { lv: '/lv', en: '/en', ru: '/ru', 'x-default': '/lv' },
    },
    openGraph: {
      title: 'TaxSolutions',
      description: c.intro,
      locale: { lv: 'lv_LV', en: 'en_GB', ru: 'ru_RU' }[locale],
      type: 'website',
      images: ['/opengraph-image'],
    },
  };
}
const icons = [
  Calculator,
  ReceiptText,
  Users,
  Files,
  Building2,
  ChartNoAxesCombined,
];
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [c, contact, services] = await Promise.all([
    content(locale),
    contacts(),
    db.service.findMany({ where: { active: true }, orderBy: { id: 'asc' } }),
  ]);
  const translated = services.map((s) => ({
    ...s,
    translations: s.translations as Translations,
  }));
  return (
    <>
      <a className="skip-link" href="#main">
        {c.explore}
      </a>
      <Header locale={locale} c={c} />
      <main id="main">
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">
                <span />
                {c.eyebrow}
              </p>
              <h1>
                {c.title.split('\n').map((line, i) => (
                  <span key={i}>
                    {line}
                    <br />
                  </span>
                ))}
              </h1>
              <p className="hero-intro">{c.intro}</p>
              <div className="hero-actions">
                <a className="button" href="#booking">
                  {c.book}
                  <ArrowUpRight size={19} />
                </a>
                <a className="text-link" href="#services">
                  {c.explore}
                  <ArrowRight size={17} />
                </a>
              </div>
              <p className="hero-note">
                <span className="check-circle">
                  <Check size={12} />
                </span>
                {c.tag}
              </p>
            </div>
            <div className="hero-art" aria-label={c.panelTitle}>
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="art-grid" />
              <span className="art-top">TS / FINANCIAL CLARITY</span>
              <div className="chart-sculpture" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <div className="chart-line">↗</div>
              </div>
              <div className="art-card">
                <span className="art-icon">
                  <ChartNoAxesCombined size={24} />
                </span>
                <div>
                  <h2>{c.panelTitle}</h2>
                  <p>{c.panelText}</p>
                </div>
              </div>
              <div className="art-tags">
                {c.panelTags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </div>
          </div>
        </section>
        <div className="trust-strip">
          <div className="container">
            {c.benefits.map((t, i) => {
              const Icon = [ShieldCheck, Globe2, Video][i];
              return (
                <span key={t}>
                  <Icon size={19} />
                  {t}
                </span>
              );
            })}
          </div>
        </div>
        <section id="about" className="section container about-grid">
          <div>
            <p className="section-label">01 / {c.nav[0]}</p>
            <h2>{c.aboutTitle}</h2>
          </div>
          <div>
            <p className="large-body">{c.about}</p>
            <div className="about-signature">
              <span className="mini-mark">TS</span>
              <span>
                TaxSolutions
                <br />
                <small>{c.footer}</small>
              </span>
            </div>
          </div>
        </section>
        <section id="services" className="section pale">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="section-label">02 / {c.nav[1]}</p>
                <h2>{c.servicesTitle}</h2>
              </div>
              <p>{c.servicesIntro}</p>
            </div>
            <div className="service-grid">
              {translated.map((s, i) => {
                const Icon = icons[i % icons.length];
                return (
                  <a href="#booking" key={s.id} className="service-card">
                    <span className="service-icon">
                      <Icon size={25} />
                    </span>
                    <span className="service-index">0{i + 1}</span>
                    <h3>{s.translations[locale].name}</h3>
                    <p>{s.translations[locale].description}</p>
                    <span className="card-arrow">
                      <ArrowUpRight size={21} />
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
        <section id="pricing" className="section container">
          <div className="section-heading">
            <div>
              <p className="section-label">03 / {c.nav[2]}</p>
              <h2>{c.pricesTitle}</h2>
            </div>
            <p className="demo-label">{c.demo}</p>
          </div>
          <div className="price-grid">
            {translated.map((s, i) => (
              <article
                className={`price-card ${i === 1 ? 'featured' : ''}`}
                key={s.id}
              >
                <h3>{s.translations[locale].name}</h3>
                <div className="price">
                  {s.priceType === 'FROM' && <small>{c.from} </small>}
                  {new Intl.NumberFormat(locale, {
                    style: 'currency',
                    currency: 'EUR',
                    maximumFractionDigits: 0,
                  }).format(s.price / 100)}
                </div>
                <p className="price-type">
                  {s.priceType === 'MONTHLY'
                    ? c.month
                    : s.priceType === 'HOURLY'
                      ? c.hour
                      : s.priceType === 'FIXED'
                        ? c.fixed
                        : c.from}
                </p>
                <p>{s.translations[locale].description}</p>
                <a className="price-link" href="#booking">
                  {c.book}
                  <ArrowUpRight size={18} />
                </a>
              </article>
            ))}
          </div>
        </section>
        <section id="booking" className="section booking-section">
          <div className="container booking-grid">
            <div className="booking-copy">
              <p className="section-label">04 / {c.nav[3]}</p>
              <h2>{c.bookingTitle}</h2>
              <p>{c.bookingIntro}</p>
              <div className="timezone-note">
                <Globe2 size={25} />
                <div>
                  Europe/Riga<small>LV · EN · RU</small>
                </div>
              </div>
              <div className="booking-decoration" aria-hidden="true">
                ↗
              </div>
            </div>
            <BookingForm services={translated} c={c} locale={locale} />
          </div>
        </section>
        <section id="faq" className="section container faq-grid">
          <div>
            <p className="section-label">05 / {c.nav[4]}</p>
            <h2>{c.faqTitle}</h2>
          </div>
          <div>
            {c.faq.map(([q, a], i) => (
              <details className="faq-item" key={q}>
                <summary>
                  <span className="faq-number">0{i + 1}</span>
                  {q}
                  <span className="faq-plus">+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section id="contact" className="section pale">
          <div className="container contact-grid">
            <div>
              <p className="section-label">06 / {c.nav[5]}</p>
              <h2>{c.contactsTitle}</h2>
              <p>{c.contactIntro}</p>
              <div className="contact-details">
                <p>
                  <Phone size={19} />
                  {contact.phone || c.placeholder}
                </p>
                <p>
                  <Mail size={19} />
                  {contact.email || c.placeholder}
                </p>
                <p>
                  <MapPin size={19} />
                  {contact.address || c.placeholder}
                </p>
              </div>
            </div>
            <ContactForm c={c} locale={locale} configured={Boolean(contact.email)} />
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="container">
          <div className="footer-top">
            <Logo />
            <p>{c.footer}</p>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} TaxSolutions</span>
            <nav>
              <a href={`/${locale}/privacy`}>{c.privacy}</a>
              <a href={`/${locale}/terms`}>{c.terms}</a>
              <a href={`/${locale}/legal`}>{c.legal}</a>
            </nav>
            <span>{c.demoNotice}</span>
          </div>
        </div>
      </footer>
    </>
  );
}

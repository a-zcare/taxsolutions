import { db } from '../db';
import type { Copy, Locale } from '../i18n';
export type FaqItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
};
export async function approvedFaq(locale: Locale, c: Copy): Promise<FaqItem[]> {
  const rows = await db.faqEntry.findMany({
    where: { approved: true },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });
  if (!rows.length && (await db.faqEntry.count()) === 0)
    return c.faq.map(([question, answer], i) => ({
      id: `legacy-${i}`,
      category: 'general',
      question,
      answer,
    }));
  return rows.map((row) => {
    const t = (
      row.translations as Record<Locale, { question: string; answer: string }>
    )[locale];
    return { id: row.id, category: row.category, ...t };
  });
}

import { z } from 'zod';
const text = z.string().trim();
export const bookingInput = z.object({
  serviceId: text.min(1).max(80),
  start: z.iso.datetime(),
  name: text.min(2).max(120),
  email: z.email().max(254),
  phone: text.regex(/^[+()\d .-]{6,30}$/),
  comment: text.max(2000).default(''),
  locale: z.enum(['lv', 'en', 'ru']),
  consent: z.literal(true),
  website: z.literal('').default(''),
});
export const contactInput = z.object({
  name: text.min(2).max(120),
  email: z.email().max(254),
  comment: text.min(10).max(2000),
  locale: z.enum(['lv', 'en', 'ru']),
  consent: z.literal(true),
  website: z.literal('').default(''),
});
export const translationsInput = z.object(
  Object.fromEntries(
    ['lv', 'en', 'ru'].map((l) => [
      l,
      z.object({
        name: text.min(2).max(120),
        description: text.min(5).max(500),
      }),
    ]),
  ),
);
export const serviceInput = z.object({
  id: text.regex(/^[a-z0-9-]{1,80}$/),
  price: z.number().int().min(0).max(100000000),
  priceType: z.enum(['FIXED', 'FROM', 'HOURLY', 'MONTHLY']),
  duration: z
    .number()
    .int()
    .min(30)
    .max(240)
    .refine((v) => v % 30 === 0),
  active: z.boolean(),
  translations: translationsInput,
});
export const scheduleInput = z
  .object({
    start: z.number().int().min(0).max(23),
    end: z.number().int().min(1).max(24),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    closedDates: z.array(z.iso.date()).max(1000),
    openDates: z.array(z.iso.date()).max(1000),
    leadHours: z.number().min(0).max(168),
    horizonDays: z.number().int().min(1).max(365),
  })
  .refine((v) => v.end > v.start);
export const contactsInput = z.object({
  phone: text.max(40),
  email: z.union([z.literal(''), z.email()]),
  address: text.max(500),
  company: text.max(200),
  registration: text.max(100),
  vat: text.max(100),
});

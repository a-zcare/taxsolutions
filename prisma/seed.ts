import { db } from '../src/lib/db';
import {
  defaultServices,
  defaultSchedule,
  defaultContacts,
} from '../src/lib/defaults';
for (const s of defaultServices)
  await db.service.upsert({ where: { id: s.id }, create: s, update: {} });
for (const [key, value] of Object.entries({
  schedule: defaultSchedule,
  contacts: defaultContacts,
}))
  await db.setting.upsert({
    where: { key },
    create: { key, value },
    update: {},
  });
await db.$disconnect();
console.log('Seed complete. Existing content preserved.');

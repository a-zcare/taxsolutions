import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from './db';
import {
  availableFields,
  defaultFieldSettings,
  documentTypes,
  type DocumentType,
} from './document-ai-fields';
import type { DocumentTemplate } from './document-ai-regions';
import { audit } from './v2/audit';
import type { Actor } from './v2/policy';
import { documentLimitRanges } from './document-ai-options';

const prefix = 'documentAi.template.';
const coordinate = z.number().min(0).max(1);
const minimum = z.number().min(0.003).max(1);
export const templateInputSchema = z.strictObject({
  type: z.custom<DocumentType>(
    (value) => typeof value === 'string' && Object.hasOwn(documentTypes, value),
  ),
  matchText: z.string().trim().min(4).max(100),
  field: z
    .string()
    .refine(
      (field) =>
        availableFields(defaultFieldSettings).includes(field) ||
        /^custom-[a-f0-9-]{36}$/.test(field),
    ),
  label: z.string().trim().min(1).max(80),
  page: z.number().int().min(1).max(documentLimitRanges.pages.max),
  region: z
    .strictObject({
      x: coordinate,
      y: coordinate,
      width: minimum,
      height: minimum,
    })
    .refine((r) => r.x + r.width <= 1.0001 && r.y + r.height <= 1.0001),
  anchor: z.string().trim().max(100),
});
const savedSchema = templateInputSchema.extend({
  id: z.string().regex(/^[a-f0-9]{64}$/),
  anchorOffset: z
    .object({ x: z.number().min(-1).max(1), y: z.number().min(-1).max(1) })
    .optional(),
});

export async function listDocumentTemplates() {
  const settings = await db.setting.findMany({
    where: { key: { startsWith: prefix } },
    orderBy: { key: 'asc' },
  });
  return settings.flatMap(({ value }) => {
    const result = savedSchema.safeParse(value);
    return result.success ? [result.data] : [];
  });
}

export async function saveDocumentTemplate(
  actor: Actor,
  rule: Omit<DocumentTemplate, 'id'>,
) {
  const supplier = rule.matchText
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  const id = createHash('sha256')
    .update(JSON.stringify([rule.type, supplier, rule.field]))
    .digest('hex');
  const key = prefix + id;
  const { anchorOffset, ...details } = rule;
  const value = { ...details, id, ...(anchorOffset ? { anchorOffset } : {}) };
  await db.$transaction(async (tx) => {
    await tx.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    await audit(tx, actor, 'DOCUMENT_AI_TEMPLATE_SAVE', 'Setting', key);
  });
  return value;
}

export async function removeDocumentTemplate(actor: Actor, id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw Error('INVALID');
  const key = prefix + id;
  await db.$transaction(async (tx) => {
    const result = await tx.setting.deleteMany({ where: { key } });
    if (!result.count) throw Error('NOT_FOUND');
    await audit(tx, actor, 'DOCUMENT_AI_TEMPLATE_REMOVE', 'Setting', key);
  });
}

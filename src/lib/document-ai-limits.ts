import { z } from 'zod';
import { db } from './db';
import {
  defaultDocumentLimits,
  documentLimitRanges,
} from './document-ai-options';

function limit(key: keyof typeof documentLimitRanges) {
  const { min, max } = documentLimitRanges[key];
  return z.number().int().min(min).max(max);
}

export const documentLimitsSchema = z.strictObject({
  fileMiB: limit('fileMiB'),
  pages: limit('pages'),
  timeoutSeconds: limit('timeoutSeconds'),
});

export const documentLimitsKey = 'documentAi.limits';

export async function getDocumentLimits() {
  const setting = await db.setting.findUnique({
    where: { key: documentLimitsKey },
  });
  if (!setting) return defaultDocumentLimits;
  const limits = documentLimitsSchema.safeParse(setting.value);
  return limits.success ? limits.data : defaultDocumentLimits;
}

import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from './db';
import {
  documentTypes,
  captureFields,
  defaultFieldSettings,
} from './document-ai-fields';
import { seal, sealBytes, unseal, unsealBytes } from './v2/crypto';
import { audit } from './v2/audit';
import { clientScope, type Actor } from './v2/policy';
import type {
  ArchiveData,
  ArchiveRow,
  ArchiveUpload,
} from './document-archive-types';

export const archivePeriodSchema = z
  .string()
  .regex(/^[2-9]\d{3}-(0[1-9]|1[0-2])$/);
export const archiveUploadSchema = z.strictObject({
  clientId: z.uuid(),
  period: archivePeriodSchema,
  name: z
    .string()
    .trim()
    .min(1)
    .max(240)
    .refine((name) => !/[\u0000-\u001f/\\]/.test(name)),
});
const field = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9-]{0,63}$/)
  .refine((key) => !Object.hasOwn(Object.prototype, key));
const keys = z.array(field).max(24);
export const archiveReviewSchema = z.strictObject({
  revision: z.number().int().positive(),
  confirm: z.boolean(),
  type: z.custom<ArchiveData['type']>(
    (value) => typeof value === 'string' && Object.hasOwn(documentTypes, value),
  ),
  fields: keys,
  edits: z
    .record(field, z.string().max(180))
    .refine((value) => Object.keys(value).length <= 48),
  values: z
    .record(
      field,
      z.strictObject({
        label: z.string().trim().min(1).max(80),
        value: z.string().max(180),
      }),
    )
    .refine((value) => Object.keys(value).length <= 24),
});
const select = {
  id: true,
  clientId: true,
  period: true,
  encryptedName: true,
  status: true,
  revision: true,
  createdAt: true,
} as const;
type Summary = Prisma.AccountingDocumentGetPayload<{ select: typeof select }>;
const hash = (bytes: string | Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
const accessible = (actor: Actor): Prisma.AccountingDocumentWhereInput => ({
  client: clientScope(actor),
});
const toRow = ({ encryptedName, ...row }: Summary): ArchiveRow => ({
  ...row,
  status: row.status === 'CONFIRMED' ? 'CONFIRMED' : 'PENDING',
  name: unseal(encryptedName, 'accounting-document-name:' + row.id),
  createdAt: row.createdAt.toISOString(),
});
const dataContext = (id: string) => 'accounting-document-data:' + id;
const fileContext = (id: string) => 'accounting-document-file:' + id;
function readData(row: { id: string; data: string }): ArchiveData {
  return JSON.parse(unseal(row.data, dataContext(row.id))) as ArchiveData;
}
function invoiceHash(data: ArchiveData) {
  if (data.type !== 'invoice') return null;
  const candidates = captureFields(
    data.pages,
    ['supplier', 'number'],
    defaultFieldSettings,
  );
  const normalized = (key: 'supplier' | 'number') =>
    (data.values[key]?.value ?? data.edits[key] ?? candidates[key].value)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, '');
  const supplier = normalized('supplier'),
    number = normalized('number');
  return supplier && number ? hash(JSON.stringify([supplier, number])) : null;
}

export async function requireArchiveClient(actor: Actor, clientId: string) {
  if (
    !(await db.client.findFirst({
      where: { AND: [{ id: clientId }, clientScope(actor)] },
      select: { id: true },
    }))
  )
    throw Error('NOT_FOUND');
}

export async function archiveClients(
  actor: Actor,
  query: string,
  selected?: string,
) {
  const select = { id: true, name: true } as const;
  const [current, matches] = await Promise.all([
    selected
      ? db.client.findFirst({
          where: { AND: [{ id: selected }, clientScope(actor)] },
          select,
        })
      : null,
    db.client.findMany({
      where: {
        AND: [
          clientScope(actor),
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      select,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 80,
    }),
  ]);
  return current && !matches.some(({ id }) => id === current.id)
    ? [current, ...matches]
    : matches;
}

export async function archiveDocument(
  actor: Actor,
  upload: ArchiveUpload,
  content: Buffer,
  mimeType: string,
  data: ArchiveData,
) {
  const id = randomUUID();
  const contentHash = hash(content);
  const possibleInvoice = invoiceHash(data);
  return db.$transaction(async (tx) => {
    if (
      !(await tx.client.findFirst({
        where: { AND: [{ id: upload.clientId }, clientScope(actor)] },
        select: { id: true },
      }))
    )
      throw Error('NOT_FOUND');
    const existing = await tx.accountingDocument.findUnique({
      where: {
        clientId_contentHash: { clientId: upload.clientId, contentHash },
      },
      select,
    });
    if (existing)
      return {
        row: toRow(existing),
        exactDuplicate: true,
        possibleDuplicate: false,
      };
    const inserted = await tx.accountingDocument.createMany({
      data: {
        id,
        clientId: upload.clientId,
        period: upload.period,
        encryptedName: seal(upload.name, 'accounting-document-name:' + id),
        mimeType,
        content: new Uint8Array(sealBytes(content, fileContext(id))),
        contentHash,
        invoiceHash: possibleInvoice,
        data: seal(JSON.stringify(data), dataContext(id)),
      },
      skipDuplicates: true,
    });
    const row = await tx.accountingDocument.findUniqueOrThrow({
      where: {
        clientId_contentHash: { clientId: upload.clientId, contentHash },
      },
      select,
    });
    if (!inserted.count)
      return {
        row: toRow(row),
        exactDuplicate: true,
        possibleDuplicate: false,
      };
    await audit(
      tx,
      actor,
      'ACCOUNTING_DOCUMENT_UPLOAD',
      'AccountingDocument',
      id,
    );
    return {
      row: toRow(row),
      exactDuplicate: false,
      possibleDuplicate: !!(
        possibleInvoice &&
        (await tx.accountingDocument.findFirst({
          where: {
            clientId: upload.clientId,
            invoiceHash: possibleInvoice,
            id: { not: id },
          },
          select: { id: true },
        }))
      ),
    };
  });
}

export async function archivedDocuments(
  actor: Actor,
  clientId: string,
  period: string,
  index: number,
  status: string,
) {
  await requireArchiveClient(actor, clientId);
  const rows = await db.accountingDocument.findMany({
    where: {
      ...accessible(actor),
      clientId,
      period,
      ...(status ? { status } : {}),
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    skip: index * 40,
    take: 41,
    select,
  });
  return { rows: rows.slice(0, 40).map(toRow), next: rows.length > 40 };
}

export async function archivedDocument(actor: Actor, id: string) {
  const row = await db.accountingDocument.findFirst({
    where: { id, ...accessible(actor) },
    select: { ...select, data: true, invoiceHash: true },
  });
  if (!row) throw Error('NOT_FOUND');
  return {
    ...toRow(row),
    data: readData(row),
    possibleDuplicate: !!(
      row.invoiceHash &&
      (await db.accountingDocument.findFirst({
        where: {
          ...accessible(actor),
          clientId: row.clientId,
          invoiceHash: row.invoiceHash,
          id: { not: id },
        },
        select: { id: true },
      }))
    ),
  };
}

export async function archivedFile(actor: Actor, id: string) {
  const row = await db.accountingDocument.findFirst({
    where: { id, ...accessible(actor) },
    select: { content: true, mimeType: true },
  });
  if (!row) throw Error('NOT_FOUND');
  return {
    bytes: unsealBytes(row.content, fileContext(id)),
    mimeType: row.mimeType,
  };
}

export async function saveArchiveReview(
  actor: Actor,
  id: string,
  input: z.infer<typeof archiveReviewSchema>,
) {
  return db.$transaction(async (tx) => {
    const row = await tx.accountingDocument.findFirst({
      where: { id, ...accessible(actor) },
      select: { ...select, data: true },
    });
    if (!row) throw Error('NOT_FOUND');
    if (row.status !== 'PENDING' || row.revision !== input.revision)
      throw Error('CONFLICT');
    if (
      input.confirm &&
      !Object.values(input.values).some(({ value }) => value.trim())
    )
      throw Error('INVALID');
    const data = {
      ...readData(row),
      type: input.type,
      fields: input.fields,
      edits: input.edits,
      values: input.values,
    };
    const updated = await tx.accountingDocument.updateMany({
      where: {
        id,
        ...accessible(actor),
        revision: input.revision,
        status: 'PENDING',
      },
      data: {
        status: input.confirm ? 'CONFIRMED' : 'PENDING',
        invoiceHash: invoiceHash(data),
        revision: { increment: 1 },
        data: seal(JSON.stringify(data), dataContext(id)),
      },
    });
    if (!updated.count) throw Error('CONFLICT');
    await audit(
      tx,
      actor,
      input.confirm
        ? 'ACCOUNTING_DOCUMENT_CONFIRM'
        : 'ACCOUNTING_DOCUMENT_DRAFT_SAVE',
      'AccountingDocument',
      id,
    );
    return toRow({
      ...row,
      revision: row.revision + 1,
      status: input.confirm ? 'CONFIRMED' : 'PENDING',
    });
  });
}

const csvQuote = (value: string) =>
  '"' +
  (/^\s*[=+\-@\t\r\n]/u.test(value) ? "'" + value : value).replaceAll(
    '"',
    '""',
  ) +
  '"';
export async function accountingCsv(
  actor: Actor,
  clientId: string,
  period: string,
) {
  await requireArchiveClient(actor, clientId);
  const rows = await db.accountingDocument.findMany({
    where: { ...accessible(actor), clientId, period, status: 'CONFIRMED' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 1001,
    select: { id: true, encryptedName: true, data: true },
  });
  if (rows.length > 1000) throw Error('INVALID');
  const fields = new Map<string, string>([
    ['number', 'document_number'],
    ['date', 'document_date'],
    ['supplier', 'supplier'],
    ['net', 'subtotal'],
    ['vat', 'vat'],
    ['total', 'total'],
    ['iban', 'iban'],
  ]);
  const documents = rows.map((row) => {
    const data = readData(row);
    for (const [key, { label }] of Object.entries(data.values)) {
      if (!fields.has(key)) fields.set(key, label);
    }
    return {
      name: unseal(row.encryptedName, 'accounting-document-name:' + row.id),
      data,
    };
  });
  const keys = [...fields.keys()];
  const lines = [
    ['file', 'period', 'type', ...fields.values()],
    ...documents.map(({ name, data }) => [
      name,
      period,
      data.type,
      ...keys.map((key) => data.values[key]?.value ?? ''),
    ]),
  ];
  await db.$transaction((tx) =>
    audit(tx, actor, 'ACCOUNTING_DOCUMENT_EXPORT', 'Client', clientId),
  );
  return (
    '\ufeff' +
    lines.map((line) => line.map(csvQuote).join(',')).join('\r\n') +
    '\r\n'
  );
}

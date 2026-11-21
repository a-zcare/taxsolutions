import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { detectDocumentType } from './document-ai-fields';
import {
  containsDocumentText,
  extractTemplateValue,
  findDocumentAnchor,
  layoutFromTsv,
  matchingDocumentTemplates,
  readDocumentRegion,
  type DocumentLayout,
  type DocumentTemplate,
  type DocumentTemplateInput,
  type TemplateValue,
} from './document-ai-regions';
import {
  documentLanguages,
  bytesPerMiB,
  type DocumentLimits,
  type DocumentLanguage,
  type DocumentPage,
} from './document-ai-options';

const execute = promisify(execFile);
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const active = new Set<'extract' | 'preview' | 'review' | 'teach'>();

export class DocumentOcrError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

async function readDocument(request: Request, maxDocumentBytes: number) {
  if (Number(request.headers.get('content-length')) > maxDocumentBytes)
    throw new DocumentOcrError('TOO_LARGE', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new DocumentOcrError('UNSUPPORTED_FILE', 415);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) return Buffer.concat(chunks, bytes);
      bytes += part.value.length;
      if (bytes > maxDocumentBytes) {
        await reader.cancel();
        throw new DocumentOcrError('TOO_LARGE', 413);
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
}

function extension(bytes: Buffer) {
  if (bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) return 'pdf';
  if (bytes.subarray(0, 8).equals(pngSignature)) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  throw new DocumentOcrError('UNSUPPORTED_FILE', 415);
}

async function runTool(
  directory: string,
  tool: string,
  args: string[],
  signal: AbortSignal,
) {
  try {
    return (
      await execute(
        'prlimit',
        ['--as=805306368', '--fsize=33554432', '--', tool, ...args],
        {
          cwd: directory,
          env: {
            PATH: process.env.PATH,
            NODE_ENV: process.env.NODE_ENV,
            TESSDATA_PREFIX: process.env.TESSDATA_PREFIX,
            LC_ALL: 'C.UTF-8',
            OMP_THREAD_LIMIT: '1',
            TMPDIR: directory,
          },
          signal,
          killSignal: 'SIGKILL',
          maxBuffer: 1024 * 1024,
        },
      )
    ).stdout;
  } catch (error) {
    const command = error as NodeJS.ErrnoException & {
      killed?: boolean;
      stderr?: string;
    };
    if (signal.aborted || command.killed)
      throw new DocumentOcrError('TIMEOUT', 422);
    if (
      command.code === 'ENOENT' ||
      command.stderr?.startsWith('prlimit:') ||
      command.stderr?.includes('TESSDATA_PREFIX')
    )
      throw new DocumentOcrError('OCR_UNAVAILABLE', 503);
    throw new DocumentOcrError('UNREADABLE', 422);
  }
}

async function withDocument<T>(
  request: Request,
  action: 'extract' | 'preview' | 'review' | 'teach',
  limits: DocumentLimits,
  work: (document: {
    source: string;
    ext: string;
    run: (tool: string, args: string[]) => Promise<string>;
    pageImage: (page: number, size: string, gray: boolean) => Promise<string>;
  }) => Promise<T>,
) {
  const bytes = await readDocument(request, limits.fileMiB * bytesPerMiB);
  const ext = extension(bytes);
  if (active.has(action)) throw new DocumentOcrError('BUSY', 503);
  active.add(action);
  try {
    const directory = await mkdtemp(join(tmpdir(), 'taxsolutions-ocr-'));
    try {
      const source = join(directory, `input.${ext}`);
      await writeFile(source, bytes, { mode: 0o600 });
      const signal = AbortSignal.any([
        request.signal,
        AbortSignal.timeout(limits.timeoutSeconds * 1000),
      ]);
      const run = (tool: string, args: string[]) =>
        runTool(directory, tool, args, signal);
      const pageImage = async (page: number, size: string, gray: boolean) => {
        if (ext !== 'pdf') return source;
        const prefix = join(directory, 'page');
        await run('pdftoppm', [
          ...pageRange(page),
          '-singlefile',
          '-scale-to',
          size,
          ...(gray ? ['-gray'] : []),
          '-png',
          source,
          prefix,
        ]);
        return prefix + '.png';
      };
      const result = await work({ source, ext, run, pageImage });
      if (signal.aborted) throw new DocumentOcrError('TIMEOUT', 422);
      return result;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  } finally {
    active.delete(action);
  }
}

const pageRange = (page: number) => ['-f', String(page), '-l', String(page)];

function lowConfidenceWords(tsv: string) {
  const words = new Set<string>();
  for (const line of tsv.split('\n')) {
    const fields = line.split('\t');
    const confidence = Number(fields[10]);
    if (
      fields[0] === '5' &&
      confidence >= 0 &&
      confidence < 75 &&
      fields[11]?.trim()
    )
      words.add(fields[11].trim());
  }
  return [...words].slice(0, 2000);
}

export async function renderDocumentPage(
  request: Request,
  page: number,
  action: 'preview' | 'review',
  limits: DocumentLimits,
) {
  return withDocument(
    request,
    action,
    limits,
    async ({ ext, source, run, pageImage }) => {
      if (ext === 'pdf') {
        const count = await pdfPageCount(run, source, limits.pages);
        if (page > count) throw new DocumentOcrError('NOT_FOUND', 404);
      } else if (page !== 1) {
        throw new DocumentOcrError('NOT_FOUND', 404);
      }
      const file = await pageImage(page, '1800', false);
      return {
        bytes: await readFile(file),
        type: ext === 'jpg' ? 'image/jpeg' : 'image/png',
      };
    },
  );
}

async function pdfPageCount(
  run: (tool: string, args: string[]) => Promise<string>,
  source: string,
  maxDocumentPages: number,
) {
  const info = await run('pdfinfo', [source]);
  const count = Number(/^Pages:\s+(\d+)$/m.exec(info)?.[1]);
  if (!Number.isSafeInteger(count) || count < 1)
    throw new DocumentOcrError('UNREADABLE', 422);
  if (count > maxDocumentPages)
    throw new DocumentOcrError('TOO_MANY_PAGES', 422);
  return count;
}

type RunTool = (tool: string, args: string[]) => Promise<string>;

function pageRecognizer(run: RunTool, language: DocumentLanguage) {
  let languagesChecked = false;
  const selected = documentLanguages[language];
  return async (image: string) => {
    if (!languagesChecked) {
      const installed = (await run('tesseract', ['--list-langs'])).split(
        /\r?\n/,
      );
      if (selected.split('+').some((name) => !installed.includes(name)))
        throw new DocumentOcrError('OCR_UNAVAILABLE', 503);
      languagesChecked = true;
    }
    const output = join(image, '..', 'ocr');
    await run('tesseract', [
      image,
      output,
      '-l',
      selected,
      '--psm',
      '3',
      '-c',
      'tessedit_create_txt=1',
      '-c',
      'tessedit_create_tsv=1',
    ]);
    const [textSize, tsvSize] = await Promise.all([
      stat(output + '.txt'),
      stat(output + '.tsv'),
    ]);
    if (textSize.size > 1024 * 1024 || tsvSize.size > 8 * 1024 * 1024)
      throw new DocumentOcrError('UNREADABLE', 422);
    const [text, tsv] = await Promise.all([
      readFile(output + '.txt', 'utf8'),
      readFile(output + '.tsv', 'utf8'),
    ]);
    return { text: text.trim(), tsv };
  };
}

const embeddedText = async (run: RunTool, source: string, page: number) =>
  (
    await run('pdftotext', [
      ...pageRange(page),
      '-layout',
      '-enc',
      'UTF-8',
      source,
      '-',
    ])
  ).trim();

export async function extractDocument(
  request: Request,
  language: DocumentLanguage,
  limits: DocumentLimits,
  templates: DocumentTemplate[] = [],
) {
  return withDocument(
    request,
    'extract',
    limits,
    async ({ source, ext, run, pageImage }) => {
      const recognize = pageRecognizer(run, language);
      const layouts = new Map<number, DocumentLayout>();
      const count =
        ext === 'pdf' ? await pdfPageCount(run, source, limits.pages) : 1;
      const pages: DocumentPage[] = [];
      for (let number = 1; number <= count; number++) {
        const embedded =
          ext === 'pdf' ? await embeddedText(run, source, number) : '';
        if (embedded) {
          pages.push({ number, source: 'embedded', text: embedded });
          continue;
        }
        const { text, tsv } = await recognize(
          await pageImage(number, '2600', true),
        );
        if (templates.some((rule) => rule.page === number))
          layouts.set(number, layoutFromTsv(tsv));
        pages.push({
          number,
          source: 'ocr',
          text,
          lowConfidenceWords: lowConfidenceWords(tsv),
        });
      }
      const matching = matchingDocumentTemplates(
        templates,
        detectDocumentType(pages),
        pages,
      );
      const templateValues: Record<string, TemplateValue> = {};
      for (const rule of matching) {
        let layout = layouts.get(rule.page);
        if (!layout) {
          const { tsv } = await recognize(
            await pageImage(rule.page, '2600', true),
          );
          layout = layoutFromTsv(tsv);
          layouts.set(rule.page, layout);
        }
        const value = extractTemplateValue(rule, layout);
        if (value) templateValues[rule.field] = value;
      }
      return {
        pages,
        templateValues,
        templateReview: matching.map((rule) => rule.field),
      };
    },
  );
}

export async function learnDocumentTemplate(
  request: Request,
  language: DocumentLanguage,
  limits: DocumentLimits,
  rule: DocumentTemplateInput,
) {
  return withDocument(
    request,
    'teach',
    limits,
    async ({ source, ext, run, pageImage }) => {
      const count =
        ext === 'pdf' ? await pdfPageCount(run, source, limits.pages) : 1;
      if (rule.page > count) throw new DocumentOcrError('NOT_FOUND', 404);
      const recognize = pageRecognizer(run, language);
      const { text, tsv } = await recognize(
        await pageImage(rule.page, '2600', true),
      );
      let supplierFound = containsDocumentText(text, rule.matchText);
      if (!supplierFound && ext === 'pdf') {
        supplierFound = containsDocumentText(
          await embeddedText(run, source, rule.page),
          rule.matchText,
        );
        if (!supplierFound && rule.page !== 1) {
          const cover =
            (await embeddedText(run, source, 1)) ||
            (await recognize(await pageImage(1, '2600', true))).text;
          supplierFound = containsDocumentText(cover, rule.matchText);
        }
      }
      if (!supplierFound)
        throw new DocumentOcrError('TEMPLATE_SUPPLIER_MISSING', 422);
      const layout = layoutFromTsv(tsv);
      const value = readDocumentRegion(layout, rule.region);
      if (!value) throw new DocumentOcrError('TEMPLATE_REGION_EMPTY', 422);
      const anchor = rule.anchor
        ? findDocumentAnchor(layout, rule.anchor)
        : undefined;
      if (rule.anchor && !anchor)
        throw new DocumentOcrError('TEMPLATE_ANCHOR_MISSING', 422);
      return {
        value,
        rule: anchor
          ? {
              ...rule,
              anchorOffset: {
                x: rule.region.x - anchor.x,
                y: rule.region.y - anchor.y,
              },
            }
          : rule,
      };
    },
  );
}

import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  documentLanguages,
  maxDocumentBytes,
  maxDocumentPages,
  type DocumentLanguage,
} from './document-ai-options';

const execute = promisify(execFile);
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
let busy = false;

export class DocumentOcrError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

async function readDocument(request: Request) {
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
          timeout: 18000,
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

export async function extractDocument(
  request: Request,
  language: DocumentLanguage,
) {
  const bytes = await readDocument(request);
  const ext = extension(bytes);
  if (busy) throw new DocumentOcrError('BUSY', 503);
  busy = true;
  try {
    const directory = await mkdtemp(join(tmpdir(), 'taxsolutions-ocr-'));
    try {
      const source = join(directory, `input.${ext}`);
      await writeFile(source, bytes, { mode: 0o600 });
      const signal = AbortSignal.any([
        request.signal,
        AbortSignal.timeout(90000),
      ]);
      const run = (tool: string, args: string[]) =>
        runTool(directory, tool, args, signal);
      let languagesChecked = false;
      const selected = documentLanguages[language];
      const ocr = async (image: string) => {
        if (!languagesChecked) {
          const installed = (await run('tesseract', ['--list-langs'])).split(
            /\r?\n/,
          );
          if (selected.split('+').some((name) => !installed.includes(name)))
            throw new DocumentOcrError('OCR_UNAVAILABLE', 503);
          languagesChecked = true;
        }
        return run('tesseract', [
          image,
          'stdout',
          '-l',
          selected,
          '--psm',
          '3',
        ]);
      };
      if (ext !== 'pdf') {
        return [{ number: 1, source: 'ocr', text: (await ocr(source)).trim() }];
      }

      const info = await run('pdfinfo', [source]);
      const count = Number(/^Pages:\s+(\d+)$/m.exec(info)?.[1]);
      if (!Number.isSafeInteger(count) || count < 1)
        throw new DocumentOcrError('UNREADABLE', 422);
      if (count > maxDocumentPages)
        throw new DocumentOcrError('TOO_MANY_PAGES', 422);

      const pages = [];
      for (let number = 1; number <= count; number++) {
        const range = ['-f', String(number), '-l', String(number)];
        const embedded = (
          await run('pdftotext', [
            ...range,
            '-layout',
            '-enc',
            'UTF-8',
            source,
            '-',
          ])
        ).trim();
        if (embedded) {
          pages.push({ number, source: 'embedded', text: embedded });
          continue;
        }
        const image = join(directory, 'page');
        await run('pdftoppm', [
          ...range,
          '-singlefile',
          '-scale-to',
          '2600',
          '-gray',
          '-png',
          source,
          image,
        ]);
        pages.push({
          number,
          source: 'ocr',
          text: (await ocr(image + '.png')).trim(),
        });
      }
      return pages;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  } finally {
    busy = false;
  }
}

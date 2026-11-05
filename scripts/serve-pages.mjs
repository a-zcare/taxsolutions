import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('.pages-build/out');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/taxsolutions/')) {
      res.writeHead(404).end();
      return;
    }
    let file = path.resolve(
      root,
      decodeURIComponent(url.pathname.slice('/taxsolutions/'.length)),
    );
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    const info = await stat(file);
    if (info.isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        res.writeHead(301, { Location: url.pathname + '/' }).end();
        return;
      }
      file = path.join(file, 'index.html');
    }
    const body = await readFile(file);
    res
      .writeHead(200, {
        'Content-Type': types[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      .end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(8087, '127.0.0.1', () =>
  console.log('Static preview: http://127.0.0.1:8087/taxsolutions/'),
);

#!/usr/bin/env node
import { createServer } from 'http';
import { createReadStream, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 48123;

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

createServer((req, res) => {
  let pathname = new URL(req.url, 'http://x').pathname;
  if (pathname === '/') pathname = '/index.html';

  const file = join(ROOT, pathname);

  let stat;
  try { stat = statSync(file); } catch {
    res.writeHead(404); res.end('Not found'); return;
  }

  if (stat.isDirectory()) {
    const idx = join(file, 'index.html');
    try { statSync(idx); } catch {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    createReadStream(idx).pipe(res);
    return;
  }

  const mime = MIME[extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`client → http://localhost:${PORT}`));

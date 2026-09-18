import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/** Serves a Vite-built SPA: static files as-is, everything else falls back to index.html. */
export function serveStatic(root: string, req: IncomingMessage, res: ServerResponse): boolean {
  if (!existsSync(root)) return false;
  const url = new URL(req.url ?? '/', 'http://localhost');
  let filePath = path.join(root, decodeURIComponent(url.pathname));

  if (!filePath.startsWith(root)) {
    res.writeHead(403).end('Forbidden');
    return true;
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = path.join(root, 'index.html');
  }
  if (!existsSync(filePath)) return false;

  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
  return true;
}

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
http.createServer((req,res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (!['/','/index.html'].includes(pathname)) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control':'no-store' });
  fs.createReadStream(path.join(root,'index.html')).pipe(res);
}).listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));

// Tiny static dev server (no dependencies): node tools/serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const port = Number(process.argv[2] || 8765);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
http.createServer((req, res) => {
  // dev-only asset save used by tools/rig.html: POST /__save?path=assets/... with the raw body
  if (req.method === 'POST' && req.url.startsWith('/__save')) {
    const target = decodeURIComponent(new URL(req.url, 'http://x').searchParams.get('path') || '');
    const file = path.join(root, target);
    if (!file.startsWith(path.join(root, 'assets')) || target.includes('..')) { res.writeHead(403); return res.end('assets only'); }
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.concat(chunks)); res.writeHead(200); res.end('saved ' + target); });
    return;
  }
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));

// Serves the built site from dist/ and the bill inquiry proxy on one origin, in place of `astro preview`, which can't proxy.

import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { billApi } from './bill-api.mjs';
import { config } from './config.mjs';

const root = fileURLToPath(new URL('../dist/', import.meta.url)).replace(/[\\/]$/, '');
const port = Number(process.env.PORT) || 4393;
const host = process.env.HOST || '127.0.0.1';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

// The same hosts the Vite servers accept: this machine and the tunnel.
const allowedHost = (h = '') => {
  const name = h.replace(/:\d+$/, '');
  return name === '127.0.0.1' || name === 'localhost' || name.endsWith('.trycloudflare.com') || name.endsWith('.devtunnels.ms');
};

async function serveFile(req, res) {
  let path;
  try {
    path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }
  if (path !== root && !path.startsWith(root + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    let info = await stat(path);
    if (info.isDirectory()) {
      path = join(path, 'index.html');
      info = await stat(path);
    }
    res.writeHead(200, {
      'Content-Type': types[extname(path)] ?? 'application/octet-stream',
      'Content-Length': info.size,
      // Hashed build assets never change; pages always revalidate so a rebuild shows at once.
      'Cache-Control': path.includes(`${sep}_astro${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(path).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}

http
  .createServer((req, res) => {
    if (!allowedHost(req.headers.host)) {
      res.writeHead(403).end('Host not allowed');
      return;
    }
    void billApi(req, res, () => {
      if (req.method === 'GET' || req.method === 'HEAD') void serveFile(req, res);
      else res.writeHead(405).end('Method not allowed');
    });
  })
  .listen(port, host, () => console.log(`Serving dist/ and ${config.apiBase} bill inquiry at http://${host}:${port}`));

// Take the three dashboard screenshots with headless Chromium (Playwright).
// Serves the built out/ directory on localhost, screenshots the board, a
// protocol detail view, and a filtered view at 1440x900.
import { chromium } from '/tmp/pw/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OUT = path.resolve(__dirname, 'out');
const SHOTS = path.resolve(__dirname, 'screenshots');

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(OUT, url === '/' ? 'dashboard/index.html' : url);
  if (!file.startsWith(OUT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(8123, '127.0.0.1', r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const shots = [
    ['1-board.png', '/dashboard/index.html'],
    ['2-detail.png', '/dashboard/index.html?slug=steakhouse-financial'],
    ['3-filtered.png', '/dashboard/index.html?cat=Risk%20Curators'],
  ];
  for (const [name, url] of shots) {
    await page.goto('http://127.0.0.1:8123' + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SHOTS, name) });
    const size = fs.statSync(path.join(SHOTS, name)).size;
    console.log(name, size, 'bytes');
  }
  await browser.close();
  server.close();
  console.log('done');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });

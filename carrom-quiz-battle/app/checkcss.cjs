const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const DIST = path.join(__dirname, 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
(async () => {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    fs.readFile(path.join(DIST, p.slice(1)), (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('nf');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise((r) => srv.listen(5201, r));
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('cqb-theme', 'kingdom'));
  const page = await ctx.newPage();
  await page.goto('http://localhost:5201/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Start battle' }).click();
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const out = { theme: document.body.dataset.theme, stops: {} };
    for (const cls of ['wood-hi', 'wood-mid', 'wood-lo', 'felt-hi', 'frame-line']) {
      const el = document.querySelector('.' + cls);
      if (!el) {
        out.stops[cls] = 'MISSING';
        continue;
      }
      const cs = getComputedStyle(el);
      out.stops[cls] = cs.stopColor || cs.stroke || cs.fill || '?';
    }
    return out;
  });
  console.log(JSON.stringify(info));
  await browser.close();
  srv.close();
})().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});

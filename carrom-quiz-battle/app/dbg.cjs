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
  await new Promise((r) => srv.listen(5203, r));
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 300));
  });
  await page.goto('http://localhost:5203/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log('root children:', await page.evaluate(() => document.getElementById('root').childElementCount));
  await browser.close();
  srv.close();
})().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});

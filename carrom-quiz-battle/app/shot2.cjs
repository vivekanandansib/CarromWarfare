const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const DIST = path.join(__dirname, 'dist');
const OUT = 'C:\\Users\\Sibi\\AppData\\Local\\Temp\\opencode\\shots';
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
      res.writeHead(200);
      res.end(data);
    });
  });
  await new Promise((r) => srv.listen(5202, r));
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:5202/', { waitUntil: 'networkidle' });
  console.log('title:', await page.title());
  console.log('radios:', await page.getByRole('radio').count());
  console.log('buttons:', await page.getByRole('button').count());
  await page.screenshot({ path: path.join(OUT, 'debug-start.png') });
  console.log('h1:', await page.locator('h1,h2').first().textContent().catch(() => '?'));
  await page.getByRole('radio', { name: /Classic Flick/ }).click();
  await page.getByRole('button', { name: 'Start battle' }).click();
  await page.waitForTimeout(600);
  // fire with keyboard (default aim) a few times to reach P2's turn
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4500);
    const hint = await page.locator('.board-hint').textContent().catch(() => '');
    if (/Waiting|Ravi|to play/.test(hint || '') && /Ravi/.test(hint || '')) break;
  }
  await page.screenshot({ path: path.join(OUT, 'classic-p2.png') });
  console.log('saved classic-p2.png errors:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
  srv.close();
})().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});

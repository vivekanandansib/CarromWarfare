// Serves app/dist over HTTP and screenshots quiz + classic + kingdom boards.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const DIST = path.join(__dirname, 'dist');
const OUT = 'C:\\Users\\Sibi\\AppData\\Local\\Temp\\opencode\\shots';
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

function serve(port) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(DIST, p.slice(1));
      fs.readFile(f, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('nf');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.listen(port, () => resolve(srv));
  });
}

(async () => {
  const srv = await serve(5199);
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox'],
  });
  const shot = async (page, name) => {
    await page.screenshot({ path: path.join(OUT, name) });
    console.log('saved', name);
  };

  // ---- quiz classic theme ----
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Start battle' }).click();
    await page.waitForTimeout(800);
    await shot(page, 'quiz-board.png');
    // select first coin -> dialog
    await page.locator('.coin').first().click();
    await page.waitForTimeout(600);
    await shot(page, 'quiz-dialog.png');
    console.log('errors:', errors.length ? errors.join(' | ') : 'none');
    await page.close();
  }

  // ---- kingdom theme ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript(() => localStorage.setItem('cqb-theme', 'kingdom'));
    const page = await ctx.newPage();
    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Start battle' }).click();
    await page.waitForTimeout(800);
    await shot(page, 'kingdom-board.png');
    await ctx.close();
  }

  // ---- classic flick ----
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
    await page.getByRole('radio', { name: /Classic Flick/ }).click();
    await page.getByRole('button', { name: 'Start battle' }).click();
    await page.waitForTimeout(800);
    await shot(page, 'classic-board.png');
    // drag the striker: find svg coords via board bounding box
    const box = await page.locator('svg.board').boundingBox();
    const sx = box.x + (200 / 400) * box.width;
    const sy = box.y + (312 / 400) * box.height;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx + 60, sy + 80, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(3500);
    await shot(page, 'classic-after-shot.png');
    console.log('errors:', errors.length ? errors.join(' | ') : 'none');
    await page.close();
  }

  await browser.close();
  srv.close();
  console.log('done');
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});

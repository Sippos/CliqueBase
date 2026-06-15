const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
  
  await page.goto('http://localhost:4173/community', { waitUntil: 'networkidle2' });
  console.log('Navigated to Community');
  await new Promise(r => setTimeout(r, 2000));
  
  await page.goto('http://localhost:4173/library', { waitUntil: 'networkidle2' });
  console.log('Navigated to Library');
  await new Promise(r => setTimeout(r, 2000));

  await browser.close();
})();

const { test } = require('playwright/test');

test('debug game prototype', async ({ page }) => {
  page.on('console', msg => console.log('CONSOLE', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR', err.message, err.stack));
  page.on('requestfailed', req => console.log('REQFAIL', req.url(), req.failure()?.errorText));
  await page.goto('http://localhost:4174/game/prototype/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
});

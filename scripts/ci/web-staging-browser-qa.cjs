/* INKR public staging web QA, one headless page per engine and viewport.
 * No test identities, mutations, personal data, production endpoints or JWTs.
 */
const { chromium, firefox, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.INKR_WEB_QA_URL || 'http://127.0.0.1:4173';
const out = path.resolve('web-qa-evidence');
fs.mkdirSync(out, { recursive: true });
const engines = { chromium, firefox, webkit };
const viewports = [
  { name: 'phone-360', width: 360, height: 800 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];
const results = [];

async function visibleAndEnabled(locator) {
  return (await locator.count()) > 0
    && await locator.isVisible().catch(() => false)
    && await locator.isEnabled().catch(() => false);
}

async function scenario(engineName, browser, viewport) {
  const id = engineName + '-' + viewport.name;
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: 'fr-FR',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 400));
  });
  try {
    const response = await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    assert.equal(response && response.status(), 200, id + ': web root must respond HTTP 200');
    // Expo static HTML initially includes prerendered text; during hydration
    // that DOM is removed and RootLayout may return null until fonts finish.
    // Waiting only for prerendered HTML produced a false positive at 1 second.
    await page.waitForLoadState('load', { timeout: 30000 });
    await page.waitForTimeout(3500);
    await page.waitForFunction(
      () => !!document.body && /INKR|Mara Test|Découvrir|tatouage/i.test(document.body.innerText || ''),
      null, { timeout: 45000 },
    );
    const metrics = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      textLength: document.body.innerText.length,
      focusables: document.querySelectorAll('a[href],button,input,[role=button],[role=tab]').length,
      recognizable: /INKR|Mara Test|Découvrir|tatouage/i.test(document.body.innerText),
    }));
    assert.equal(metrics.recognizable, true, id + ': no INKR public content');
    assert.ok(metrics.focusables > 0, id + ': no keyboard-focusable control');
    assert.ok(metrics.scrollWidth <= metrics.width + 8, id + ': horizontal page overflow');
    await page.screenshot({ path: path.join(out, id + '-home.png'), fullPage: false });

    let navigated = false;
    for (const locator of [
      page.getByText('Découvrir les artistes', { exact: true }).first(),
      page.getByText('Rechercher', { exact: true }).first(),
      page.getByText('Explorer les artistes', { exact: true }).first(),
    ]) {
      if (await visibleAndEnabled(locator)) {
        await locator.click({ timeout: 12000 });
        navigated = true;
        break;
      }
    }
    assert.ok(navigated, id + ': no visible public Explore navigation');
    await page.getByText(/02\s*\/\s*Découvrir/i).first().waitFor({ state: 'visible', timeout: 45000 });
    await page.getByText(/2\s+artistes/i).first().waitFor({ state: 'visible', timeout: 45000 });
    await page.screenshot({ path: path.join(out, id + '-explore.png'), fullPage: false });

    const signIn = page.getByText('Se connecter', { exact: true }).first();
    assert.ok(await visibleAndEnabled(signIn), id + ': sign-in navigation unavailable');
    await signIn.click({ timeout: 12000 });
    await page.getByText(/Entrez dans/i).first().waitFor({ state: 'visible', timeout: 45000 });
    await page.screenshot({ path: path.join(out, id + '-signin.png'), fullPage: false });
    assert.deepEqual(pageErrors, [], id + ': uncaught JS exceptions');
    results.push({ id, status: 'PASS', ...metrics, pageErrors: 0 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      url: location.pathname,
      visibleText: (document.body?.innerText || '').slice(0, 1600),
      rootElementCount: document.querySelectorAll('#root, [data-reactroot]').length,
      rootHtml: (document.querySelector('#root')?.innerHTML || '').slice(0, 1800),
      fontStatus: document.fonts?.status,
      fontCount: document.fonts?.size,
      documentReadyState: document.readyState,
    })).catch((err) => ({ diagnosticError: String(err) }));
    const record = { id, status: 'FAIL', error: String(error), pageErrors, consoleErrors: consoleErrors.slice(0, 20), diagnostic };
    results.push(record);
    fs.writeFileSync(path.join(out, id + '-diagnostic.json'), JSON.stringify(record, null, 2) + '\n');
    await page.screenshot({ path: path.join(out, id + '-failure.png'), fullPage: false }).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

(async () => {
  try {
    for (const [name, engine] of Object.entries(engines)) {
      const browser = await engine.launch({ headless: true });
      try {
        for (const viewport of viewports) await scenario(name, browser, viewport);
      } finally {
        await browser.close();
      }
    }
  } catch (error) {
    console.error('Web QA failure:', error);
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(results, null, 2) + '\n');
    console.log(JSON.stringify({ passes: results.filter(r => r.status === 'PASS').length, failures: results.filter(r => r.status === 'FAIL').length, results }, null, 2));
  }
})();

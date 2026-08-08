import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { adCard, adLibraryPage } from '../support/ad-library-fixtures.js';

const AD_LIBRARY_URL =
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=lamarca&search_type=keyword_unordered';
const AD_LIBRARY_ROUTE = 'https://www.facebook.com/ads/library/**';
const VIDEO_ROUTE = 'https://video.xx.fbcdn.net/**';
const IMAGE_ROUTE = 'https://scontent.xx.fbcdn.net/**';

const BOOKMARKLET_PROTOCOL = 'javascript:';
const PANEL = '#mald-panel';
const LOG = '#mald-log';
const TOTAL = '#mald-total';
const COUNT = '#mald-count';
const START = '#mald-start';
const STOP = '#mald-stop';
const CLOSE = '#mald-close';
const MINIMUM_COPIES = '#mald-minads';
const MAXIMUM_DOWNLOADS = '#mald-max';

const RUN_TIMEOUT_MS = 30000;
const VIDEO_BYTES = 2048;
const IMAGE_BYTES = 1024;

async function readBookmarkletSource(page: Page): Promise<string> {
  await page.goto('/');
  const href = await page.locator('#dragBtn').getAttribute('href');

  return decodeURIComponent((href ?? '').slice(BOOKMARKLET_PROTOCOL.length));
}

async function serveAdLibrary(page: Page, cards: readonly string[]): Promise<void> {
  await page.route(AD_LIBRARY_ROUTE, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: adLibraryPage(cards, { resultTotal: '550' }),
    }),
  );
  await page.route(VIDEO_ROUTE, (route) =>
    route.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.alloc(VIDEO_BYTES, 1) }),
  );
  await page.route(IMAGE_ROUTE, (route) =>
    route.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.alloc(IMAGE_BYTES, 2) }),
  );
}

async function injectBookmarklet(page: Page, source: string): Promise<void> {
  await page.evaluate((code) => {
    window.eval(code);
  }, source);
  await expect(page.locator(PANEL)).toBeVisible({ timeout: 5000 });
}

function collectDownloadNames(page: Page): string[] {
  const fileNames: string[] = [];
  page.on('download', (download) => fileNames.push(download.suggestedFilename()));
  return fileNames;
}

test.describe('the bookmarklet running on the Ad Library', () => {
  test('opens the panel and shows the total of the search', async ({ page }) => {
    const source = await readBookmarkletSource(page);
    await serveAdLibrary(page, [adCard({ libraryId: '100000000000001', copiesInRotation: 3 })]);
    await page.goto(AD_LIBRARY_URL);

    await injectBookmarklet(page, source);

    await expect(page.locator(PANEL)).toContainText('Ecom Toolkit');
    await expect(page.locator(TOTAL)).toContainText('550');
    await expect(page.locator(START)).toBeEnabled();
  });

  test('downloads the creatives under the expected file names', async ({ page }) => {
    const source = await readBookmarkletSource(page);
    await serveAdLibrary(page, [
      adCard({ libraryId: '100000000000001', copiesInRotation: 4, circulationDate: '27/6/2026' }),
      adCard({ libraryId: '100000000000002', copiesInRotation: 3, circulationDate: '27/6/2026' }),
    ]);
    await page.goto(AD_LIBRARY_URL);
    await injectBookmarklet(page, source);

    const fileNames = collectDownloadNames(page);

    await page.locator(MINIMUM_COPIES).fill('0');
    await page.locator(MAXIMUM_DOWNLOADS).fill('2');
    await page.locator(START).click();

    await expect(page.locator(LOG)).toContainText('FIN.', { timeout: RUN_TIMEOUT_MS });

    expect(fileNames).toHaveLength(2);
    expect(fileNames).toContain('4_ads_27_6_26_lamarca_100000000000001.mp4');
    expect(fileNames).toContain('3_ads_27_6_26_lamarca_100000000000002.mp4');
    await expect(page.locator(COUNT)).toHaveText('2');
  });

  test('never lets the low impressions filter eat into the requested total', async ({ page }) => {
    const source = await readBookmarkletSource(page);
    await serveAdLibrary(page, [
      adCard({ libraryId: '200000000000001', lowImpressions: true }),
      adCard({ libraryId: '200000000000002', lowImpressions: true }),
      adCard({ libraryId: '200000000000003' }),
    ]);
    await page.goto(AD_LIBRARY_URL);
    await injectBookmarklet(page, source);

    const fileNames = collectDownloadNames(page);

    await page.locator(MINIMUM_COPIES).fill('0');
    await page.locator(MAXIMUM_DOWNLOADS).fill('1');
    await page.locator(START).click();

    await expect(page.locator(LOG)).toContainText('FIN.', { timeout: RUN_TIMEOUT_MS });

    expect(fileNames).toHaveLength(1);
    expect(fileNames[0]).toContain('200000000000003');
    await expect(page.locator(LOG)).toContainText('saltados por pocas impresiones: 2');
  });

  test('reports the error when Meta rejects the download', async ({ page }) => {
    const source = await readBookmarkletSource(page);
    await serveAdLibrary(page, [adCard({ libraryId: '300000000000001' })]);
    await page.unroute(VIDEO_ROUTE);
    await page.route(VIDEO_ROUTE, (route) => route.fulfill({ status: 403 }));
    await page.goto(AD_LIBRARY_URL);
    await injectBookmarklet(page, source);

    await page.locator(MINIMUM_COPIES).fill('0');
    await page.locator(MAXIMUM_DOWNLOADS).fill('1');
    await page.locator(START).click();

    await expect(page.locator(LOG)).toContainText('FIN.', { timeout: RUN_TIMEOUT_MS });
    await expect(page.locator(LOG)).toContainText('HTTP 403');
    await expect(page.locator(LOG)).toContainText('link vencido o sin acceso');
    await expect(page.locator(LOG)).toContainText('No se bajó ningún archivo');
  });

  test('cuts the run when the stop button is pressed', async ({ page }) => {
    const source = await readBookmarkletSource(page);
    await serveAdLibrary(
      page,
      Array.from({ length: 8 }, (_unused, index) => adCard({ libraryId: `40000000000000${index}` })),
    );
    await page.goto(AD_LIBRARY_URL);
    await injectBookmarklet(page, source);

    await page.locator(MINIMUM_COPIES).fill('0');
    await page.locator(MAXIMUM_DOWNLOADS).fill('0');
    await page.locator(START).click();

    await expect(page.locator(START)).toContainText('Descargando');
    await page.locator(STOP).click();

    await expect(page.locator(LOG)).toContainText('detenido', { timeout: 15000 });
    await expect(page.locator(START)).toContainText('Iniciar');
  });

  test('takes the panel off the page when it is closed', async ({ page }) => {
    const source = await readBookmarkletSource(page);
    await serveAdLibrary(page, [adCard({ libraryId: '500000000000001' })]);
    await page.goto(AD_LIBRARY_URL);
    await injectBookmarklet(page, source);

    await page.locator(CLOSE).click();

    await expect(page.locator(PANEL)).toHaveCount(0);
  });

  test('survives a search page that has no ads at all', async ({ page }) => {
    const source = await readBookmarkletSource(page);
    await serveAdLibrary(page, []);
    await page.goto(AD_LIBRARY_URL);
    await injectBookmarklet(page, source);

    await page.locator(MAXIMUM_DOWNLOADS).fill('1');
    await page.locator(START).click();

    await expect(page.locator(LOG)).toContainText('tarjetas detectadas en pantalla: 0', {
      timeout: RUN_TIMEOUT_MS,
    });
    await expect(page.locator(LOG)).toContainText('No detecté ninguna tarjeta');
  });
});

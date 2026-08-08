import { test, expect } from '@playwright/test';

const IS_LIVE = process.env['ADLIB_LIVE'] === '1';
const STORAGE_STATE = process.env['ADLIB_STORAGE'];
const SEARCHED_BRAND = process.env['ADLIB_QUERY'] ?? 'nike';

const LIVE_URL = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(SEARCHED_BRAND)}&search_type=keyword_unordered&media_type=all`;

const BOOKMARKLET_PROTOCOL = 'javascript:';
const CONSENT_BUTTON = /rechazar|decline|solo.*necesarias|optional/i;
const RESULTS_MARKER = /Identificador de la biblioteca|Library ID/i;

const TEST_TIMEOUT_MS = 120_000;
const RESULTS_TIMEOUT_MS = 30_000;
const CONSENT_TIMEOUT_MS = 5000;
const PANEL_TIMEOUT_MS = 10_000;

test.describe('the real Ad Library, opt in', () => {
  test.skip(!IS_LIVE, 'Needs ADLIB_LIVE=1. Kept out of CI because it depends on a third party site.');
  test.describe.configure({ mode: 'serial', retries: 1 });

  if (STORAGE_STATE) test.use({ storageState: STORAGE_STATE });

  test('still recognises the DOM Meta ships today', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS);

    await page.goto('/');
    const href = await page.locator('#dragBtn').getAttribute('href');
    const source = decodeURIComponent((href ?? '').slice(BOOKMARKLET_PROTOCOL.length));

    await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded' });

    const declineButton = page.getByRole('button', { name: CONSENT_BUTTON }).first();
    const consentWallIsUp = await declineButton
      .isVisible({ timeout: CONSENT_TIMEOUT_MS })
      .catch(() => false);
    if (consentWallIsUp) await declineButton.click().catch(() => undefined);

    const hasResults = await page
      .getByText(RESULTS_MARKER)
      .first()
      .isVisible({ timeout: RESULTS_TIMEOUT_MS })
      .catch(() => false);

    test.skip(
      !hasResults,
      `Meta returned no results for "${SEARCHED_BRAND}" (login wall, block, or a search without ads).`,
    );

    await page.evaluate((code) => {
      window.eval(code);
    }, source);
    await expect(page.locator('#mald-panel')).toBeVisible({ timeout: PANEL_TIMEOUT_MS });

    await page.locator('#mald-minads').fill('0');
    await page.locator('#mald-max').fill('1');
    await page.locator('#mald-start').click();

    await expect(page.locator('#mald-log')).toContainText(
      /tarjetas detectadas en pantalla: [1-9]/,
      { timeout: RESULTS_TIMEOUT_MS },
    );
  });
});

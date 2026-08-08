import { test, expect } from '@playwright/test';

const DRAG_BUTTON = '#dragBtn';
const COPY_BUTTON = '#copyBm';
const REPO_LINK = '#repoLink';
const BOOKMARKLET_PROTOCOL = 'javascript:';

test.describe('the generator page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads without a single console error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.reload();
    await expect(page.locator(DRAG_BUTTON)).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('offers a draggable button holding a valid bookmarklet', async ({ page }) => {
    const href = await page.locator(DRAG_BUTTON).getAttribute('href');

    expect(href).toMatch(/^javascript:/);

    const source = decodeURIComponent((href ?? '').slice(BOOKMARKLET_PROTOCOL.length));

    expect(source).toContain('Identificador de la biblioteca');
    expect(source).not.toContain('__CFG__');
    expect(source).not.toContain('__AUTOSTART__');

    const compiles = await page.evaluate((code) => {
      try {
        new Function(code);
        return true;
      } catch {
        return false;
      }
    }, source);

    expect(compiles).toBe(true);
  });

  test('embeds the default configuration in the bookmarklet', async ({ page }) => {
    const href = await page.locator(DRAG_BUTTON).getAttribute('href');
    const decoded = decodeURIComponent(href ?? '');

    expect(decoded).toContain('"minAds":2');
    expect(decoded).toContain('"maxCards":50');
    expect(decoded).toContain('"skipLow":true');
  });

  test('copies the bookmarklet to the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.locator(COPY_BUTTON).click();
    await expect(page.locator(COPY_BUTTON)).toHaveText(/Copiado/);

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());

    expect(clipboard).toMatch(/^javascript:/);
    expect(clipboard).toBe(await page.locator(DRAG_BUTTON).getAttribute('href'));
  });

  test('goes nowhere when the button is clicked instead of dragged', async ({ page }) => {
    const urlBeforeClick = page.url();

    await page.locator(DRAG_BUTTON).click();

    expect(page.url()).toBe(urlBeforeClick);
  });

  test('explains both ways of using the toolkit', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /tienda Shopify/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Ad Library/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /nombran los archivos/i })).toBeVisible();
  });

  test('points the footer at the repository and calls the project open source', async ({ page }) => {
    const repository = page.locator(REPO_LINK);

    await expect(repository).toBeVisible();
    await expect(repository).toHaveAttribute(
      'href',
      'https://github.com/vilaslautaro/ecom-toolkit',
    );
    await expect(page.locator('.foot').last()).toContainText('open source');
    await expect(repository).toHaveAttribute('rel', /noopener/);
  });

  test('works on a phone sized viewport without overflowing sideways', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator(DRAG_BUTTON)).toBeVisible();

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );

    expect(overflows).toBe(false);
  });
});

import { test, expect } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { storefrontMarkupFor } from '../support/shopify-fixtures.js';
import {
  readCapturedBestSelling,
  readCapturedCatalogue,
} from '../support/captured-shopify-fixtures.js';
import type { CapturedProduct } from '../support/captured-shopify-fixtures.js';

const CAPTURED_STORE_SLUG = 'allbirds';
const CATALOGUE = readCapturedCatalogue(CAPTURED_STORE_SLUG);
const BEST_SELLING = readCapturedBestSelling(CAPTURED_STORE_SLUG);

const STORE_ORIGIN = 'https://tienda-de-prueba.com';
const STORE_URL = `${STORE_ORIGIN}/`;
const STORE_ROUTE = `${STORE_ORIGIN}/**`;
const SHOPIFY_CDN_ROUTE = 'https://cdn.shopify.com/**';
const THEME_SCRIPT_URL = 'https://cdn.shopify.com/s/files/1/0001/t/1/assets/theme.js';

const PRODUCTS_PATH = '/products.json';
const BEST_SELLING_PATH = '/collections/all';

const BOOKMARKLET_PROTOCOL = 'javascript:';
const PANEL = '#mald-panel';
const CLOSE = '#mald-close';
const PRODUCT_ROW = '#mald-panel a[href*="/products/"]';
const THUMBNAIL = '#mald-panel img';
const EXTERNAL_LINK = '#mald-panel a[target="_blank"]';
const AD_LIBRARY_LINK = '#mald-panel a[href*="facebook.com/ads/library"]';
const INLINE_HANDLER = '#mald-panel [onerror], #mald-panel [onload], #mald-panel [onclick]';

const BEST_SELLER_COUNT = 3;
const PANEL_TIMEOUT_MS = 10000;
const SECOND_INJECTION_SETTLE_MS = 2500;
const NOT_FOUND = 404;
const OK = 200;

const TRANSPARENT_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const productsByHandle = new Map(CATALOGUE.products.map((product) => [product.handle, product]));

const rankedProducts: readonly CapturedProduct[] = BEST_SELLING.handles
  .map((handle) => productsByHandle.get(handle))
  .filter((product): product is CapturedProduct => product !== undefined)
  .slice(0, BEST_SELLER_COUNT);

function listedPrice(product: CapturedProduct): string {
  return product.variants[0]?.price ?? '';
}

function thumbnailSource(product: CapturedProduct): string {
  return product.images[0]?.src ?? '';
}

function sellablePrices(): readonly number[] {
  return CATALOGUE.products
    .flatMap((product) => product.variants.map((variant) => Number.parseFloat(variant.price)))
    .filter((price) => price > 0);
}

function publicationTimes(): readonly number[] {
  return CATALOGUE.products.map((product) => new Date(product.published_at).getTime());
}

interface StoreOptions {
  readonly looksShopify?: boolean;
  readonly productsStatus?: number;
}

function storeHtml(looksShopify: boolean): string {
  const themeScript = looksShopify ? `<script src="${THEME_SCRIPT_URL}"></script>` : '';

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">`
    + `<title>Tienda de Prueba</title>${themeScript}</head>`
    + `<body><h1>Tienda de Prueba</h1></body></html>`;
}

function fulfillStoreRequest(route: Route, options: Required<StoreOptions>): Promise<void> {
  const { pathname } = new URL(route.request().url());

  if (pathname === PRODUCTS_PATH) {
    if (options.productsStatus !== OK) {
      return route.fulfill({
        status: options.productsStatus,
        contentType: 'text/plain; charset=utf-8',
        body: 'Not found',
      });
    }

    return route.fulfill({
      status: OK,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(CATALOGUE),
    });
  }

  if (pathname === BEST_SELLING_PATH) {
    return route.fulfill({
      status: OK,
      contentType: 'text/html; charset=utf-8',
      body: storefrontMarkupFor(BEST_SELLING.handles),
    });
  }

  return route.fulfill({
    status: OK,
    contentType: 'text/html; charset=utf-8',
    body: storeHtml(options.looksShopify),
  });
}

async function serveStore(page: Page, options: StoreOptions = {}): Promise<void> {
  const settings: Required<StoreOptions> = {
    looksShopify: options.looksShopify ?? true,
    productsStatus: options.productsStatus ?? OK,
  };

  await page.route(SHOPIFY_CDN_ROUTE, (route) =>
    route.request().url() === THEME_SCRIPT_URL
      ? route.fulfill({ status: OK, contentType: 'text/javascript; charset=utf-8', body: '' })
      : route.fulfill({ status: OK, contentType: 'image/png', body: TRANSPARENT_PIXEL_PNG }),
  );

  await page.route(STORE_ROUTE, (route) => fulfillStoreRequest(route, settings));
}

async function readBookmarkletSource(page: Page): Promise<string> {
  await page.goto('/');
  const href = await page.locator('#dragBtn').getAttribute('href');

  return decodeURIComponent((href ?? '').slice(BOOKMARKLET_PROTOCOL.length));
}

async function runBookmarklet(page: Page, source: string): Promise<void> {
  await page.evaluate((code) => {
    window.eval(code);
  }, source);
}

async function openStorePanel(page: Page, options: StoreOptions = {}): Promise<void> {
  const source = await readBookmarkletSource(page);
  await serveStore(page, options);
  await page.goto(STORE_URL);
  await runBookmarklet(page, source);

  await expect(page.locator(PANEL)).toBeVisible({ timeout: PANEL_TIMEOUT_MS });
}

async function browserDate(page: Page, isoDate: string): Promise<string> {
  return page.evaluate((iso) => new Date(iso).toLocaleDateString(), isoDate);
}

test.describe('the captured fixtures the store panel is tested against', () => {
  test('rank at least three products the captured catalogue also lists', () => {
    expect(rankedProducts).toHaveLength(BEST_SELLER_COUNT);
  });

  test('give every ranked product a price, an image and a publication date', () => {
    for (const product of rankedProducts) {
      expect(listedPrice(product)).not.toBe('');
      expect(thumbnailSource(product)).toContain('cdn.shopify');
      expect(Number.isNaN(new Date(product.published_at).getTime())).toBe(false);
    }
  });

  test('hold nothing the panel would drop as an add on, so the product count is the whole catalogue', () => {
    for (const product of CATALOGUE.products) {
      expect(Number.parseFloat(listedPrice(product))).toBeGreaterThan(0);
    }
  });
});

test.describe('the store panel running on a Shopify storefront', () => {
  test('ranks the top three with the titles the storefront reports as best selling', async ({
    page,
  }) => {
    await openStorePanel(page);

    await expect(page.locator(PANEL)).toContainText('Top 3 más vendidos');
    await expect(page.locator(PRODUCT_ROW)).toHaveCount(BEST_SELLER_COUNT);

    for (const [position, product] of rankedProducts.entries()) {
      await expect(page.locator(PRODUCT_ROW).nth(position)).toContainText(product.title);
    }
  });

  test('shows the price and the publication date the store reports for each of them', async ({
    page,
  }) => {
    await openStorePanel(page);

    for (const [position, product] of rankedProducts.entries()) {
      const row = page.locator(PRODUCT_ROW).nth(position);

      await expect(row).toContainText(listedPrice(product));
      await expect(row).toContainText(await browserDate(page, product.published_at));
    }
  });

  test('points every row at the product page of the store it is running on', async ({ page }) => {
    await openStorePanel(page);

    for (const [position, product] of rankedProducts.entries()) {
      await expect(page.locator(PRODUCT_ROW).nth(position)).toHaveAttribute(
        'href',
        `${STORE_ORIGIN}/products/${product.handle}`,
      );
    }
  });

  test('loads the thumbnails the store publishes instead of leaving broken images', async ({
    page,
  }) => {
    await openStorePanel(page);

    const thumbnails = page.locator(THUMBNAIL);
    await expect(thumbnails).toHaveCount(rankedProducts.length);

    expect(await thumbnails.evaluateAll((images: HTMLImageElement[]) =>
      images.map((image) => image.src),
    )).toEqual(rankedProducts.map(thumbnailSource));

    await expect
      .poll(() =>
        thumbnails.evaluateAll((images: HTMLImageElement[]) =>
          images.every((image) => image.naturalWidth > 0),
        ),
      )
      .toBe(true);
  });

  test('sums the catalogue up: how many products it sells and for how much', async ({ page }) => {
    await openStorePanel(page);

    const prices = sellablePrices();
    const average = prices.reduce((total, price) => total + price, 0) / prices.length;
    const panel = page.locator(PANEL);

    await expect(panel).toContainText(`Productos: ${CATALOGUE.products.length}`);
    await expect(panel).toContainText(Math.min(...prices).toFixed(2));
    await expect(panel).toContainText(Math.max(...prices).toFixed(2));
    await expect(panel).toContainText(`(prom ${average.toFixed(2)})`);
  });

  test('dates the oldest and the newest product of the catalogue', async ({ page }) => {
    await openStorePanel(page);

    const times = publicationTimes();
    const panel = page.locator(PANEL);

    await expect(panel).toContainText(
      `Primer producto: ${await browserDate(page, new Date(Math.min(...times)).toISOString())}`,
    );
    await expect(panel).toContainText(
      `Último producto: ${await browserDate(page, new Date(Math.max(...times)).toISOString())}`,
    );
  });

  test('opens every external link without handing the opener window over', async ({ page }) => {
    await openStorePanel(page);

    const relationships = await page
      .locator(EXTERNAL_LINK)
      .evaluateAll((links) => links.map((link) => link.getAttribute('rel') ?? ''));

    expect(relationships.length).toBeGreaterThan(0);
    for (const relationship of relationships) {
      expect(relationship).toContain('noopener');
    }
  });

  test('builds the whole panel without a single inline event handler attribute', async ({
    page,
  }) => {
    await openStorePanel(page);

    await expect(page.locator(INLINE_HANDLER)).toHaveCount(0);
  });

  test('takes the panel off the page when it is closed', async ({ page }) => {
    await openStorePanel(page);

    await page.locator(CLOSE).click();

    await expect(page.locator(PANEL)).toHaveCount(0);
  });

  test('mounts a single panel even if the bookmarklet is fired twice', async ({ page }) => {
    const source = await readBookmarkletSource(page);
    await serveStore(page);
    await page.goto(STORE_URL);

    await runBookmarklet(page, source);
    await expect(page.locator(PANEL)).toBeVisible({ timeout: PANEL_TIMEOUT_MS });
    await runBookmarklet(page, source);
    await page.waitForTimeout(SECOND_INJECTION_SETTLE_MS);

    await expect(page.locator(PANEL)).toHaveCount(1);
  });
});

test.describe('the store panel outside Shopify', () => {
  test('says it is not a Shopify store and still offers to look up its ads', async ({ page }) => {
    await openStorePanel(page, { looksShopify: false });

    await expect(page.locator(PANEL)).toContainText('no parece una tienda Shopify');
    await expect(page.locator(AD_LIBRARY_LINK)).toHaveAttribute(
      'href',
      /q=tienda-de-prueba\.com/,
    );
  });
});

test.describe('the store panel on a Shopify store that hides its product feed', () => {
  test('says it could not read the products and still offers to look up its ads', async ({
    page,
  }) => {
    await openStorePanel(page, { productsStatus: NOT_FOUND });

    await expect(page.locator(PANEL)).toContainText('No pude leer los productos');
    await expect(page.locator(PRODUCT_ROW)).toHaveCount(0);
    await expect(page.locator(AD_LIBRARY_LINK)).toHaveAttribute(
      'href',
      /q=tienda-de-prueba\.com/,
    );
  });
});

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { AD_LIBRARY_URL, adCard, adLibraryPage } from '../support/ad-library-fixtures.js';
import { waitForRenderingToSettle } from './rendering-settled.js';
import type { ShopifyProduct } from '../../src/bookmarklet/domain/types.js';

const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

const DRAG_BUTTON = '#dragBtn';
const PANEL = '#mald-panel';
const TOTAL = '#mald-total';
const BODY = '#mald-body';

const BOOKMARKLET_PROTOCOL = 'javascript:';
const PANEL_TIMEOUT_MS = 10000;

const AD_LIBRARY_ROUTE = 'https://www.facebook.com/ads/library/**';
const VIDEO_ROUTE = 'https://video.xx.fbcdn.net/**';
const POSTER_ROUTE = 'https://scontent.xx.fbcdn.net/**';
const VIDEO_BYTES = 2048;
const POSTER_BYTES = 1024;
const RESULT_TOTAL = '550';

const STORE_ORIGIN = 'https://tienda-demo.myshopify.com';
const STORE_ROUTE = `${STORE_ORIGIN}/**`;
const THUMBNAIL_ROUTE = 'https://cdn.shopify.com/**';
const PRODUCTS_ENDPOINT = '/products.json';
const BEST_SELLING_ENDPOINT = '/collections/all';
const STORE_CURRENCY = 'ARS';

const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
const PNG_CONTENT_TYPE = 'image/png';

const THUMBNAIL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOwcgwAAAGEAMwsxKtDAAAAAElFTkSuQmCC';

const STORE_PRODUCTS: readonly ShopifyProduct[] = [
  {
    id: 8100000000001,
    title: 'Lámpara de escritorio LED',
    handle: 'lampara-escritorio-led',
    published_at: '2024-01-23T12:00:00Z',
    variants: [{ id: 4100000000001, price: '214999.99' }],
    images: [{ src: 'https://cdn.shopify.com/s/files/1/lampara.png' }],
  },
  {
    id: 8100000000002,
    title: 'Mochila antirrobo con puerto USB',
    handle: 'mochila-antirrobo',
    published_at: '2025-05-10T12:00:00Z',
    variants: [{ id: 4100000000002, price: '152240.00' }],
    images: [{ src: 'https://cdn.shopify.com/s/files/1/mochila.png' }],
  },
  {
    id: 8100000000003,
    title: 'Botella térmica de acero',
    handle: 'botella-termica-acero',
    published_at: '2025-11-02T12:00:00Z',
    variants: [{ id: 4100000000003, price: '89990.00' }],
    images: [{ src: 'https://cdn.shopify.com/s/files/1/botella.png' }],
  },
  {
    id: 8100000000004,
    title: 'Set de organizadores de cajón',
    handle: 'set-organizadores-cajon',
    published_at: '2026-08-06T12:00:00Z',
    variants: [{ id: 4100000000004, price: '15225.00' }],
    images: [{ src: 'https://cdn.shopify.com/s/files/1/organizadores.png' }],
  },
];

const BEST_SELLING_HANDLES: readonly string[] = [
  'lampara-escritorio-led',
  'mochila-antirrobo',
  'botella-termica-acero',
];

function storefrontPage(): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Tienda Demo</title>
<script>window.Shopify={currency:{active:'${STORE_CURRENCY}'}}</script></head>
<body style="margin:0;background:#f2f4f7"></body></html>`;
}

function bestSellingCollectionPage(): string {
  const links = BEST_SELLING_HANDLES.map(
    (handle) => `<a href="/products/${handle}">${handle}</a>`,
  ).join('');

  return `<!doctype html><html lang="es"><body>${links}</body></html>`;
}

async function readBookmarkletSource(page: Page): Promise<string> {
  await page.goto('/');
  const href = await page.locator(DRAG_BUTTON).getAttribute('href');

  return decodeURIComponent((href ?? '').slice(BOOKMARKLET_PROTOCOL.length));
}

async function injectBookmarklet(page: Page, source: string): Promise<void> {
  await page.evaluate((code) => {
    window.eval(code);
  }, source);
  await expect(page.locator(PANEL)).toBeVisible({ timeout: PANEL_TIMEOUT_MS });
}

async function serveAdLibrary(page: Page): Promise<void> {
  const cards = [
    adCard({ libraryId: '100000000000001', copiesInRotation: 7 }),
    adCard({ libraryId: '100000000000002', copiesInRotation: 4 }),
  ];

  await page.route(AD_LIBRARY_ROUTE, (route) =>
    route.fulfill({
      status: 200,
      contentType: HTML_CONTENT_TYPE,
      body: adLibraryPage(cards, { resultTotal: RESULT_TOTAL }),
    }),
  );
  await page.route(VIDEO_ROUTE, (route) =>
    route.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.alloc(VIDEO_BYTES, 1) }),
  );
  await page.route(POSTER_ROUTE, (route) =>
    route.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.alloc(POSTER_BYTES, 2) }),
  );
}

async function serveShopifyStore(page: Page): Promise<void> {
  await page.route(STORE_ROUTE, async (route) => {
    const { pathname } = new URL(route.request().url());

    if (pathname === PRODUCTS_ENDPOINT) {
      await route.fulfill({
        status: 200,
        contentType: JSON_CONTENT_TYPE,
        body: JSON.stringify({ products: STORE_PRODUCTS }),
      });
      return;
    }

    if (pathname === BEST_SELLING_ENDPOINT) {
      await route.fulfill({
        status: 200,
        contentType: HTML_CONTENT_TYPE,
        body: bestSellingCollectionPage(),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: HTML_CONTENT_TYPE, body: storefrontPage() });
  });

  await page.route(THUMBNAIL_ROUTE, (route) =>
    route.fulfill({
      status: 200,
      contentType: PNG_CONTENT_TYPE,
      body: Buffer.from(THUMBNAIL_PNG_BASE64, 'base64'),
    }),
  );
}

test.describe('the panels the bookmarklet injects', () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test('renders the Ad Library panel as approved', async ({ page }) => {
    const source = await readBookmarkletSource(page);
    await serveAdLibrary(page);
    await page.goto(AD_LIBRARY_URL);
    await injectBookmarklet(page, source);

    await expect(page.locator(TOTAL)).toContainText(RESULT_TOTAL);
    await waitForRenderingToSettle(page);

    await expect(page.locator(PANEL)).toHaveScreenshot('ad-library-panel.png');
  });

  test('renders the Shopify store panel as approved', async ({ page }) => {
    const source = await readBookmarkletSource(page);
    await serveShopifyStore(page);
    await page.goto(`${STORE_ORIGIN}/`);
    await injectBookmarklet(page, source);

    await expect(page.locator(BODY)).toContainText('Top 3 más vendidos');
    await expect(page.locator(BODY)).toContainText('Primer producto');
    await waitForRenderingToSettle(page);

    await expect(page.locator(PANEL)).toHaveScreenshot('store-panel.png');
  });
});

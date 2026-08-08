import { describe, it, expect, afterEach } from 'vitest';
import { buildStorePanel } from '../../src/bookmarklet/shopify/shopify-panel.js';
import type { ShopifyProduct } from '../../src/bookmarklet/domain/types.js';
import { shopifyProduct, storefrontMarkupFor } from '../support/shopify-fixtures.js';
import { closeOpenPages, createPageEnvironment } from '../support/page-environment.js';
import type { PageEnvironment, StubbedRoutes } from '../support/page-environment.js';
import { waitFor } from '../support/wait-for.js';

afterEach(closeOpenPages);

const STORE_URL = 'https://lamarca.com/';
const SHOPIFY_SCRIPT = '<script src="https://cdn.shopify.com/x.js"></script>';
const PANEL_SELECTOR = '#mald-panel';
const PRODUCT_LINK_SELECTOR = 'a[href*="/products/"]';
const AD_LIBRARY_LINK_SELECTOR = 'a[href*="facebook.com/ads/library"]';
const DEFAULT_BEST_SELLING = ['estrella', 'segundo', 'tercero'];

const CATALOGUE: readonly ShopifyProduct[] = [
  shopifyProduct({
    id: 1,
    title: 'Producto Estrella',
    handle: 'estrella',
    price: '214999.99',
    publishedAt: '2024-01-23T10:00:00Z',
    imageUrl: 'https://cdn.shopify.com/estrella.jpg',
  }),
  shopifyProduct({
    id: 2,
    title: 'Segundo Mas Vendido',
    handle: 'segundo',
    price: '152240.00',
    publishedAt: '2025-05-10T10:00:00Z',
    imageUrl: 'https://cdn.shopify.com/segundo.jpg',
  }),
  shopifyProduct({
    id: 3,
    title: 'Tercero',
    handle: 'tercero',
    price: '99000.00',
    publishedAt: '2026-08-06T10:00:00Z',
  }),
  shopifyProduct({
    id: 4,
    title: 'Otro',
    handle: 'otro',
    price: '15225.00',
    publishedAt: '2025-02-01T10:00:00Z',
  }),
  shopifyProduct({ id: 5, title: 'Seguro de envio', handle: 'seguro-de-envio', price: '500.00' }),
  shopifyProduct({ id: 6, title: 'Producto regalo', handle: 'regalo', price: '0.00' }),
];

function openStore(isShopify = true, body = ''): PageEnvironment {
  const environment = createPageEnvironment({
    url: STORE_URL,
    html: `<!doctype html><html><body>${isShopify ? SHOPIFY_SCRIPT : ''}${body}</body></html>`,
  });
  if (isShopify) window.Shopify = { currency: { active: 'ARS' } };
  return environment;
}

function storeRoutes(bestSelling: readonly string[] = DEFAULT_BEST_SELLING): StubbedRoutes {
  return {
    'products.json': { json: { products: CATALOGUE } },
    'collections/all': { text: storefrontMarkupFor(bestSelling) },
    default: { byteSize: 1024, contentType: 'image/jpeg' },
  };
}

async function renderPanel(bestSelling?: readonly string[]) {
  const environment = openStore();
  environment.stubFetch(storeRoutes(bestSelling));
  await buildStorePanel();

  const panel = environment.requireElement(PANEL_SELECTOR);

  return { environment, panel, text: panel.textContent ?? '' };
}

describe('buildStorePanel on a Shopify store', () => {
  it('lists the three best sellers in the order the storefront ranks them', async () => {
    const { panel } = await renderPanel();

    const titles = [...panel.querySelectorAll(PRODUCT_LINK_SELECTOR)].map(
      (link) => link.textContent ?? '',
    );

    expect(titles[0]).toContain('Producto Estrella');
    expect(titles[1]).toContain('Segundo Mas Vendido');
    expect(titles[2]).toContain('Tercero');
  });

  it('leaves add ons out of the product count', async () => {
    const { text } = await renderPanel();

    expect(text).toContain('Productos: 4');
  });

  it('builds the price range from real products and ignores the shipping add on', async () => {
    const { text } = await renderPanel();

    expect(text).toContain('15225.00');
    expect(text).toContain('214999.99');
    expect(text).not.toContain('500.00');
  });

  it('shows the currency the store publishes', async () => {
    const { text } = await renderPanel();

    expect(text).toContain('ARS');
  });

  it('shows when the first and the last product were published', async () => {
    const { text } = await renderPanel();

    expect(text).toContain('Primer producto');
    expect(text).toContain('Último producto');
  });

  it('links to the ad library search for this store', async () => {
    const { panel } = await renderPanel();

    const link = panel.querySelector(AD_LIBRARY_LINK_SELECTOR);

    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toContain('q=lamarca.com');
  });

  it('completes the top three with other products when best selling returns fewer', async () => {
    const { panel } = await renderPanel(['estrella']);

    expect(panel.querySelectorAll(PRODUCT_LINK_SELECTOR)).toHaveLength(3);
  });

  it('offers the ad library anyway when the store hides its product feed', async () => {
    const environment = openStore();
    environment.stubFetch({ 'products.json': { status: 404 }, default: { text: '' } });

    await buildStorePanel();
    const panel = environment.requireElement(PANEL_SELECTOR);

    expect(panel.textContent).toContain('No pude leer los productos');
    expect(panel.querySelector(AD_LIBRARY_LINK_SELECTOR)).not.toBeNull();
  });

  it('mounts a single panel even if the bookmarklet is fired twice', async () => {
    const environment = openStore();
    environment.stubFetch(storeRoutes());

    await buildStorePanel();
    await buildStorePanel();

    expect(environment.document.querySelectorAll(PANEL_SELECTOR)).toHaveLength(1);
  });

  it('closes the panel when the close control is clicked', async () => {
    const { environment, panel } = await renderPanel();

    panel.querySelector<HTMLElement>('#mald-close')?.click();

    expect(environment.document.querySelectorAll(PANEL_SELECTOR)).toHaveLength(0);
  });

  it('downloads the page images from its own button and reports progress underneath', async () => {
    const environment = openStore(true, '<img src="https://cdn.shopify.com/foto.jpg" data-natural-width="900">');
    environment.stubFetch(storeRoutes());
    await buildStorePanel();

    environment.document.querySelector<HTMLButtonElement>('#mald-imgs')?.click();
    await waitFor('the images button to report the batch as finished', () =>
      (environment.document.querySelector('#mald-imgstat')?.textContent ?? '').includes('Listo'),
    );

    expect(environment.downloads.map((download) => download.fileName)).toEqual([
      'img_1_foto.jpg',
    ]);
  });
});

describe('buildStorePanel outside Shopify', () => {
  it('says it is not a Shopify store and still offers to look up its ads', async () => {
    const environment = openStore(false);
    environment.stubFetch({ default: { text: '' } });

    await buildStorePanel();
    const panel = environment.requireElement(PANEL_SELECTOR);

    expect(panel.textContent).toContain('no parece una tienda Shopify');
    expect(panel.querySelector(AD_LIBRARY_LINK_SELECTOR)).not.toBeNull();
  });

  it('does not ask the store for products it already knows it cannot read', async () => {
    const environment = openStore(false);
    const requestedUrls = environment.stubFetch({ default: { text: '' } });

    await buildStorePanel();

    expect(requestedUrls).toHaveLength(0);
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import {
  fetchAllProducts,
  fetchBestSellingHandles,
  isShopifyStore,
  storeCurrency,
} from '../../src/bookmarklet/shopify/shopify-api.js';
import type { ShopifyProduct } from '../../src/bookmarklet/domain/types.js';
import { shopifyProduct, storefrontMarkupFor } from '../support/shopify-fixtures.js';
import { closeOpenPages, createPageEnvironment } from '../support/page-environment.js';
import type { PageEnvironment } from '../support/page-environment.js';

afterEach(closeOpenPages);

const STORE_ORIGIN = 'https://lamarca.com';
const STORE_URL = `${STORE_ORIGIN}/`;
const SHOPIFY_SCRIPT = '<script src="https://cdn.shopify.com/x.js"></script>';
const PRODUCTS_PER_PAGE = 250;

function openStore(body = ''): PageEnvironment {
  return createPageEnvironment({
    url: STORE_URL,
    html: `<!doctype html><html><body>${body}</body></html>`,
  });
}

function productsPage(count: number, handlePrefix: string): readonly ShopifyProduct[] {
  return Array.from({ length: count }, (_unused, index) =>
    shopifyProduct({
      id: index + 1,
      title: `Producto ${index + 1}`,
      handle: `${handlePrefix}-${index + 1}`,
    }),
  );
}

describe('isShopifyStore', () => {
  it('recognises a store by the global object the platform injects', () => {
    openStore();
    window.Shopify = { currency: { active: 'ARS' } };

    expect(isShopifyStore()).toBe(true);
  });

  it('recognises a store by the assets it loads from the Shopify CDN', () => {
    openStore(SHOPIFY_SCRIPT);

    expect(isShopifyStore()).toBe(true);
  });

  it('says no on a page with neither the global object nor the CDN assets', () => {
    openStore('<p>una landing cualquiera</p>');

    expect(isShopifyStore()).toBe(false);
  });
});

describe('storeCurrency', () => {
  it('reads the active currency the store publishes', () => {
    openStore();
    window.Shopify = { currency: { active: 'ARS' } };

    expect(storeCurrency()).toBe('ARS');
  });

  it('returns an empty currency when the store publishes none', () => {
    openStore(SHOPIFY_SCRIPT);

    expect(storeCurrency()).toBe('');
  });
});

describe('fetchAllProducts', () => {
  it('stops asking for more pages as soon as one comes back short', async () => {
    const environment = openStore();
    const requestedUrls = environment.stubFetch({
      default: { json: { products: productsPage(2, 'producto') } },
    });

    const products = await fetchAllProducts(STORE_ORIGIN);

    expect(products).toHaveLength(2);
    expect(requestedUrls).toHaveLength(1);
    expect(requestedUrls[0]).toContain('/products.json?limit=250&page=1');
  });

  it('keeps paginating while every page comes back full', async () => {
    const environment = openStore();
    const requestedUrls = environment.stubFetch({
      'page=1': { json: { products: productsPage(PRODUCTS_PER_PAGE, 'primera') } },
      default: { json: { products: productsPage(3, 'segunda') } },
    });

    const products = await fetchAllProducts(STORE_ORIGIN);

    expect(products).toHaveLength(PRODUCTS_PER_PAGE + 3);
    expect(requestedUrls).toHaveLength(2);
  });

  it('gives back what it has when the store stops answering', async () => {
    const environment = openStore();
    environment.stubFetch({
      'page=1': { json: { products: productsPage(PRODUCTS_PER_PAGE, 'primera') } },
      default: { status: 429, statusText: 'Too Many Requests' },
    });

    expect(await fetchAllProducts(STORE_ORIGIN)).toHaveLength(PRODUCTS_PER_PAGE);
  });

  it('gives back nothing when the store hides its product feed', async () => {
    const environment = openStore();
    environment.stubFetch({ default: { status: 404 } });

    expect(await fetchAllProducts(STORE_ORIGIN)).toEqual([]);
  });

  it('gives back nothing when the feed answers without a products key', async () => {
    const environment = openStore();
    environment.stubFetch({ default: { json: {} } });

    expect(await fetchAllProducts(STORE_ORIGIN)).toEqual([]);
  });
});

describe('fetchBestSellingHandles', () => {
  const knownHandles = new Set(['estrella', 'segundo', 'tercero']);
  const isKnownHandle = (handle: string): boolean => knownHandles.has(handle);

  it('reads the ranking straight from the best selling collection page', async () => {
    const environment = openStore();
    environment.stubFetch({
      'collections/all': { text: storefrontMarkupFor(['estrella', 'segundo', 'tercero']) },
    });

    expect(await fetchBestSellingHandles(STORE_ORIGIN, isKnownHandle)).toEqual([
      'estrella',
      'segundo',
      'tercero',
    ]);
  });

  it('never repeats a handle that the theme rendered more than once', async () => {
    const environment = openStore();
    environment.stubFetch({
      'collections/all': {
        text: storefrontMarkupFor(['estrella', 'estrella', 'segundo', 'tercero']),
      },
    });

    expect(await fetchBestSellingHandles(STORE_ORIGIN, isKnownHandle)).toEqual([
      'estrella',
      'segundo',
      'tercero',
    ]);
  });

  it('asks the section endpoints when the rendered page exposes too few known handles', async () => {
    const environment = openStore();
    const requestedUrls = environment.stubFetch({
      'sections=main-collection-product-grid': {
        json: {
          'main-collection-product-grid': storefrontMarkupFor([
            'estrella',
            'segundo',
            'tercero',
          ]),
        },
      },
      'collections/all': { text: storefrontMarkupFor(['de-otra-tienda']) },
    });

    expect(await fetchBestSellingHandles(STORE_ORIGIN, isKnownHandle)).toEqual([
      'estrella',
      'segundo',
      'tercero',
    ]);
    expect(requestedUrls.some((url) => url.includes('sections='))).toBe(true);
  });

  it('falls back to whatever the rendered page had when no section endpoint helps', async () => {
    const environment = openStore();
    environment.stubFetch({
      'collections/all': { text: storefrontMarkupFor(['estrella']) },
    });

    expect(await fetchBestSellingHandles(STORE_ORIGIN, isKnownHandle)).toEqual(['estrella']);
  });

  it('returns nothing when the storefront cannot be reached at all', async () => {
    const environment = openStore();
    environment.stubFetch({ default: { throws: new TypeError('Failed to fetch') } });

    expect(await fetchBestSellingHandles(STORE_ORIGIN, isKnownHandle)).toEqual([]);
  });
});

describe('fetchBestSellingHandles on a theme that links products in uppercase', () => {
  const hiutHandles = new Set(['wallet', 'hiutgiftbook', 'yb6']);
  const isHiutHandle = (handle: string): boolean => hiutHandles.has(handle);

  it('lowercases the handles so a link like hiutdenim /products/WALLET still finds its product', async () => {
    const environment = openStore();
    environment.stubFetch({
      'collections/all': { text: storefrontMarkupFor(['WALLET', 'HiutGiftBook', 'YB6']) },
    });

    expect(await fetchBestSellingHandles(STORE_ORIGIN, isHiutHandle)).toEqual([
      'wallet',
      'hiutgiftbook',
      'yb6',
    ]);
  });

  it('ranks a product once even when the theme links it in two different capitalisations', async () => {
    const environment = openStore();
    environment.stubFetch({
      'collections/all': {
        text: storefrontMarkupFor(['WALLET', 'wallet', 'Wallet', 'YB6', 'yb6']),
      },
    });

    expect(await fetchBestSellingHandles(STORE_ORIGIN, isHiutHandle)).toEqual(['wallet', 'yb6']);
  });
});

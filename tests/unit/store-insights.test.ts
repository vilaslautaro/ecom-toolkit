import { describe, it, expect } from 'vitest';
import { buildStoreInsights, isAddOnProduct } from '../../src/bookmarklet/shopify/store-insights.js';
import type { ShopifyProduct } from '../../src/bookmarklet/domain/types.js';
import { shopifyProduct } from '../support/shopify-fixtures.js';

const BRAND = 'lamarca.com';
const CURRENCY = 'ARS';

const REAL_PRODUCTS: readonly ShopifyProduct[] = [
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
];

const ADD_ONS: readonly ShopifyProduct[] = [
  shopifyProduct({ id: 5, title: 'Seguro de envio', handle: 'seguro-de-envio', price: '500.00' }),
  shopifyProduct({ id: 6, title: 'Producto regalo', handle: 'regalo', price: '0.00' }),
];

const ALL_PRODUCTS = [...REAL_PRODUCTS, ...ADD_ONS];

function insightsFor(bestSellingHandles: readonly string[]) {
  return buildStoreInsights({
    brand: BRAND,
    currency: CURRENCY,
    products: ALL_PRODUCTS,
    bestSellingHandles,
  });
}

describe('isAddOnProduct', () => {
  it('treats anything priced at zero as an add on rather than a product', () => {
    expect(isAddOnProduct(shopifyProduct({ id: 1, title: 'Regalo', handle: 'regalo', price: '0.00' }))).toBe(true);
  });

  it('treats a product with no variants at all as an add on', () => {
    expect(isAddOnProduct({ id: 1, title: 'Sin variantes', handle: 'sin-variantes' })).toBe(true);
  });

  it.each([
    ['Seguro de envio', 'seguro-de-envio'],
    ['Shipping Protection', 'shipping-protection'],
    ['Versandversicherung', 'versandversicherung'],
    ['Extended Warranty', 'extended-warranty'],
    ['Garantía extendida', 'garantia-extendida'],
    ['Dejá tu propina', 'propina'],
    ['Donation', 'donation'],
  ])('treats %s as an add on even when it has a price', (title, handle) => {
    expect(isAddOnProduct(shopifyProduct({ id: 1, title, handle, price: '500.00' }))).toBe(true);
  });

  it('keeps a normal product with a price', () => {
    expect(isAddOnProduct(shopifyProduct({ id: 1, title: 'Remera', handle: 'remera' }))).toBe(false);
  });
});

describe('buildStoreInsights', () => {
  it('counts only sellable products and leaves the add ons out', () => {
    expect(insightsFor(['estrella']).sellableProductCount).toBe(REAL_PRODUCTS.length);
  });

  it('builds the price range from sellable products only', () => {
    const { priceRange } = insightsFor(['estrella']);

    expect(priceRange.lowest).toBe(15225);
    expect(priceRange.highest).toBe(214999.99);
    expect(priceRange.average).toBeCloseTo((214999.99 + 152240 + 99000 + 15225) / 4, 2);
    expect(priceRange.currency).toBe(CURRENCY);
  });

  it('returns a zeroed price range when the store exposes no sellable product', () => {
    const insights = buildStoreInsights({
      brand: BRAND,
      currency: CURRENCY,
      products: ADD_ONS,
      bestSellingHandles: [],
    });

    expect(insights.priceRange).toEqual({ lowest: 0, highest: 0, average: 0, currency: CURRENCY });
    expect(insights.sellableProductCount).toBe(0);
  });

  it('ranks the best sellers in the order the storefront returned them', () => {
    const insights = insightsFor(['tercero', 'estrella', 'segundo']);

    expect(insights.bestSellers.map((product) => product.handle)).toEqual([
      'tercero',
      'estrella',
      'segundo',
    ]);
  });

  it('never ranks an add on as a best seller even when the storefront lists it first', () => {
    const insights = insightsFor(['seguro-de-envio', 'estrella', 'segundo', 'tercero']);

    expect(insights.bestSellers.map((product) => product.handle)).toEqual([
      'estrella',
      'segundo',
      'tercero',
    ]);
  });

  it('ignores handles that do not belong to this store', () => {
    const insights = insightsFor(['handle-de-otra-tienda', 'estrella', 'segundo', 'tercero']);

    expect(insights.bestSellers.map((product) => product.handle)).toEqual([
      'estrella',
      'segundo',
      'tercero',
    ]);
  });

  it('fills the top three with other products when the storefront returns fewer', () => {
    const insights = insightsFor(['tercero']);

    expect(insights.bestSellers).toHaveLength(3);
    expect(insights.bestSellers[0]?.handle).toBe('tercero');
    expect(new Set(insights.bestSellers.map((product) => product.handle)).size).toBe(3);
  });

  it('reports the first and last publication dates of the sellable catalogue', () => {
    const insights = insightsFor(['estrella']);

    expect(insights.firstPublishedAt?.toISOString()).toBe('2024-01-23T10:00:00.000Z');
    expect(insights.lastPublishedAt?.toISOString()).toBe('2026-08-06T10:00:00.000Z');
  });

  it('reports no dates when the catalogue never exposes a publication date', () => {
    const insights = buildStoreInsights({
      brand: BRAND,
      currency: CURRENCY,
      products: [{ id: 1, title: 'Remera', handle: 'remera', variants: [{ id: 10, price: '10.00' }] }],
      bestSellingHandles: [],
    });

    expect(insights.firstPublishedAt).toBeNull();
    expect(insights.lastPublishedAt).toBeNull();
  });

  it('carries the brand through untouched for the panel header', () => {
    expect(insightsFor([]).brand).toBe(BRAND);
  });
});

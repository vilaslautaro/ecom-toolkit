import type { ShopifyProduct } from '../../src/bookmarklet/domain/types.js';

export interface ShopifyProductOptions {
  readonly id: number;
  readonly title: string;
  readonly handle: string;
  readonly price?: string;
  readonly publishedAt?: string;
  readonly imageUrl?: string;
}

const DEFAULT_PRICE = '199.00';
const DEFAULT_PUBLISHED_AT = '2024-01-23T10:00:00-03:00';
const VARIANT_ID_FACTOR = 10;

export function shopifyProduct(options: ShopifyProductOptions): ShopifyProduct {
  const publishedAt = options.publishedAt ?? DEFAULT_PUBLISHED_AT;

  return {
    id: options.id,
    title: options.title,
    handle: options.handle,
    published_at: publishedAt,
    created_at: publishedAt,
    variants: [{ id: options.id * VARIANT_ID_FACTOR, price: options.price ?? DEFAULT_PRICE }],
    images: options.imageUrl ? [{ src: options.imageUrl }] : [],
  };
}

export function storefrontMarkupFor(handles: readonly string[]): string {
  return handles.map((handle) => `<a href="/products/${handle}">x</a>`).join('');
}

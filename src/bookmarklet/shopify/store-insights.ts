import type { PriceRange, ShopifyProduct, StoreInsights } from '../domain/types.js';

const ADD_ON_PATTERN =
  /versand|shipping|insurance|versicher|seguro|protecc|protection|garant|warranty|\btip\b|propina|donation|donaci/i;

const BEST_SELLER_COUNT = 3;

export interface StoreInsightsInput {
  readonly brand: string;
  readonly currency: string;
  readonly products: readonly ShopifyProduct[];
  readonly bestSellingHandles: readonly string[];
}

function firstVariantPrice(product: ShopifyProduct): number {
  return Number.parseFloat(product.variants?.[0]?.price ?? '0');
}

export function isAddOnProduct(product: ShopifyProduct): boolean {
  if (!(firstVariantPrice(product) > 0)) return true;
  return ADD_ON_PATTERN.test(`${product.handle} ${product.title}`);
}

export function publishedDateOf(product: ShopifyProduct): Date | null {
  const published = product.published_at ?? product.created_at;
  if (!published) return null;

  const date = new Date(published);
  return Number.isNaN(date.getTime()) ? null : date;
}

interface BestSellerSelection {
  readonly products: readonly ShopifyProduct[];
  readonly rankedCount: number;
}

function selectBestSellers(
  products: readonly ShopifyProduct[],
  bestSellingHandles: readonly string[],
  sellable: readonly ShopifyProduct[],
): BestSellerSelection {
  const byHandle = new Map(products.map((product) => [product.handle, product]));

  const ranked = bestSellingHandles
    .map((handle) => byHandle.get(handle))
    .filter((product): product is ShopifyProduct => product !== undefined)
    .filter((product) => !isAddOnProduct(product))
    .slice(0, BEST_SELLER_COUNT);

  if (ranked.length >= BEST_SELLER_COUNT) {
    return { products: ranked, rankedCount: ranked.length };
  }

  const filler = sellable.filter((product) => !ranked.includes(product));

  return {
    products: [...ranked, ...filler].slice(0, BEST_SELLER_COUNT),
    rankedCount: ranked.length,
  };
}

function sellablePrices(products: readonly ShopifyProduct[]): readonly number[] {
  const prices: number[] = [];

  for (const product of products) {
    for (const variant of product.variants ?? []) {
      const price = Number.parseFloat(variant.price);
      if (price > 0) prices.push(price);
    }
  }

  return prices;
}

function priceRangeOf(products: readonly ShopifyProduct[], currency: string): PriceRange {
  const prices = sellablePrices(products);
  if (prices.length === 0) return { lowest: 0, highest: 0, average: 0, currency };

  const total = prices.reduce((sum, price) => sum + price, 0);

  return {
    lowest: Math.min(...prices),
    highest: Math.max(...prices),
    average: total / prices.length,
    currency,
  };
}

function earliestDate(dates: readonly Date[]): Date | null {
  return dates.reduce<Date | null>(
    (earliest, date) => (earliest === null || date < earliest ? date : earliest),
    null,
  );
}

function latestDate(dates: readonly Date[]): Date | null {
  return dates.reduce<Date | null>(
    (latest, date) => (latest === null || date > latest ? date : latest),
    null,
  );
}

export function buildStoreInsights(input: StoreInsightsInput): StoreInsights {
  const sellable = input.products.filter((product) => !isAddOnProduct(product));

  const publishedDates = sellable
    .map(publishedDateOf)
    .filter((date): date is Date => date !== null);

  const selection = selectBestSellers(input.products, input.bestSellingHandles, sellable);

  return {
    brand: input.brand,
    bestSellers: selection.products,
    rankedProductCount: selection.rankedCount,
    sellableProductCount: sellable.length,
    priceRange: priceRangeOf(sellable, input.currency),
    firstPublishedAt: earliestDate(publishedDates),
    lastPublishedAt: latestDate(publishedDates),
  };
}

import type { ShopifyProduct } from '../domain/types.js';

declare global {
  interface Window {
    Shopify?: {
      currency?: {
        active?: string;
      };
    };
  }
}

const PRODUCTS_PER_PAGE = 250;
const MAX_PRODUCT_PAGES = 8;
const MINIMUM_BEST_SELLERS = 3;

const SHOPIFY_CDN_FRAGMENT = 'cdn.shopify';
const BEST_SELLING_PATH = '/collections/all?sort_by=best-selling';
const PRODUCT_HANDLE_SOURCE = '/products/([a-z0-9-]+)';

const COLLECTION_SECTION_IDS: readonly string[] = [
  'main-collection-product-grid',
  'product-grid',
  'collection',
  'main-collection',
  'template--collection',
];

const ANONYMOUS_REQUEST: RequestInit = { credentials: 'omit' };

interface ProductsPage {
  readonly products?: readonly ShopifyProduct[];
}

type SectionMarkup = Record<string, string | undefined>;

export function isShopifyStore(): boolean {
  return Boolean(window.Shopify)
    || document.documentElement.innerHTML.includes(SHOPIFY_CDN_FRAGMENT);
}

export function storeCurrency(): string {
  return window.Shopify?.currency?.active ?? '';
}

export async function fetchAllProducts(origin: string): Promise<readonly ShopifyProduct[]> {
  const products: ShopifyProduct[] = [];

  for (let page = 1; page <= MAX_PRODUCT_PAGES; page++) {
    const response = await fetch(
      `${origin}/products.json?limit=${PRODUCTS_PER_PAGE}&page=${page}`,
      ANONYMOUS_REQUEST,
    );
    if (!response.ok) break;

    const payload = (await response.json()) as ProductsPage;
    const batch = payload.products ?? [];
    if (batch.length === 0) break;

    products.push(...batch);
    if (batch.length < PRODUCTS_PER_PAGE) break;
  }

  return products;
}

function collectProductHandles(markup: string): readonly string[] {
  const pattern = new RegExp(PRODUCT_HANDLE_SOURCE, 'gi');
  const handles: string[] = [];

  for (let match = pattern.exec(markup); match !== null; match = pattern.exec(markup)) {
    const handle = match[1]?.toLowerCase();
    if (handle && !handles.includes(handle)) handles.push(handle);
  }

  return handles;
}

async function fetchStorefrontHandles(origin: string): Promise<readonly string[]> {
  try {
    const response = await fetch(origin + BEST_SELLING_PATH, ANONYMOUS_REQUEST);
    return collectProductHandles(await response.text());
  } catch {
    return [];
  }
}

async function fetchSectionHandles(origin: string, sectionId: string): Promise<readonly string[]> {
  try {
    const response = await fetch(
      `${origin}${BEST_SELLING_PATH}&sections=${sectionId}`,
      ANONYMOUS_REQUEST,
    );
    if (!response.ok) return [];

    const sections = (await response.json()) as SectionMarkup;
    return collectProductHandles(sections[sectionId] ?? '');
  } catch {
    return [];
  }
}

export async function fetchBestSellingHandles(
  origin: string,
  isKnownHandle: (handle: string) => boolean,
): Promise<readonly string[]> {
  const storefrontHandles = await fetchStorefrontHandles(origin);
  if (storefrontHandles.filter(isKnownHandle).length >= MINIMUM_BEST_SELLERS) {
    return storefrontHandles;
  }

  for (const sectionId of COLLECTION_SECTION_IDS) {
    const sectionHandles = await fetchSectionHandles(origin, sectionId);
    if (sectionHandles.filter(isKnownHandle).length >= MINIMUM_BEST_SELLERS) {
      return sectionHandles;
    }
  }

  return storefrontHandles;
}

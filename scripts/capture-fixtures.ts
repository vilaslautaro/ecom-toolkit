import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  CapturedBestSelling,
  CapturedCatalogue,
  CapturedImage,
  CapturedProduct,
  CapturedVariant,
} from '../tests/support/captured-shopify-fixtures.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIRECTORY = join(ROOT, 'tests', 'fixtures', 'shopify');
const README_PATH = join(FIXTURE_DIRECTORY, 'README.md');

const CATALOGUE_PAGE_SIZE = 250;
const MAX_CATALOGUE_PAGES = 8;
const PRODUCTS_KEPT_PER_STORE = 12;
const BEST_SELLING_HANDLES_KEPT = 20;
const IMAGES_KEPT_PER_PRODUCT = 1;

const BEST_SELLING_PATH = '/collections/all?sort_by=best-selling';
const PRODUCT_HANDLE_SOURCE = '/products/([a-z0-9-]+)';
const REQUEST_TIMEOUT_MS = 20000;
const USER_AGENT = 'ecom-toolkit-fixture-capture (+https://github.com/vilaslautaro/ecom-toolkit)';

const JSON_INDENT = 2;

interface StoreSource {
  readonly slug: string;
  readonly origin: string;
}

const STORES: readonly StoreSource[] = [
  { slug: 'allbirds', origin: 'https://www.allbirds.com' },
  { slug: 'hiutdenim', origin: 'https://www.hiutdenim.co.uk' },
];

interface StoreCapture {
  readonly store: StoreSource;
  readonly products: readonly CapturedProduct[];
  readonly handles: readonly string[];
  readonly catalogueSize: number;
}

class CaptureError extends Error {}

function relativeToRoot(path: string): string {
  return relative(ROOT, path).split('\\').join('/');
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asList(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? (value as readonly unknown[]) : [];
}

async function requestText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: '*/*' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: 'follow',
  }).catch((error: unknown) => {
    throw new CaptureError(`${url} could not be reached (${String(error)})`);
  });

  if (!response.ok) throw new CaptureError(`${url} answered HTTP ${response.status}`);

  return response.text();
}

async function requestJson(url: string): Promise<unknown> {
  const body = await requestText(url);

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new CaptureError(`${url} answered something that is not JSON`);
  }
}

function capturedVariantsOf(value: unknown): readonly CapturedVariant[] {
  const variants: CapturedVariant[] = [];

  for (const entry of asList(value)) {
    const record = asRecord(entry);
    const id = asNumber(record?.['id']);
    const price = asText(record?.['price']);
    if (id !== null && price !== null) variants.push({ id, price });
  }

  return variants;
}

function capturedImagesOf(value: unknown): readonly CapturedImage[] {
  const images: CapturedImage[] = [];

  for (const entry of asList(value)) {
    if (images.length >= IMAGES_KEPT_PER_PRODUCT) break;
    const src = asText(asRecord(entry)?.['src']);
    if (src !== null) images.push({ src });
  }

  return images;
}

function capturedProductOf(value: unknown): CapturedProduct | null {
  const record = asRecord(value);
  if (!record) return null;

  const id = asNumber(record['id']);
  const title = asText(record['title']);
  const handle = asText(record['handle']);
  const publishedAt = asText(record['published_at']);
  const createdAt = asText(record['created_at']);
  const variants = capturedVariantsOf(record['variants']);

  if (id === null || title === null || handle === null) return null;
  if (publishedAt === null || createdAt === null || variants.length === 0) return null;

  return {
    created_at: createdAt,
    handle,
    id,
    images: capturedImagesOf(record['images']),
    published_at: publishedAt,
    title,
    variants,
  };
}

async function fetchCatalogue(origin: string): Promise<readonly CapturedProduct[]> {
  const products: CapturedProduct[] = [];

  for (let page = 1; page <= MAX_CATALOGUE_PAGES; page += 1) {
    const payload = await requestJson(
      `${origin}/products.json?limit=${CATALOGUE_PAGE_SIZE}&page=${page}`,
    );
    const batch = asList(asRecord(payload)?.['products']);
    if (batch.length === 0) break;

    for (const entry of batch) {
      const product = capturedProductOf(entry);
      if (product) products.push(product);
    }

    if (batch.length < CATALOGUE_PAGE_SIZE) break;
  }

  if (products.length === 0) throw new CaptureError(`${origin} published an empty product feed`);

  return products;
}

function collectProductHandles(markup: string): readonly string[] {
  const pattern = new RegExp(PRODUCT_HANDLE_SOURCE, 'gi');
  const handles: string[] = [];

  for (let match = pattern.exec(markup); match !== null; match = pattern.exec(markup)) {
    const handle = match[1];
    if (handle && !handles.includes(handle)) handles.push(handle);
  }

  return handles;
}

async function fetchBestSellingHandles(origin: string): Promise<readonly string[]> {
  const markup = await requestText(origin + BEST_SELLING_PATH);
  const handles = collectProductHandles(markup);

  if (handles.length === 0) {
    throw new CaptureError(`${origin}${BEST_SELLING_PATH} listed no product at all`);
  }

  return handles.slice(0, BEST_SELLING_HANDLES_KEPT);
}

function selectProducts(
  catalogue: readonly CapturedProduct[],
  handles: readonly string[],
): readonly CapturedProduct[] {
  const byHandle = new Map(catalogue.map((product) => [product.handle, product]));
  const kept = new Set<string>();

  for (const handle of handles) {
    if (kept.size >= PRODUCTS_KEPT_PER_STORE) break;
    if (byHandle.has(handle)) kept.add(handle);
  }

  for (const product of catalogue) {
    if (kept.size >= PRODUCTS_KEPT_PER_STORE) break;
    kept.add(product.handle);
  }

  return catalogue.filter((product) => kept.has(product.handle));
}

function sortedValue(value: unknown): unknown {
  if (Array.isArray(value)) return (value as readonly unknown[]).map(sortedValue);

  const record = asRecord(value);
  if (!record) return value;

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) sorted[key] = sortedValue(record[key]);

  return sorted;
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(sortedValue(value), null, JSON_INDENT)}\n`;
}

async function captureStore(store: StoreSource): Promise<StoreCapture> {
  const catalogue = await fetchCatalogue(store.origin);
  const handles = await fetchBestSellingHandles(store.origin);
  const products = selectProducts(catalogue, handles);

  const catalogueDocument: CapturedCatalogue = { products };
  const bestSellingDocument: CapturedBestSelling = { handles };

  await writeFile(
    join(FIXTURE_DIRECTORY, `${store.slug}-products.json`),
    stableJson(catalogueDocument),
    'utf8',
  );
  await writeFile(
    join(FIXTURE_DIRECTORY, `${store.slug}-best-selling.json`),
    stableJson(bestSellingDocument),
    'utf8',
  );

  return { store, products, handles, catalogueSize: catalogue.length };
}

function captureDate(): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');

  return `${now.getUTCFullYear()}-${month}-${day}`;
}

function readmeFor(captures: readonly StoreCapture[]): string {
  const rows = captures.map((capture) => {
    const ranked = capture.handles.filter((handle) =>
      capture.products.some((product) => product.handle === handle),
    ).length;

    return `| \`${capture.store.slug}\` | ${capture.store.origin} | ${capture.catalogueSize} | ${capture.products.length} | ${capture.handles.length} | ${ranked} |`;
  });

  return [
    '# Shopify fixtures',
    '',
    'Real responses from public Shopify storefronts. Nothing here is hand written: every',
    'file is the answer a live store gave, trimmed to the fields the bookmarklet reads',
    '(`id`, `title`, `handle`, `published_at`, `created_at`, `variants[].id`,',
    '`variants[].price` and `images[].src`). Every variant is kept because the price range',
    `reads all of them, and only the first ${IMAGES_KEPT_PER_PRODUCT} image survives because the panel only shows that one.`,
    '',
    `Captured on ${captureDate()} from:`,
    '',
    `- \`/products.json?limit=${CATALOGUE_PAGE_SIZE}&page=N\`, paginated the way the bookmarklet paginates it,`,
    `  then trimmed to ${PRODUCTS_KEPT_PER_STORE} products: the ones the storefront ranks as best selling first,`,
    '  the head of the catalogue after that.',
    `- \`${BEST_SELLING_PATH}\`, an entire storefront page. Only the product handles it links to`,
    '  are kept, so `<slug>-best-selling.json` is a handle list and never raw HTML.',
    '',
    '| Slug | Origin | Catalogue size | Products kept | Best selling handles | Handles also in the kept products |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    'Regenerate with `npm run fixtures:refresh`. The output is key sorted and the selection',
    'is deterministic, so a refresh that finds the same data produces no diff.',
    '',
  ].join('\n');
}

function reportCapture(capture: StoreCapture): void {
  process.stdout.write(
    `fixtures: ${capture.store.origin} -> ${capture.products.length} products `
      + `out of ${capture.catalogueSize}, ${capture.handles.length} best selling handles\n`,
  );
}

function reportFailure(store: StoreSource, error: unknown): void {
  const reason = error instanceof CaptureError ? error.message : String(error);

  process.stderr.write(
    `fixtures: ${store.origin} refused to answer, so ${store.slug} keeps the fixtures it already had.\n`
      + `fixtures: reason: ${reason}\n`,
  );
}

async function main(): Promise<void> {
  await mkdir(FIXTURE_DIRECTORY, { recursive: true });

  const captures: StoreCapture[] = [];
  const failed: StoreSource[] = [];

  for (const store of STORES) {
    try {
      const capture = await captureStore(store);
      captures.push(capture);
      reportCapture(capture);
    } catch (error: unknown) {
      failed.push(store);
      reportFailure(store, error);
    }
  }

  if (failed.length > 0) {
    process.stderr.write(
      `fixtures: ${failed.length} of ${STORES.length} stores failed, so `
        + `${relativeToRoot(README_PATH)} was left untouched.\n`,
    );
    process.exitCode = 1;
    return;
  }

  await writeFile(README_PATH, readmeFor(captures), 'utf8');

  process.stdout.write(
    `fixtures: ${relativeToRoot(FIXTURE_DIRECTORY)}/ refreshed from ${captures.length} stores\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`fixtures: unexpected error\n${String(error)}\n`);
  process.exitCode = 1;
});

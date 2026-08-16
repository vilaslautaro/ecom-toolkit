import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface CapturedVariant {
  readonly id: number;
  readonly price: string;
}

export interface CapturedImage {
  readonly src: string;
}

export interface CapturedProduct {
  readonly created_at: string;
  readonly handle: string;
  readonly id: number;
  readonly images: readonly CapturedImage[];
  readonly published_at: string;
  readonly title: string;
  readonly variants: readonly CapturedVariant[];
}

export interface CapturedCatalogue {
  readonly products: readonly CapturedProduct[];
}

export interface CapturedBestSelling {
  readonly handles: readonly string[];
}

export const CAPTURED_FIXTURE_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures',
  'shopify',
);

export function capturedCataloguePath(storeSlug: string): string {
  return join(CAPTURED_FIXTURE_DIRECTORY, `${storeSlug}-products.json`);
}

export function capturedBestSellingPath(storeSlug: string): string {
  return join(CAPTURED_FIXTURE_DIRECTORY, `${storeSlug}-best-selling.json`);
}

export function readCapturedCatalogue(storeSlug: string): CapturedCatalogue {
  return JSON.parse(readFileSync(capturedCataloguePath(storeSlug), 'utf8')) as CapturedCatalogue;
}

export function readCapturedBestSelling(storeSlug: string): CapturedBestSelling {
  return JSON.parse(readFileSync(capturedBestSellingPath(storeSlug), 'utf8')) as CapturedBestSelling;
}

import { describe, it, expect, afterEach } from 'vitest';
import { adLibrarySearchUrl, detectStoreBrand } from '../../src/bookmarklet/shopify/store-brand.js';
import { closeOpenPages, createPageEnvironment } from '../support/page-environment.js';

afterEach(closeOpenPages);

function brandDetectedAt(url: string): string {
  createPageEnvironment({ url });
  return detectStoreBrand();
}

describe('detectStoreBrand', () => {
  it('uses the hostname without the www prefix on a regular store', () => {
    expect(brandDetectedAt('https://www.lamarca.com/products/x')).toBe('lamarca.com');
  });

  it('keeps the full hostname of a myshopify subdomain', () => {
    expect(brandDetectedAt('https://lamarca.myshopify.com/')).toBe('lamarca.myshopify.com');
  });

  it('reads the supplier name from the last url segment inside dropi', () => {
    expect(brandDetectedAt('https://app.dropi.com.ar/proveedor/la-mejor-marca')).toBe(
      'la mejor marca',
    );
  });

  it('drops the query string when reading the supplier name inside dropi', () => {
    expect(brandDetectedAt('https://app.dropi.com.ar/proveedor/la-marca?page=2')).toBe('la marca');
  });
});

describe('adLibrarySearchUrl', () => {
  it('builds an ad library search sorted by total impressions', () => {
    const url = new URL(adLibrarySearchUrl('la marca'));

    expect(url.hostname).toBe('www.facebook.com');
    expect(url.searchParams.get('q')).toBe('la marca');
    expect(url.searchParams.get('active_status')).toBe('active');
    expect(url.searchParams.get('sort_data[mode]')).toBe('total_impressions');
    expect(url.searchParams.get('sort_data[direction]')).toBe('desc');
  });

  it('escapes the characters of a brand that would break the query string', () => {
    expect(adLibrarySearchUrl('a&b=c')).toContain('q=a%26b%3Dc');
  });
});

import { describe, it, expect } from 'vitest';
import {
  brandFromAdvertiserText,
  brandFromDomain,
  brandFromSearchQuery,
  slugify,
} from '../../src/bookmarklet/domain/brand-name.js';
import { AD_LIBRARY_URL } from '../support/ad-library-fixtures.js';

const COMBINING_ACUTE_ACCENT = String.fromCharCode(0x0301);
const MAX_BRAND_LENGTH = 24;

describe('slugify', () => {
  it('drops the accent instead of eating the letter it sits on', () => {
    expect(slugify('Piçante Añejo Ñoño')).toBe('picanteanejonono');
    expect(slugify('Café Über')).toBe('cafeuber');
  });

  it('also drops combining marks that arrive already decomposed from the DOM', () => {
    expect(slugify(`Cafe${COMBINING_ACUTE_ACCENT}`)).toBe('cafe');
  });

  it('keeps lowercase letters and digits only', () => {
    expect(slugify('La Marca 2024!')).toBe('lamarca2024');
    expect(slugify('a-b_c.d e')).toBe('abcde');
  });

  it('truncates long names so file names stay manageable', () => {
    expect(slugify('a'.repeat(50))).toHaveLength(MAX_BRAND_LENGTH);
  });

  it('tolerates empty, null and undefined input', () => {
    expect(slugify('')).toBe('');
    expect(slugify(null)).toBe('');
    expect(slugify(undefined)).toBe('');
  });
});

describe('brandFromDomain', () => {
  it.each([
    ['https://www.lamarca.com/products/x', 'lamarca'],
    ['http://lamarca.com.ar', 'lamarca'],
    ['www.la-marca.shop', 'lamarca'],
    ['lamarca.myshopify.com', 'lamarca'],
    ['lamarca.com?utm_source=fb', 'lamarca'],
  ])('reads the second level name out of %s', (input, expected) => {
    expect(brandFromDomain(input)).toBe(expected);
  });

  it('returns an empty brand when there is nothing to read', () => {
    expect(brandFromDomain('')).toBe('');
    expect(brandFromDomain(null)).toBe('');
    expect(brandFromDomain(undefined)).toBe('');
  });
});

describe('brandFromSearchQuery', () => {
  it('takes the brand from the q parameter of an ad library search', () => {
    expect(brandFromSearchQuery(AD_LIBRARY_URL)).toBe('lamarca');
  });

  it('reads a full domain typed into the search box', () => {
    expect(brandFromSearchQuery('https://www.facebook.com/ads/library/?q=www.lamarca.com')).toBe(
      'lamarca',
    );
  });

  it('returns an empty brand when the search has no query', () => {
    expect(brandFromSearchQuery('https://www.facebook.com/ads/library/')).toBe('');
  });

  it('returns an empty brand instead of throwing on a malformed href', () => {
    expect(brandFromSearchQuery('not a url at all')).toBe('');
  });
});

describe('brandFromAdvertiserText', () => {
  it('reads the advertiser domain out of the card text', () => {
    expect(brandFromAdvertiserText('Patrocinado · otramarca.com')).toBe('otramarca');
  });

  it('ignores domains owned by Meta so the brand never becomes facebook', () => {
    expect(brandFromAdvertiserText('Patrocinado · facebook.com')).toBe('');
    expect(brandFromAdvertiserText('scontent.xx.fbcdn.net/v/x.jpg')).toBe('');
    expect(brandFromAdvertiserText('instagram.com/lamarca')).toBe('');
  });

  it('keeps the first non Meta domain when the text mentions several', () => {
    expect(brandFromAdvertiserText('facebook.com y también otramarca.shop')).toBe('otramarca');
  });

  it('returns an empty brand when the text has no domain at all', () => {
    expect(brandFromAdvertiserText('Patrocinado')).toBe('');
  });
});

import { describe, it, expect } from 'vitest';
import { passesFilters } from '../../src/bookmarklet/ad-library/ad-filters.js';
import { buildAd, buildFilters } from '../support/ad-fixtures.js';

describe('passesFilters', () => {
  it('rejects ads the brand does not repeat enough times', () => {
    const filters = buildFilters({ minimumCopiesInRotation: 2 });

    expect(passesFilters(buildAd({ copiesInRotation: 1 }), filters)).toBe(false);
    expect(passesFilters(buildAd({ copiesInRotation: 2 }), filters)).toBe(true);
    expect(passesFilters(buildAd({ copiesInRotation: 9 }), filters)).toBe(true);
  });

  it('lets everything through when no minimum is configured', () => {
    const filters = buildFilters({ minimumCopiesInRotation: 0 });

    expect(passesFilters(buildAd({ copiesInRotation: 1 }), filters)).toBe(true);
  });

  it('drops ads flagged with low impressions only while that filter is on', () => {
    const ad = buildAd({ copiesInRotation: 5, hasLowImpressions: true });

    expect(passesFilters(ad, buildFilters({ skipLowImpressions: true }))).toBe(false);
    expect(passesFilters(ad, buildFilters({ skipLowImpressions: false }))).toBe(true);
  });
});

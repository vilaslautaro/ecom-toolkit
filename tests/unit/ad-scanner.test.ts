import { describe, it, expect, afterEach } from 'vitest';
import { scanAds } from '../../src/bookmarklet/ad-library/ad-scanner.js';
import { adCard, adLibraryPage, AD_LIBRARY_URL } from '../support/ad-library-fixtures.js';
import { closeOpenPages, createPageEnvironment } from '../support/page-environment.js';
import type { Ad } from '../../src/bookmarklet/domain/types.js';

afterEach(closeOpenPages);

function scanPage(html: string): readonly Ad[] {
  const environment = createPageEnvironment({ url: AD_LIBRARY_URL, html });
  return scanAds(environment.document);
}

function scanCards(cards: readonly string[]): readonly Ad[] {
  return scanPage(adLibraryPage(cards));
}

describe('scanAds', () => {
  it('reads a video card with every field filled in', () => {
    const [ad] = scanCards([
      adCard({
        libraryId: '1652452402393518',
        copiesInRotation: 4,
        media: 'video',
        circulationDate: '27/6/2026',
      }),
    ]);

    expect(ad).toMatchObject({
      libraryId: '1652452402393518',
      copiesInRotation: 4,
      hasVideo: true,
      hasLowImpressions: false,
      circulationDate: { day: '27', month: '6', shortYear: '26' },
      brand: 'lamarca',
    });
    expect(ad?.sources.videoUrl).toContain('.mp4');
    expect(ad?.sources.posterUrl).toContain('_poster.jpg');
  });

  it('takes the brand from the q parameter of the search url', () => {
    const [ad] = scanCards([adCard({ libraryId: '100000000000009' })]);

    expect(ad?.brand).toBe('lamarca');
  });

  it('reads an image card', () => {
    const [ad] = scanCards([
      adCard({ libraryId: '999999999999', media: 'image', imageNaturalWidth: 800 }),
    ]);

    expect(ad?.hasVideo).toBe(false);
    expect(ad?.sources.imageUrl).toContain('.jpg');
  });

  it('counts a single copy when the ad is not repeated', () => {
    const [ad] = scanCards([adCard({ libraryId: '123456789012', copiesInRotation: 1 })]);

    expect(ad?.copiesInRotation).toBe(1);
  });

  it('flags the ads Meta marks as having low impressions', () => {
    const ads = scanCards([
      adCard({ libraryId: '111111111111', lowImpressions: true }),
      adCard({ libraryId: '222222222222', lowImpressions: false }),
    ]);

    expect(ads.find((ad) => ad.libraryId === '111111111111')?.hasLowImpressions).toBe(true);
    expect(ads.find((ad) => ad.libraryId === '222222222222')?.hasLowImpressions).toBe(false);
  });

  it('deduplicates the same library id rendered twice in the DOM', () => {
    const ads = scanCards([
      adCard({ libraryId: '777777777777' }),
      adCard({ libraryId: '777777777777' }),
    ]);

    expect(ads).toHaveLength(1);
  });

  it('returns an empty list on a page without ads', () => {
    expect(scanPage('<!doctype html><body><p>nada</p></body>')).toEqual([]);
  });

  it('never gives an ad the creative of its neighbour while its own media is still loading', () => {
    const ads = scanCards([
      '<div><span>Identificador de la biblioteca: 123456789</span></div>',
      adCard({
        libraryId: '888888888888',
        videoUrl: 'https://video.xx.fbcdn.net/v/EL_CORRECTO.mp4',
      }),
    ]);

    expect(ads).toHaveLength(1);
    expect(ads[0]?.libraryId).toBe('888888888888');
    expect(ads[0]?.sources.videoUrl).toContain('EL_CORRECTO.mp4');
    expect(ads.some((ad) => ad.libraryId === '123456789')).toBe(false);
  });

  it('keeps the DOM order of the cards it finds', () => {
    const ads = scanCards([
      adCard({ libraryId: '100000000001' }),
      adCard({ libraryId: '100000000002' }),
      adCard({ libraryId: '100000000003' }),
    ]);

    expect(ads.map((ad) => ad.libraryId)).toEqual([
      '100000000001',
      '100000000002',
      '100000000003',
    ]);
  });

  it('reads a card rendered in the English Ad Library', () => {
    const [ad] = scanCards([
      adCard({
        locale: 'en',
        libraryId: '1249043200627555',
        copiesInRotation: 3,
        circulationDate: '5/6/2025',
      }),
    ]);

    expect(ad).toMatchObject({
      libraryId: '1249043200627555',
      copiesInRotation: 3,
      hasVideo: true,
      circulationDate: { day: '5', month: '6', shortYear: '25' },
    });
  });

  it('reads a mixed page where Meta rendered one card in each language', () => {
    const ads = scanCards([
      adCard({ libraryId: '100000000000001', copiesInRotation: 2 }),
      adCard({ locale: 'en', libraryId: '1249043200627555', copiesInRotation: 3 }),
    ]);

    expect(ads.map((ad) => ad.libraryId)).toEqual(['100000000000001', '1249043200627555']);
    expect(ads.map((ad) => ad.copiesInRotation)).toEqual([2, 3]);
  });

  it('ignores a long block of text that merely mentions many library ids', () => {
    const ads = scanCards([
      `<div class="ad-card">
         <video src="https://video.xx.fbcdn.net/v/x.mp4"></video>
         <div><span>${'Identificador de la biblioteca: 123456789 '.repeat(5)}</span></div>
       </div>`,
    ]);

    expect(ads).toEqual([]);
  });
});

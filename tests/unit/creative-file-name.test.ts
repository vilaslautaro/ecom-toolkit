import { describe, it, expect } from 'vitest';
import {
  buildCreativeFileName,
  imageExtensionFor,
} from '../../src/bookmarklet/domain/creative-file-name.js';
import { buildAd } from '../support/ad-fixtures.js';

describe('buildCreativeFileName', () => {
  it('joins copies in rotation, circulation date, brand and library id', () => {
    const ad = buildAd({
      libraryId: '1652452402393518',
      copiesInRotation: 4,
      brand: 'lamarca',
      circulationDate: { day: '27', month: '6', shortYear: '26' },
    });

    expect(buildCreativeFileName(ad, 'mp4')).toBe(
      '4_ads_27_6_26_lamarca_1652452402393518.mp4',
    );
  });

  it('omits the date segment when the card never showed a circulation date', () => {
    const ad = buildAd({
      libraryId: '999',
      copiesInRotation: 2,
      brand: 'lamarca',
      circulationDate: null,
    });

    expect(buildCreativeFileName(ad, 'mp4')).toBe('2_ads_lamarca_999.mp4');
  });

  it('omits the brand segment when it could not be deduced', () => {
    const ad = buildAd({
      libraryId: '999',
      copiesInRotation: 1,
      brand: '',
      circulationDate: { day: '5', month: '3', shortYear: '25' },
    });

    expect(buildCreativeFileName(ad, 'jpg')).toBe('1_ads_5_3_25_999.jpg');
  });
});

describe('imageExtensionFor', () => {
  it.each([
    ['image/png', 'png'],
    ['image/webp', 'webp'],
    ['image/gif', 'gif'],
  ])('maps the %s content type to .%s', (mimeType, extension) => {
    expect(imageExtensionFor(mimeType)).toBe(extension);
  });

  it('falls back to jpg for jpeg and for anything it does not recognise', () => {
    expect(imageExtensionFor('image/jpeg')).toBe('jpg');
    expect(imageExtensionFor('application/octet-stream')).toBe('jpg');
    expect(imageExtensionFor('')).toBe('jpg');
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import {
  countLibraryIds,
  findAdCard,
  mentionsLibraryIdLabel,
} from '../../src/bookmarklet/ad-library/ad-card-locator.js';
import { adCard, adLibraryPage, AD_LIBRARY_URL } from '../support/ad-library-fixtures.js';
import { closeOpenPages, createPageEnvironment } from '../support/page-environment.js';

afterEach(closeOpenPages);

const LABEL_SELECTOR = 'span';

function openAdLibrary(cards: readonly string[]) {
  return createPageEnvironment({ url: AD_LIBRARY_URL, html: adLibraryPage(cards) });
}

describe('mentionsLibraryIdLabel', () => {
  it('recognises the label in both languages Meta ships', () => {
    expect(mentionsLibraryIdLabel('Identificador de la biblioteca: 123456')).toBe(true);
    expect(mentionsLibraryIdLabel('Library ID: 123456')).toBe(true);
  });

  it('says no for text that never mentions the label', () => {
    expect(mentionsLibraryIdLabel('Patrocinado · lamarca.com')).toBe(false);
    expect(mentionsLibraryIdLabel('')).toBe(false);
  });
});

describe('countLibraryIds', () => {
  it('counts one labelled id per ad in the text', () => {
    expect(countLibraryIds('Identificador de la biblioteca: 123456789')).toBe(1);
    expect(
      countLibraryIds('Identificador de la biblioteca: 123456789 Library ID: 987654321'),
    ).toBe(2);
  });

  it('ignores numbers that are not preceded by the label', () => {
    expect(countLibraryIds('550 resultados y 123456789 impresiones')).toBe(0);
  });

  it('ignores ids shorter than five digits so counters are not mistaken for ids', () => {
    expect(countLibraryIds('Identificador de la biblioteca: 1234')).toBe(0);
  });
});

describe('findAdCard', () => {
  it('climbs from the label up to the container that holds the creative', () => {
    const environment = openAdLibrary([adCard({ libraryId: '100000000000001' })]);
    const label = environment.requireElement(LABEL_SELECTOR);

    const card = findAdCard(label);

    expect(card).not.toBeNull();
    expect(card?.querySelector('video')).not.toBeNull();
    expect(countLibraryIds(card?.textContent ?? '')).toBe(1);
  });

  it('accepts a container whose creative is a wide image instead of a video', () => {
    const environment = openAdLibrary([
      adCard({ libraryId: '100000000000002', media: 'image', imageNaturalWidth: 800 }),
    ]);

    const card = findAdCard(environment.requireElement(LABEL_SELECTOR));

    expect(card?.querySelector('img')).not.toBeNull();
  });

  it('refuses a container whose only image is too small to be a creative', () => {
    const environment = openAdLibrary([
      adCard({ libraryId: '100000000000003', media: 'image', imageNaturalWidth: 24 }),
    ]);

    expect(findAdCard(environment.requireElement(LABEL_SELECTOR))).toBeNull();
  });

  it('stops climbing before a container that spans more than one ad', () => {
    const environment = openAdLibrary([
      adCard({ libraryId: '100000000000004', media: 'none' }),
      adCard({ libraryId: '100000000000005' }),
    ]);

    expect(findAdCard(environment.requireElement(LABEL_SELECTOR))).toBeNull();
  });

  it('returns nothing when the ad has no creative loaded anywhere above the label', () => {
    const environment = createPageEnvironment({
      url: AD_LIBRARY_URL,
      html: adLibraryPage(['<div><span>Identificador de la biblioteca: 100000000000006</span></div>']),
    });

    expect(findAdCard(environment.requireElement(LABEL_SELECTOR))).toBeNull();
  });
});

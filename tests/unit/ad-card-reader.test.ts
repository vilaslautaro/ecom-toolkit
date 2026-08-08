import { describe, it, expect, afterEach } from 'vitest';
import {
  hasLowImpressionsNotice,
  readAdFromCard,
  readCirculationDate,
  readCopiesInRotation,
  readCreativeSources,
  readLibraryId,
  readVideoUrl,
  readWidestImageUrl,
} from '../../src/bookmarklet/ad-library/ad-card-reader.js';
import { adCard, adLibraryPage, AD_LIBRARY_URL } from '../support/ad-library-fixtures.js';
import { closeOpenPages, createPageEnvironment } from '../support/page-environment.js';

afterEach(closeOpenPages);

const CARD_SELECTOR = '.ad-card';

function cardElement(html: string): Element {
  const environment = createPageEnvironment({
    url: AD_LIBRARY_URL,
    html: adLibraryPage([html]),
  });

  return environment.requireElement(CARD_SELECTOR);
}

describe('readLibraryId', () => {
  it('reads the id that follows the label in either language', () => {
    expect(readLibraryId('Identificador de la biblioteca: 1652452402393518')).toBe(
      '1652452402393518',
    );
    expect(readLibraryId('Library ID: 1249043200627555')).toBe('1249043200627555');
  });

  it('returns an empty id when the text has no labelled id', () => {
    expect(readLibraryId('Patrocinado · lamarca.com')).toBe('');
  });
});

describe('readCopiesInRotation', () => {
  it('reads how many ads share the creative in Spanish', () => {
    expect(readCopiesInRotation('4 anuncios usan este contenido')).toBe(4);
    expect(readCopiesInRotation('1 anuncio usan este contenido')).toBe(1);
  });

  it('reads how many ads share the creative in English', () => {
    expect(readCopiesInRotation('3 ads use this creative and text')).toBe(3);
    expect(readCopiesInRotation('1 ad use this creative and text')).toBe(1);
  });

  it('assumes a single copy when the card says nothing about repetition', () => {
    expect(readCopiesInRotation('Identificador de la biblioteca: 123456789')).toBe(1);
  });
});

describe('readCirculationDate', () => {
  it('reads day, month and two digit year from the Spanish wording', () => {
    expect(readCirculationDate('En circulación desde el 17 mar. 2026')).toEqual({
      day: '17',
      month: '3',
      shortYear: '26',
    });
  });

  it('reads the English wording even though Meta swaps month and day around', () => {
    expect(readCirculationDate('Started running on Mar 17, 2026')).toEqual({
      day: '17',
      month: '3',
      shortYear: '26',
    });
  });

  it('agrees on both wordings when day and month are both small enough to be confused', () => {
    const spanish = readCirculationDate('En circulación desde el 5 jun 2025');
    const english = readCirculationDate('Started running on Jun 5, 2025');

    expect(spanish).toEqual({ day: '5', month: '6', shortYear: '25' });
    expect(english).toEqual(spanish);
  });

  it.each([
    ['ene', '1'],
    ['feb', '2'],
    ['mar', '3'],
    ['abr', '4'],
    ['may', '5'],
    ['jun', '6'],
    ['jul', '7'],
    ['ago', '8'],
    ['sep', '9'],
    ['sept', '9'],
    ['oct', '10'],
    ['nov', '11'],
    ['dic', '12'],
  ])('maps the Spanish month %s to %s', (monthName, monthNumber) => {
    expect(readCirculationDate(`En circulación desde el 9 ${monthName}. 2025`)?.month).toBe(
      monthNumber,
    );
  });

  it.each([
    ['Jan', '1'],
    ['Feb', '2'],
    ['Mar', '3'],
    ['Apr', '4'],
    ['May', '5'],
    ['Jun', '6'],
    ['Jul', '7'],
    ['Aug', '8'],
    ['Sep', '9'],
    ['Oct', '10'],
    ['Nov', '11'],
    ['Dec', '12'],
  ])('maps the English month %s to %s', (monthName, monthNumber) => {
    expect(readCirculationDate(`Started running on ${monthName} 9, 2025`)?.month).toBe(monthNumber);
  });

  it('reads a full month name as well as the abbreviation', () => {
    expect(readCirculationDate('Started running on January 9, 2025')?.month).toBe('1');
  });

  it('returns no date when the text matches neither wording', () => {
    expect(readCirculationDate('Identificador de la biblioteca: 123456789')).toBeNull();
    expect(readCirculationDate('')).toBeNull();
  });

  it('returns no date when the month name is not one it knows', () => {
    expect(readCirculationDate('En circulación desde el 9 brumario 2025')).toBeNull();
  });
});

describe('hasLowImpressionsNotice', () => {
  it('recognises the notice in Spanish with and without the accent', () => {
    expect(hasLowImpressionsNotice('Número de impresiones bajo')).toBe(true);
    expect(hasLowImpressionsNotice('Numero de impresiones bajo')).toBe(true);
    expect(hasLowImpressionsNotice('NÚMERO DE IMPRESIONES BAJO')).toBe(true);
  });

  it('recognises the notice in English', () => {
    expect(hasLowImpressionsNotice('Low number of impressions')).toBe(true);
  });

  it('says no for any other text', () => {
    expect(hasLowImpressionsNotice('Muchas impresiones')).toBe(false);
    expect(hasLowImpressionsNotice('')).toBe(false);
  });
});

describe('readVideoUrl', () => {
  it('reads the src of the video element', () => {
    const card = cardElement(adCard({ libraryId: '556677889900' }));

    expect(readVideoUrl(card).url).toContain('556677889900.mp4');
    expect(readVideoUrl(card).isStreamed).toBe(false);
  });

  it('flags a blob url as a streamed video that may download incomplete', () => {
    const card = cardElement(
      `<div class="ad-card">
         <video src="blob:https://facebook.com/abc-123"></video>
         <div><span>Identificador de la biblioteca: 556677889900</span></div>
       </div>`,
    );

    expect(readVideoUrl(card).isStreamed).toBe(true);
  });

  it('falls back to the nested source element when the video has no src', () => {
    const card = cardElement(
      `<div class="ad-card">
         <video><source src="https://video.xx.fbcdn.net/v/desde-source.mp4"></video>
         <div><span>Identificador de la biblioteca: 667788990011</span></div>
       </div>`,
    );

    expect(readVideoUrl(card).url).toContain('desde-source.mp4');
  });

  it('returns an empty url when the card has no video at all', () => {
    const card = cardElement(adCard({ libraryId: '889900112233', media: 'image' }));

    expect(readVideoUrl(card)).toEqual({ url: '', isStreamed: false });
  });
});

describe('readWidestImageUrl', () => {
  it('picks the widest image and ignores avatars and icons', () => {
    const card = cardElement(
      `<div class="ad-card">
         <img src="https://scontent.xx.fbcdn.net/icono.png" data-natural-width="24">
         <img src="https://scontent.xx.fbcdn.net/chica.jpg" data-natural-width="300">
         <img src="https://scontent.xx.fbcdn.net/grande.jpg" data-natural-width="1200">
         <div><span>Identificador de la biblioteca: 778899001122</span></div>
       </div>`,
    );

    expect(readWidestImageUrl(card)).toContain('grande.jpg');
  });

  it('returns an empty url when every image is below the creative size', () => {
    const card = cardElement(
      `<div class="ad-card">
         <img src="https://scontent.xx.fbcdn.net/icono.png" data-natural-width="24">
         <div><span>Identificador de la biblioteca: 778899001123</span></div>
       </div>`,
    );

    expect(readWidestImageUrl(card)).toBe('');
  });
});

describe('readCreativeSources', () => {
  it('collects the video, its poster and the widest image of the card', () => {
    const card = cardElement(adCard({ libraryId: '100000000000001' }));

    expect(readCreativeSources(card)).toEqual({
      videoUrl: 'https://video.xx.fbcdn.net/v/100000000000001.mp4',
      isStreamedVideo: false,
      imageUrl: '',
      posterUrl: 'https://scontent.xx.fbcdn.net/v/100000000000001_poster.jpg',
    });
  });
});

describe('readAdFromCard', () => {
  it('reads every field of a Spanish card', () => {
    const card = cardElement(
      adCard({
        libraryId: '1652452402393518',
        copiesInRotation: 4,
        circulationDate: '27/6/2026',
        advertiserDomain: 'otramarca.com',
      }),
    );

    expect(readAdFromCard(card, '')).toMatchObject({
      libraryId: '1652452402393518',
      copiesInRotation: 4,
      hasVideo: true,
      hasLowImpressions: false,
      brand: 'otramarca',
      circulationDate: { day: '27', month: '6', shortYear: '26' },
    });
  });

  it('reads every field of an English card', () => {
    const card = cardElement(
      adCard({
        locale: 'en',
        libraryId: '1249043200627555',
        copiesInRotation: 3,
        circulationDate: '5/6/2025',
        lowImpressions: true,
        advertiserDomain: 'otramarca.com',
      }),
    );

    expect(readAdFromCard(card, '')).toMatchObject({
      libraryId: '1249043200627555',
      copiesInRotation: 3,
      hasVideo: true,
      hasLowImpressions: true,
      brand: 'otramarca',
      circulationDate: { day: '5', month: '6', shortYear: '25' },
    });
  });

  it('prefers the brand it was given over the one it can deduce from the card', () => {
    const card = cardElement(
      adCard({ libraryId: '333333333333', advertiserDomain: 'otramarca.com' }),
    );

    expect(readAdFromCard(card, 'lamarca')?.brand).toBe('lamarca');
  });

  it('leaves the brand empty when the only domain on the card belongs to Meta', () => {
    const card = cardElement(
      adCard({ libraryId: '555555555555', advertiserDomain: 'facebook.com' }),
    );

    expect(readAdFromCard(card, '')?.brand).toBe('');
  });

  it('returns nothing when the container has no labelled library id', () => {
    const card = cardElement('<div class="ad-card"><video src="https://x/y.mp4"></video></div>');

    expect(readAdFromCard(card, '')).toBeNull();
  });
});

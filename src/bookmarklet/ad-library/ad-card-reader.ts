import type { Ad, AdCirculationDate, AdCreativeSources } from '../domain/types.js';
import { brandFromAdvertiserText } from '../domain/brand-name.js';
import { LABELED_LIBRARY_ID_SOURCE } from './ad-card-locator.js';

const LIBRARY_ID_PATTERN = new RegExp(LABELED_LIBRARY_ID_SOURCE, 'i');
const COPIES_IN_ROTATION_PATTERNS = [
  /([0-9]+)\s+anuncios?\s+usan este contenido/i,
  /([0-9]+)\s+ads?\s+use this/i,
];
interface CirculationDateFormat {
  readonly pattern: RegExp;
  readonly dayGroup: number;
  readonly monthGroup: number;
  readonly yearGroup: number;
}

const CIRCULATION_DATE_FORMATS: readonly CirculationDateFormat[] = [
  {
    pattern: /circulaci[oó]n desde el\s+(\d{1,2})\s+([a-zA-Zé]+)\.?\s+(\d{4})/i,
    dayGroup: 1,
    monthGroup: 2,
    yearGroup: 3,
  },
  {
    pattern: /started running on\s+([a-zA-Z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/i,
    dayGroup: 2,
    monthGroup: 1,
    yearGroup: 3,
  },
];
const LOW_IMPRESSIONS_NOTICES = [
  'número de impresiones bajo',
  'numero de impresiones bajo',
  'low number of impressions',
];
const MIN_BEST_IMAGE_WIDTH = 200;
const STREAMED_VIDEO_PROTOCOL = 'blob:';
const SINGLE_COPY = 1;

const MONTH_NUMBER_BY_NAME: Readonly<Record<string, string>> = {
  ene: '1',
  feb: '2',
  mar: '3',
  abr: '4',
  may: '5',
  jun: '6',
  jul: '7',
  ago: '8',
  sep: '9',
  sept: '9',
  oct: '10',
  nov: '11',
  dic: '12',
  jan: '1',
  apr: '4',
  aug: '8',
  dec: '12',
};

function readVisibleText(element: Element): string {
  const withVisibleText = element as Element & { readonly innerText?: string };
  return withVisibleText.innerText ?? element.textContent ?? '';
}

export function hasLowImpressionsNotice(text: string): boolean {
  const lowerCased = text.toLowerCase();
  return LOW_IMPRESSIONS_NOTICES.some((notice) => lowerCased.includes(notice));
}

export function readLibraryId(cardText: string): string {
  return LIBRARY_ID_PATTERN.exec(cardText)?.[1] ?? '';
}

export function readCopiesInRotation(cardText: string): number {
  for (const pattern of COPIES_IN_ROTATION_PATTERNS) {
    const copies = pattern.exec(cardText)?.[1];
    if (copies !== undefined) return Number.parseInt(copies, 10);
  }
  return SINGLE_COPY;
}

function monthNumberFor(monthName: string): string {
  const lowerCased = monthName.toLowerCase();
  return MONTH_NUMBER_BY_NAME[lowerCased] ?? MONTH_NUMBER_BY_NAME[lowerCased.slice(0, 3)] ?? '';
}

export function readCirculationDate(visibleText: string): AdCirculationDate | null {
  for (const format of CIRCULATION_DATE_FORMATS) {
    const match = format.pattern.exec(visibleText);
    if (!match) continue;

    const day = match[format.dayGroup] ?? '';
    const month = monthNumberFor(match[format.monthGroup] ?? '');
    const shortYear = (match[format.yearGroup] ?? '').slice(2);
    if (!day || !month || !shortYear) continue;

    return { day, month, shortYear };
  }

  return null;
}

export function readVideoUrl(card: Element): { readonly url: string; readonly isStreamed: boolean } {
  const video = card.querySelector('video');
  if (!video) return { url: '', isStreamed: false };

  let url = video.currentSrc || video.src || '';
  if (!url || url.startsWith(STREAMED_VIDEO_PROTOCOL)) {
    const source = video.querySelector('source');
    if (source && source.src) url = source.src;
  }

  return { url, isStreamed: url.startsWith(STREAMED_VIDEO_PROTOCOL) };
}

export function readWidestImageUrl(card: Element): string {
  let widestUrl = '';
  let widestWidth = 0;

  for (const image of card.querySelectorAll('img')) {
    const width = Math.max(image.naturalWidth || 0, image.getBoundingClientRect().width || 0);
    if (width > widestWidth && width > MIN_BEST_IMAGE_WIDTH) {
      widestWidth = width;
      widestUrl = image.currentSrc || image.src || '';
    }
  }

  return widestUrl;
}

export function readCreativeSources(card: Element): AdCreativeSources {
  const video = readVideoUrl(card);
  const posterUrl = card.querySelector('video')?.poster ?? '';

  return {
    videoUrl: video.url,
    isStreamedVideo: video.isStreamed,
    imageUrl: readWidestImageUrl(card),
    posterUrl,
  };
}

export function readAdFromCard(card: Element, fallbackBrand: string): Ad | null {
  const cardText = card.textContent ?? '';
  const libraryId = readLibraryId(cardText);
  if (!libraryId) return null;

  const visibleText = readVisibleText(card);
  const sources = readCreativeSources(card);

  return {
    libraryId,
    copiesInRotation: readCopiesInRotation(cardText),
    hasVideo: sources.videoUrl !== '',
    hasLowImpressions: hasLowImpressionsNotice(cardText),
    brand: fallbackBrand || brandFromAdvertiserText(visibleText),
    circulationDate: readCirculationDate(visibleText),
    sources,
  };
}

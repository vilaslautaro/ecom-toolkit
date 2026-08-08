import type { Ad, AdCirculationDate } from './types.js';

function formatCirculationDate(date: AdCirculationDate | null): string {
  if (!date) return '';
  return `${date.day}_${date.month}_${date.shortYear}`;
}

export function buildCreativeFileName(ad: Ad, extension: string): string {
  const segments = [
    `${ad.copiesInRotation}_ads`,
    formatCirculationDate(ad.circulationDate),
    ad.brand,
    ad.libraryId,
  ].filter((segment) => segment.length > 0);

  return `${segments.join('_')}.${extension}`;
}

const EXTENSION_BY_MIME_TYPE: ReadonlyArray<readonly [fragment: string, extension: string]> = [
  ['png', 'png'],
  ['webp', 'webp'],
  ['gif', 'gif'],
];

export function imageExtensionFor(mimeType: string): string {
  const match = EXTENSION_BY_MIME_TYPE.find(([fragment]) => mimeType.includes(fragment));
  return match ? match[1] : 'jpg';
}

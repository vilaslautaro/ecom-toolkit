import type { Ad } from '../domain/types.js';
import { brandFromSearchQuery } from '../domain/brand-name.js';
import { findAdCard, mentionsLibraryIdLabel } from './ad-card-locator.js';
import { readAdFromCard } from './ad-card-reader.js';

const LABEL_ELEMENT_SELECTOR = 'span,div';
const MAX_LABEL_ELEMENT_TEXT_LENGTH = 160;

function isLibraryIdLabelElement(element: Element): boolean {
  const text = element.textContent ?? '';
  return mentionsLibraryIdLabel(text) && text.length < MAX_LABEL_ELEMENT_TEXT_LENGTH;
}

export function scanAds(scannedDocument: Document = document): readonly Ad[] {
  const searchedBrand = brandFromSearchQuery(scannedDocument.location.href);
  const alreadySeenLibraryIds = new Set<string>();
  const ads: Ad[] = [];

  for (const element of scannedDocument.querySelectorAll(LABEL_ELEMENT_SELECTOR)) {
    if (!isLibraryIdLabelElement(element)) continue;

    const card = findAdCard(element);
    if (!card) continue;

    const ad = readAdFromCard(card, searchedBrand);
    if (!ad || alreadySeenLibraryIds.has(ad.libraryId)) continue;

    alreadySeenLibraryIds.add(ad.libraryId);
    ads.push(ad);
  }

  return ads;
}

export const LIBRARY_ID_LABEL_ES = 'Identificador de la biblioteca';
export const LIBRARY_ID_LABEL_EN = 'Library ID';

export const LABELED_LIBRARY_ID_SOURCE = `(?:${LIBRARY_ID_LABEL_ES}|${LIBRARY_ID_LABEL_EN})[:\\s]*([0-9]{5,})`;

const MAX_ANCESTOR_HOPS = 16;
const MIN_LOADED_CREATIVE_WIDTH = 150;

export function mentionsLibraryIdLabel(text: string): boolean {
  return text.includes(LIBRARY_ID_LABEL_ES) || text.includes(LIBRARY_ID_LABEL_EN);
}

export function countLibraryIds(text: string): number {
  return (text.match(new RegExp(LABELED_LIBRARY_ID_SOURCE, 'gi')) ?? []).length;
}

function isWideEnoughToBeCreative(image: HTMLImageElement): boolean {
  const renderedWidth = image.getBoundingClientRect().width;
  return (image.naturalWidth || 0) > MIN_LOADED_CREATIVE_WIDTH
    || renderedWidth > MIN_LOADED_CREATIVE_WIDTH;
}

function holdsLoadedCreative(container: Element): boolean {
  if (container.querySelector('video')) return true;
  return [...container.querySelectorAll('img')].some(isWideEnoughToBeCreative);
}

function spansMoreThanOneAd(text: string): boolean {
  return countLibraryIds(text) > 1;
}

export function findAdCard(labelElement: Element): Element | null {
  let candidate: Element | null = labelElement;

  for (let hop = 0; hop < MAX_ANCESTOR_HOPS && candidate; hop += 1) {
    const text = candidate.textContent ?? '';
    if (spansMoreThanOneAd(text)) return null;
    if (mentionsLibraryIdLabel(text) && holdsLoadedCreative(candidate)) return candidate;
    candidate = candidate.parentElement;
  }

  return null;
}

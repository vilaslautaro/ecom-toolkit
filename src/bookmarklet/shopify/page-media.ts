import { saveBlobAs } from '../downloads/file-saver.js';
import type { ProgressReporter } from '../domain/types.js';

const MINIMUM_IMAGE_WIDTH = 200;
const DELAY_BETWEEN_SAVES_MS = 350;

const PRODUCT_PATH_PATTERN = /\/products\/([a-z0-9-]+)/i;
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|avif)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v)$/i;
const MP4_SOURCE = /mp4/i;
const PROTOCOL_RELATIVE_PREFIX = '//';

const UNSAFE_FILE_NAME_CHARACTERS = /[^a-zA-Z0-9._-]+/g;
const REPEATED_SEPARATORS = /-{2,}/g;
const SURROUNDING_SEPARATORS = /^[-.]+|[-.]+$/g;
const MAX_FILE_NAME_LENGTH = 80;

const ANONYMOUS_REQUEST: RequestInit = { credentials: 'omit' };

interface ProductMediaSource {
  readonly url: string;
  readonly format?: string;
  readonly mime_type?: string;
  readonly height?: number;
}

interface ProductMedia {
  readonly sources?: readonly ProductMediaSource[];
}

interface ProductPayload {
  readonly images?: readonly string[];
  readonly media?: readonly ProductMedia[];
}

interface MediaKind {
  readonly namePrefix: string;
  readonly knownExtensions: RegExp;
  readonly defaultExtension: string;
  readonly emptyPageMessage: string;
  readonly pluralNoun: string;
  readonly savedVerb: string;
}

const IMAGE_KIND: MediaKind = {
  namePrefix: 'img',
  knownExtensions: IMAGE_EXTENSIONS,
  defaultExtension: '.jpg',
  emptyPageMessage: 'No encontré imágenes grandes.',
  pluralNoun: 'imágenes',
  savedVerb: 'Descargadas',
};

const VIDEO_KIND: MediaKind = {
  namePrefix: 'vid',
  knownExtensions: VIDEO_EXTENSIONS,
  defaultExtension: '.mp4',
  emptyPageMessage: 'No encontré videos en esta página.',
  pluralNoun: 'videos',
  savedVerb: 'Descargados',
};

function absoluteUrl(url: string): string {
  return url.startsWith(PROTOCOL_RELATIVE_PREFIX) ? `https:${url}` : url;
}

function currentProductHandle(): string | null {
  return location.pathname.match(PRODUCT_PATH_PATTERN)?.[1] ?? null;
}

async function fetchCurrentProduct(): Promise<ProductPayload | null> {
  const handle = currentProductHandle();
  if (!handle) return null;

  try {
    const response = await fetch(`${location.origin}/products/${handle}.js`, ANONYMOUS_REQUEST);
    if (!response.ok) return null;
    return (await response.json()) as ProductPayload;
  } catch {
    return null;
  }
}

function renderedImageWidth(image: HTMLImageElement): number {
  return Math.max(image.naturalWidth || 0, image.getBoundingClientRect().width || 0);
}

function pageImageUrls(): readonly string[] {
  const urls = new Set<string>();

  for (const image of document.querySelectorAll('img')) {
    const source = image.currentSrc || image.src;
    if (!source.startsWith('http')) continue;
    if (renderedImageWidth(image) >= MINIMUM_IMAGE_WIDTH) urls.add(source);
  }

  return [...urls];
}

function pageVideoUrls(): readonly string[] {
  const urls = new Set<string>();

  for (const video of document.querySelectorAll('video')) {
    const source = video.currentSrc || video.src;
    if (source.startsWith('http')) urls.add(source);

    for (const element of video.querySelectorAll('source')) {
      const nested = element.src || element.getAttribute('src') || '';
      if (nested.startsWith('http')) urls.add(nested);
    }
  }

  return [...urls];
}

function tallestMp4Source(media: ProductMedia): string {
  const sources = media.sources ?? [];
  let tallest = '';
  let tallestHeight = -1;

  for (const source of sources) {
    if (!MP4_SOURCE.test(`${source.format ?? ''}${source.mime_type ?? ''}`)) continue;
    const height = source.height ?? 0;
    if (height >= tallestHeight) {
      tallestHeight = height;
      tallest = source.url;
    }
  }

  const firstSource = sources[0];
  if (!tallest && firstSource) tallest = firstSource.url;

  return tallest;
}

function sanitizeFileName(name: string): string {
  return name
    .replace(UNSAFE_FILE_NAME_CHARACTERS, '-')
    .replace(REPEATED_SEPARATORS, '-')
    .replace(SURROUNDING_SEPARATORS, '')
    .slice(0, MAX_FILE_NAME_LENGTH);
}

function fileNameFor(url: string, index: number, kind: MediaKind): string {
  const lastSegment = url.split('/').pop() ?? '';
  const withoutQuery = lastSegment.split('?')[0] ?? '';
  const sanitized = sanitizeFileName(withoutQuery);
  const name = sanitized || `${kind.namePrefix}${index}`;

  return kind.knownExtensions.test(name) ? name : `${name}${kind.defaultExtension}`;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function fetchBlobOrNull(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url, ANONYMOUS_REQUEST);
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

async function saveAll(
  urls: readonly string[],
  kind: MediaKind,
  report: ProgressReporter,
): Promise<void> {
  if (urls.length === 0) {
    report(kind.emptyPageMessage);
    return;
  }

  report(`Descargando ${urls.length} ${kind.pluralNoun}…`);
  let saved = 0;

  for (const [index, url] of urls.entries()) {
    const blob = await fetchBlobOrNull(url);
    if (blob) {
      saveBlobAs(blob, `${kind.namePrefix}_${index + 1}_${fileNameFor(url, index, kind)}`);
      saved++;
    }
    await delay(DELAY_BETWEEN_SAVES_MS);
    report(`${kind.savedVerb} ${saved}/${urls.length}…`);
  }

  report(`✓ Listo: ${saved} ${kind.pluralNoun}.`);
}

export async function downloadPageImages(report: ProgressReporter): Promise<void> {
  const urls = new Set(pageImageUrls());
  const product = await fetchCurrentProduct();

  for (const image of product?.images ?? []) urls.add(absoluteUrl(image));

  await saveAll([...urls], IMAGE_KIND, report);
}

export async function downloadPageVideos(report: ProgressReporter): Promise<void> {
  const urls = new Set(pageVideoUrls());
  const product = await fetchCurrentProduct();

  for (const media of product?.media ?? []) {
    if (!media.sources) continue;
    const source = tallestMp4Source(media);
    if (source) urls.add(absoluteUrl(source));
  }

  await saveAll([...urls], VIDEO_KIND, report);
}

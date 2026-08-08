export type AdLibraryLocale = 'es' | 'en';

export type AdCardMedia = 'video' | 'image' | 'none';

export interface AdCardOptions {
  readonly libraryId: string;
  readonly locale?: AdLibraryLocale;
  readonly copiesInRotation?: number;
  readonly media?: AdCardMedia;
  readonly lowImpressions?: boolean;
  readonly circulationDate?: string;
  readonly advertiserDomain?: string;
  readonly videoUrl?: string;
  readonly posterUrl?: string;
  readonly imageUrl?: string;
  readonly imageNaturalWidth?: number;
}

export interface AdLibraryPageOptions {
  readonly resultTotal?: string;
  readonly locale?: AdLibraryLocale;
}

interface LocaleTexts {
  readonly libraryIdLabel: string;
  readonly monthNames: readonly string[];
  readonly circulationDate: (day: number, monthName: string, year: number) => string;
  readonly copiesInRotation: (copies: number) => string;
  readonly lowImpressions: string;
  readonly sponsored: (domain: string) => string;
  readonly resultTotal: (total: string) => string;
  readonly pageLanguage: string;
}

const SPANISH_MONTH_NAMES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

const ENGLISH_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const TEXTS_BY_LOCALE: Readonly<Record<AdLibraryLocale, LocaleTexts>> = {
  es: {
    libraryIdLabel: 'Identificador de la biblioteca',
    monthNames: SPANISH_MONTH_NAMES,
    circulationDate: (day, monthName, year) =>
      `En circulación desde el ${day} ${monthName}. ${year}`,
    copiesInRotation: (copies) => `${copies} anuncios usan este contenido`,
    lowImpressions: 'Número de impresiones bajo',
    sponsored: (domain) => `Patrocinado · ${domain}`,
    resultTotal: (total) => `~${total} resultados`,
    pageLanguage: 'es',
  },
  en: {
    libraryIdLabel: 'Library ID',
    monthNames: ENGLISH_MONTH_NAMES,
    circulationDate: (day, monthName, year) => `Started running on ${monthName} ${day}, ${year}`,
    copiesInRotation: (copies) => `${copies} ads use this creative and text`,
    lowImpressions: 'Low number of impressions',
    sponsored: (domain) => `Sponsored · ${domain}`,
    resultTotal: (total) => `~${total} results`,
    pageLanguage: 'en',
  },
};

const DEFAULT_CIRCULATION_DATE = '27/6/2026';
const DEFAULT_IMAGE_NATURAL_WIDTH = 800;
const DEFAULT_COPIES_IN_ROTATION = 1;

export const AD_LIBRARY_URL =
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=lamarca&search_type=keyword_unordered';

function formatCirculationDate(date: string, texts: LocaleTexts): string {
  const [day = '1', month = '1', year = '2026'] = date.split('/');
  const monthName = texts.monthNames[Number(month) - 1] ?? texts.monthNames[0] ?? '';

  return texts.circulationDate(Number(day), monthName, Number(year));
}

function mediaHtml(options: AdCardOptions): string {
  const media = options.media ?? 'video';
  if (media === 'none') return '';

  if (media === 'video') {
    const videoUrl = options.videoUrl ?? `https://video.xx.fbcdn.net/v/${options.libraryId}.mp4`;
    const posterUrl =
      options.posterUrl ?? `https://scontent.xx.fbcdn.net/v/${options.libraryId}_poster.jpg`;
    return `<video class="x4" src="${videoUrl}" poster="${posterUrl}"></video>`;
  }

  const imageUrl = options.imageUrl ?? `https://scontent.xx.fbcdn.net/v/${options.libraryId}.jpg`;
  const naturalWidth = options.imageNaturalWidth ?? DEFAULT_IMAGE_NATURAL_WIDTH;
  return `<img class="x4" src="${imageUrl}" data-natural-width="${naturalWidth}">`;
}

export function adCard(options: AdCardOptions): string {
  const texts = TEXTS_BY_LOCALE[options.locale ?? 'es'];
  const copies = options.copiesInRotation ?? DEFAULT_COPIES_IN_ROTATION;

  const circulationDate = formatCirculationDate(
    options.circulationDate ?? DEFAULT_CIRCULATION_DATE,
    texts,
  );
  const copiesLine =
    copies > DEFAULT_COPIES_IN_ROTATION
      ? `<div class="x1 repeat">${texts.copiesInRotation(copies)}</div>`
      : '';
  const lowImpressionsLine = options.lowImpressions
    ? `<div class="x2 low">${texts.lowImpressions}</div>`
    : '';
  const advertiserLine = options.advertiserDomain
    ? `<div class="x3 adv">${texts.sponsored(options.advertiserDomain)}</div>`
    : '';

  return `
<div class="_7jvw ad-card" data-testid="ad-card">
  <div class="_8n_z">
    <div class="_9k1p">${mediaHtml(options)}</div>
    <div class="_2ab4">
      ${lowImpressionsLine}
      <div class="_3cd5">
        <span class="_4ef6">${texts.libraryIdLabel}: ${options.libraryId}</span>
      </div>
      <div class="_5gh7">${circulationDate}</div>
      ${copiesLine}
      ${advertiserLine}
    </div>
  </div>
</div>`;
}

export function adLibraryPage(
  cards: readonly string[],
  options: AdLibraryPageOptions = {},
): string {
  const texts = TEXTS_BY_LOCALE[options.locale ?? 'es'];
  const resultTotalLine =
    options.resultTotal === undefined
      ? ''
      : `<div class="_res">${texts.resultTotal(options.resultTotal)}</div>`;

  return `<!doctype html><html lang="${texts.pageLanguage}"><body>
<div id="facebook">
  ${resultTotalLine}
  <div class="_grid">${cards.join('\n')}</div>
</div>
</body></html>`;
}

import { fetchAllProducts, fetchBestSellingHandles, isShopifyStore, storeCurrency } from './shopify-api.js';
import { buildStoreInsights, publishedDateOf } from './store-insights.js';
import { downloadPageImages, downloadPageVideos } from './page-media.js';
import { adLibrarySearchUrl, detectStoreBrand } from './store-brand.js';
import type {
  PriceRange,
  ProgressReporter,
  ShopifyProduct,
  StoreInsights,
} from '../domain/types.js';

const PANEL_ID = 'mald-panel';
const CLOSE_ID = 'mald-close';
const BODY_ID = 'mald-body';
const IMAGES_BUTTON_ID = 'mald-imgs';
const VIDEOS_BUTTON_ID = 'mald-vids';
const STATUS_ID = 'mald-imgstat';

const BUSY_OPACITY = '0.6';
const IDLE_OPACITY = '1';

const EMPTY_DATE = '—';
const PRODUCT_PATH = '/products/';
const EXTERNAL_TARGET = '_blank';
const EXTERNAL_RELATIONSHIP = 'noopener noreferrer';

const PANEL_STYLE =
  'position:fixed;top:70px;right:16px;z-index:2147483647;width:330px;max-height:86vh;overflow:auto;background:#12151b;color:#eef1f5;font:13px system-ui;border:1px solid #2b313b;border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.55);padding:15px';
const HEADER_STYLE =
  'font-weight:800;font-size:15px;display:flex;justify-content:space-between;align-items:center';
const CLOSE_STYLE = 'cursor:pointer;opacity:.5;font-size:17px';
const BODY_STYLE = 'margin-top:12px;color:#98a2b3';
const IMAGES_BUTTON_STYLE =
  'width:100%;margin-top:12px;background:#2b313b;color:#fff;border:1px solid #3a4150;border-radius:9px;padding:10px;cursor:pointer;font-weight:700';
const VIDEOS_BUTTON_STYLE =
  'width:100%;margin-top:8px;background:#2b313b;color:#fff;border:1px solid #3a4150;border-radius:9px;padding:10px;cursor:pointer;font-weight:700';
const STATUS_STYLE = 'font-size:11px;color:#98a2b3;margin-top:6px';
const NOTICE_STYLE = 'color:#f4d9a3;font-size:12.5px';
const AD_LIBRARY_LINK_STYLE =
  'display:block;text-align:center;margin-top:12px;background:#3b82f6;color:#fff;border-radius:9px;padding:11px;font-weight:700;text-decoration:none';
const BRAND_STYLE = 'font-size:12px;color:#8ec5ff;margin-bottom:10px';
const BEST_SELLERS_TITLE_STYLE = 'font-weight:700;margin-bottom:7px';
const RANKING_NOTICE_STYLE = 'font-size:11px;color:#98a2b3;margin-bottom:8px';
const BEST_SELLER_ROW_STYLE =
  'display:flex;gap:9px;align-items:center;margin-bottom:8px;text-decoration:none;color:#eef1f5';
const BEST_SELLER_POSITION_STYLE = 'width:18px;color:#98a2b3;font-weight:700';
const THUMBNAIL_STYLE = 'width:42px;height:42px;object-fit:cover;border-radius:7px';
const THUMBNAIL_PLACEHOLDER_STYLE = 'width:42px;height:42px;border-radius:7px;background:#1f242c';
const BEST_SELLER_DETAILS_STYLE = 'flex:1;min-width:0';
const BEST_SELLER_TITLE_STYLE =
  'font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
const BEST_SELLER_PRICE_STYLE = 'font-size:11.5px;color:#7fd1a0';
const BEST_SELLER_DATE_STYLE = 'font-size:10.5px;color:#98a2b3';
const STATS_STYLE =
  'border-top:1px solid #2b313b;margin-top:9px;padding-top:9px;font-size:12.5px;line-height:1.9';
const AVERAGE_PRICE_STYLE = 'color:#98a2b3';

const TITLE_TEXT = '🧰 Ecom Toolkit';
const CLOSE_TEXT = '✕';
const LOADING_TEXT = 'Cargando datos de la tienda…';
const IMAGES_BUTTON_LABEL = '🖼️ Descargar todas las imágenes';
const VIDEOS_BUTTON_LABEL = '🎬 Descargar todos los videos';
const AD_LIBRARY_LABEL = '🔎 Ver anuncios en la Ad Library';
const BEST_SELLERS_TITLE = '🏆 Top 3 más vendidos';
const CATALOGUE_PRODUCTS_TITLE = '📦 Productos de la tienda';
const NO_RANKING_NOTICE = 'Esta tienda no expone su ranking de más vendidos.';
const PARTIAL_RANKING_NOTICE_PREFIX = 'Solo los primeros ';
const PARTIAL_RANKING_NOTICE_SUFFIX = ' salen del ranking real.';
const NO_NOTICE = '';
const PRODUCT_COUNT_LABEL = '📦 Productos: ';
const PRICE_RANGE_LABEL = '💲 Precios: ';
const PRICE_RANGE_SEPARATOR = ' – ';
const AVERAGE_PRICE_PREFIX = '(prom ';
const AVERAGE_PRICE_SUFFIX = ')';
const FIRST_PUBLISHED_LABEL = '🗓 Primer producto: ';
const LAST_PUBLISHED_LABEL = '🆕 Último producto: ';
const PUBLISHED_DATE_PREFIX = '🗓 ';
const NOT_SHOPIFY_TEXT =
  'Esto no parece una tienda Shopify (o no expone sus datos). Igual podés ver sus anuncios:';
const UNREADABLE_PRODUCTS_TEXT =
  'No pude leer los productos (la tienda puede tenerlos ocultos). Igual podés ver sus anuncios:';

interface StorePanelElements {
  readonly panel: HTMLDivElement;
  readonly closeButton: HTMLSpanElement;
  readonly body: HTMLDivElement;
  readonly imagesButton: HTMLButtonElement;
  readonly videosButton: HTMLButtonElement;
  readonly status: HTMLDivElement;
}

function createStyledElement<Tag extends keyof HTMLElementTagNameMap>(
  tagName: Tag,
  style: string,
): HTMLElementTagNameMap[Tag] {
  const element = document.createElement(tagName);
  element.style.cssText = style;
  return element;
}

function createExternalLink(url: string, style: string): HTMLAnchorElement {
  const link = createStyledElement('a', style);
  link.href = url;
  link.target = EXTERNAL_TARGET;
  link.rel = EXTERNAL_RELATIONSHIP;
  return link;
}

function createTextElement<Tag extends keyof HTMLElementTagNameMap>(
  tagName: Tag,
  style: string,
  text: string,
): HTMLElementTagNameMap[Tag] {
  const element = createStyledElement(tagName, style);
  element.textContent = text;
  return element;
}

function createBoldValue(text: string): HTMLElement {
  const value = document.createElement('b');
  value.textContent = text;
  return value;
}

function formatDate(date: Date | null): string {
  return date ? date.toLocaleDateString() : EMPTY_DATE;
}

function formatPrice(currency: string, amount: string): string {
  return currency === '' ? amount : `${currency} ${amount}`;
}

function createDownloadButton(id: string, style: string, label: string): HTMLButtonElement {
  const button = createTextElement('button', style, label);
  button.id = id;
  return button;
}

function createAdLibraryLink(brand: string): HTMLAnchorElement {
  const link = createExternalLink(adLibrarySearchUrl(brand), AD_LIBRARY_LINK_STYLE);
  link.textContent = AD_LIBRARY_LABEL;
  return link;
}

function createNotice(text: string): HTMLDivElement {
  return createTextElement('div', NOTICE_STYLE, text);
}

function createThumbnail(product: ShopifyProduct): HTMLElement {
  const imageUrl = product.images?.[0]?.src ?? '';
  if (imageUrl === '') return createStyledElement('div', THUMBNAIL_PLACEHOLDER_STYLE);

  const thumbnail = createStyledElement('img', THUMBNAIL_STYLE);
  thumbnail.src = imageUrl;
  return thumbnail;
}

function createBestSellerDetails(product: ShopifyProduct, currency: string): HTMLDivElement {
  const details = createStyledElement('div', BEST_SELLER_DETAILS_STYLE);
  const price = product.variants?.[0]?.price ?? '';

  details.append(
    createTextElement('div', BEST_SELLER_TITLE_STYLE, product.title),
    createTextElement('div', BEST_SELLER_PRICE_STYLE, formatPrice(currency, price)),
  );

  const publishedAt = publishedDateOf(product);
  if (publishedAt) {
    details.append(
      createTextElement(
        'div',
        BEST_SELLER_DATE_STYLE,
        PUBLISHED_DATE_PREFIX + formatDate(publishedAt),
      ),
    );
  }

  return details;
}

function createBestSellerRow(
  product: ShopifyProduct,
  position: number,
  origin: string,
  currency: string,
): HTMLAnchorElement {
  const row = createExternalLink(origin + PRODUCT_PATH + product.handle, BEST_SELLER_ROW_STYLE);

  row.append(
    createTextElement('div', BEST_SELLER_POSITION_STYLE, String(position)),
    createThumbnail(product),
    createBestSellerDetails(product, currency),
  );

  return row;
}

function createStatLine(label: string, value: string): HTMLDivElement {
  const line = document.createElement('div');
  line.append(label, createBoldValue(value));
  return line;
}

function createPriceRangeLine(priceRange: PriceRange): HTMLDivElement {
  const range =
    formatPrice(priceRange.currency, priceRange.lowest.toFixed(2))
    + PRICE_RANGE_SEPARATOR
    + priceRange.highest.toFixed(2);

  const line = createStatLine(PRICE_RANGE_LABEL, range);
  const average = createTextElement(
    'span',
    AVERAGE_PRICE_STYLE,
    AVERAGE_PRICE_PREFIX
      + formatPrice(priceRange.currency, priceRange.average.toFixed(2))
      + AVERAGE_PRICE_SUFFIX,
  );

  line.append(' ', average);
  return line;
}

function createStatsSection(insights: StoreInsights): HTMLDivElement {
  const stats = createStyledElement('div', STATS_STYLE);

  stats.append(
    createStatLine(PRODUCT_COUNT_LABEL, String(insights.sellableProductCount)),
    createPriceRangeLine(insights.priceRange),
    createStatLine(FIRST_PUBLISHED_LABEL, formatDate(insights.firstPublishedAt)),
    createStatLine(LAST_PUBLISHED_LABEL, formatDate(insights.lastPublishedAt)),
  );

  return stats;
}

interface BestSellersHeading {
  readonly title: string;
  readonly notice: string;
}

function headingFor(insights: StoreInsights): BestSellersHeading {
  if (insights.rankedProductCount >= insights.bestSellers.length) {
    return { title: BEST_SELLERS_TITLE, notice: NO_NOTICE };
  }

  if (insights.rankedProductCount === 0) {
    return { title: CATALOGUE_PRODUCTS_TITLE, notice: NO_RANKING_NOTICE };
  }

  return {
    title: BEST_SELLERS_TITLE,
    notice:
      PARTIAL_RANKING_NOTICE_PREFIX
      + String(insights.rankedProductCount)
      + PARTIAL_RANKING_NOTICE_SUFFIX,
  };
}

function createBestSellersHeading(insights: StoreInsights): readonly Element[] {
  if (insights.bestSellers.length === 0) return [];

  const heading = headingFor(insights);
  const title = createTextElement('div', BEST_SELLERS_TITLE_STYLE, heading.title);
  if (heading.notice === NO_NOTICE) return [title];

  return [title, createTextElement('div', RANKING_NOTICE_STYLE, heading.notice)];
}

function createInsightsSection(insights: StoreInsights, origin: string): readonly Element[] {
  const bestSellers = insights.bestSellers.map((product, index) =>
    createBestSellerRow(product, index + 1, origin, insights.priceRange.currency),
  );

  return [
    createTextElement('div', BRAND_STYLE, insights.brand),
    ...createBestSellersHeading(insights),
    ...bestSellers,
    createStatsSection(insights),
  ];
}

function createPanelElements(): StorePanelElements {
  const panel = createStyledElement('div', PANEL_STYLE);
  panel.id = PANEL_ID;

  const header = createStyledElement('div', HEADER_STYLE);
  const title = document.createElement('span');
  title.textContent = TITLE_TEXT;
  const closeButton = createTextElement('span', CLOSE_STYLE, CLOSE_TEXT);
  closeButton.id = CLOSE_ID;
  header.append(title, closeButton);

  const body = createTextElement('div', BODY_STYLE, LOADING_TEXT);
  body.id = BODY_ID;

  const imagesButton = createDownloadButton(
    IMAGES_BUTTON_ID,
    IMAGES_BUTTON_STYLE,
    IMAGES_BUTTON_LABEL,
  );
  const videosButton = createDownloadButton(
    VIDEOS_BUTTON_ID,
    VIDEOS_BUTTON_STYLE,
    VIDEOS_BUTTON_LABEL,
  );

  const status = createStyledElement('div', STATUS_STYLE);
  status.id = STATUS_ID;

  panel.append(header, body, imagesButton, videosButton, status);

  return { panel, closeButton, body, imagesButton, videosButton, status };
}

function showBodyContent(body: HTMLElement, content: readonly Element[], brand: string): void {
  body.replaceChildren(...content, createAdLibraryLink(brand));
}

async function loadStoreInsights(origin: string, brand: string): Promise<StoreInsights | null> {
  try {
    const products = await fetchAllProducts(origin);
    if (products.length === 0) return null;

    const handles = new Set(products.map((product) => product.handle));
    const bestSellingHandles = await fetchBestSellingHandles(origin, (handle) => handles.has(handle));

    return buildStoreInsights({
      brand,
      currency: storeCurrency(),
      products,
      bestSellingHandles,
    });
  } catch {
    return null;
  }
}

function wireDownloadButton(
  button: HTMLButtonElement,
  status: HTMLElement,
  download: (report: ProgressReporter) => Promise<void>,
): void {
  button.onclick = async () => {
    if (button.disabled) return;
    button.disabled = true;
    button.style.opacity = BUSY_OPACITY;
    try {
      await download((message) => {
        status.textContent = message;
      });
    } finally {
      button.disabled = false;
      button.style.opacity = IDLE_OPACITY;
    }
  };
}

export async function buildStorePanel(): Promise<void> {
  if (document.getElementById(PANEL_ID)) return;

  const brand = detectStoreBrand();
  const origin = location.origin;

  const elements = createPanelElements();
  document.body.appendChild(elements.panel);

  elements.closeButton.onclick = () => elements.panel.remove();
  wireDownloadButton(elements.imagesButton, elements.status, downloadPageImages);
  wireDownloadButton(elements.videosButton, elements.status, downloadPageVideos);

  if (!isShopifyStore()) {
    showBodyContent(elements.body, [createNotice(NOT_SHOPIFY_TEXT)], brand);
    return;
  }

  const insights = await loadStoreInsights(origin, brand);

  showBodyContent(
    elements.body,
    insights ? createInsightsSection(insights, origin) : [createNotice(UNREADABLE_PRODUCTS_TEXT)],
    brand,
  );
}

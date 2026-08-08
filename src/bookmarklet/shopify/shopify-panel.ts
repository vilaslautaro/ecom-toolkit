import { fetchAllProducts, fetchBestSellingHandles, isShopifyStore, storeCurrency } from './shopify-api.js';
import { buildStoreInsights } from './store-insights.js';
import { downloadPageImages, downloadPageVideos } from './page-media.js';
import { adLibrarySearchUrl, detectStoreBrand } from './store-brand.js';
import type { ProgressReporter, ShopifyProduct, StoreInsights } from '../domain/types.js';

const PANEL_ID = 'mald-panel';
const CLOSE_ID = 'mald-close';
const BODY_ID = 'mald-body';
const IMAGES_BUTTON_ID = 'mald-imgs';
const VIDEOS_BUTTON_ID = 'mald-vids';
const STATUS_ID = 'mald-imgstat';

const BUSY_OPACITY = '0.6';
const IDLE_OPACITY = '1';

const LESS_THAN = /</g;
const EMPTY_DATE = '—';

const PANEL_STYLE =
  'position:fixed;top:70px;right:16px;z-index:2147483647;width:330px;max-height:86vh;overflow:auto;background:#12151b;color:#eef1f5;font:13px system-ui;border:1px solid #2b313b;border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.55);padding:15px';

const PANEL_SHELL_HTML = [
  '<div style="font-weight:800;font-size:15px;display:flex;justify-content:space-between;align-items:center"><span>🧰 Ecom Toolkit</span>',
  `<span id="${CLOSE_ID}" style="cursor:pointer;opacity:.5;font-size:17px">✕</span></div>`,
  `<div id="${BODY_ID}" style="margin-top:12px;color:#98a2b3">Cargando datos de la tienda…</div>`,
  `<button id="${IMAGES_BUTTON_ID}" style="width:100%;margin-top:12px;background:#2b313b;color:#fff;border:1px solid #3a4150;border-radius:9px;padding:10px;cursor:pointer;font-weight:700">🖼️ Descargar todas las imágenes</button>`,
  `<button id="${VIDEOS_BUTTON_ID}" style="width:100%;margin-top:8px;background:#2b313b;color:#fff;border:1px solid #3a4150;border-radius:9px;padding:10px;cursor:pointer;font-weight:700">🎬 Descargar todos los videos</button>`,
  `<div id="${STATUS_ID}" style="font-size:11px;color:#98a2b3;margin-top:6px"></div>`,
].join('');

const NOT_SHOPIFY_HTML =
  '<div style="color:#f4d9a3;font-size:12.5px">Esto no parece una tienda Shopify (o no expone sus datos). Igual podés ver sus anuncios:</div>';

const UNREADABLE_PRODUCTS_HTML =
  '<div style="color:#f4d9a3;font-size:12.5px">No pude leer los productos (la tienda puede tenerlos ocultos). Igual podés ver sus anuncios:</div>';

function escapeText(value: string): string {
  return value.replace(LESS_THAN, '&lt;');
}

function formatDate(date: Date | null): string {
  return date ? date.toLocaleDateString() : EMPTY_DATE;
}

function adLibraryButtonHtml(brand: string): string {
  return `<a href="${adLibrarySearchUrl(brand)}" target="_blank" style="display:block;text-align:center;margin-top:12px;background:#3b82f6;color:#fff;border-radius:9px;padding:11px;font-weight:700;text-decoration:none">🔎 Ver anuncios en la Ad Library</a>`;
}

function bestSellerHtml(product: ShopifyProduct, position: number, origin: string, currency: string): string {
  const imageUrl = product.images?.[0]?.src ?? '';
  const price = product.variants?.[0]?.price ?? '';
  const thumbnail = imageUrl
    ? `<img src="${imageUrl}" style="width:42px;height:42px;object-fit:cover;border-radius:7px">`
    : '<div style="width:42px;height:42px;border-radius:7px;background:#1f242c"></div>';

  return `<a href="${origin}/products/${product.handle}" target="_blank" style="display:flex;gap:9px;align-items:center;margin-bottom:8px;text-decoration:none;color:#eef1f5"><div style="width:18px;color:#98a2b3;font-weight:700">${position}</div>${thumbnail}<div style="flex:1;min-width:0"><div style="font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeText(product.title)}</div><div style="font-size:11.5px;color:#7fd1a0">${escapeText(currency)} ${escapeText(price)}</div></div></a>`;
}

function statsHtml(insights: StoreInsights): string {
  const currency = escapeText(insights.priceRange.currency);
  const lowest = insights.priceRange.lowest.toFixed(2);
  const highest = insights.priceRange.highest.toFixed(2);
  const average = insights.priceRange.average.toFixed(2);

  return `<div style="border-top:1px solid #2b313b;margin-top:9px;padding-top:9px;font-size:12.5px;line-height:1.9"><div>📦 Productos: <b>${insights.sellableProductCount}</b></div><div>💲 Precios: <b>${currency} ${lowest} – ${highest}</b> <span style="color:#98a2b3">(prom ${currency} ${average})</span></div><div>🗓 Primer producto: <b>${formatDate(insights.firstPublishedAt)}</b></div><div>🆕 Último producto: <b>${formatDate(insights.lastPublishedAt)}</b></div></div>`;
}

function insightsHtml(insights: StoreInsights, origin: string): string {
  const header = `<div style="font-size:12px;color:#8ec5ff;margin-bottom:10px">${escapeText(insights.brand)}</div><div style="font-weight:700;margin-bottom:7px">🏆 Top 3 más vendidos</div>`;

  const bestSellers = insights.bestSellers
    .map((product, index) => bestSellerHtml(product, index + 1, origin, insights.priceRange.currency))
    .join('');

  return header + bestSellers + statsHtml(insights);
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
  const adLibraryButton = adLibraryButtonHtml(brand);

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.style.cssText = PANEL_STYLE;
  panel.innerHTML = PANEL_SHELL_HTML;
  document.body.appendChild(panel);

  const closeButton = panel.querySelector<HTMLElement>(`#${CLOSE_ID}`);
  const body = panel.querySelector<HTMLElement>(`#${BODY_ID}`);
  const imagesButton = panel.querySelector<HTMLButtonElement>(`#${IMAGES_BUTTON_ID}`);
  const videosButton = panel.querySelector<HTMLButtonElement>(`#${VIDEOS_BUTTON_ID}`);
  const status = panel.querySelector<HTMLElement>(`#${STATUS_ID}`);
  if (!closeButton || !body || !imagesButton || !videosButton || !status) return;

  closeButton.onclick = () => panel.remove();
  wireDownloadButton(imagesButton, status, downloadPageImages);
  wireDownloadButton(videosButton, status, downloadPageVideos);

  if (!isShopifyStore()) {
    body.innerHTML = NOT_SHOPIFY_HTML + adLibraryButton;
    return;
  }

  const insights = await loadStoreInsights(origin, brand);

  body.innerHTML = insights
    ? insightsHtml(insights, origin) + adLibraryButton
    : UNREADABLE_PRODUCTS_HTML + adLibraryButton;
}

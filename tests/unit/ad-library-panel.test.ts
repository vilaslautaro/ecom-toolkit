import { describe, it, expect, afterEach } from 'vitest';
import { buildAdLibraryPanel } from '../../src/bookmarklet/ad-library/ad-library-panel.js';
import { adCard, adLibraryPage, AD_LIBRARY_URL } from '../support/ad-library-fixtures.js';
import type { AdLibraryLocale } from '../support/ad-library-fixtures.js';
import { buildSessionConfig } from '../support/ad-fixtures.js';
import { closeOpenPages, createPageEnvironment } from '../support/page-environment.js';
import type { PageEnvironment } from '../support/page-environment.js';
import { waitFor } from '../support/wait-for.js';

afterEach(closeOpenPages);

const PANEL_SELECTOR = '#mald-panel';
const LOG_SELECTOR = '#mald-log';
const TOTAL_SELECTOR = '#mald-total';
const COUNT_SELECTOR = '#mald-count';
const START_SELECTOR = '#mald-start';
const STOP_SELECTOR = '#mald-stop';
const CLOSE_SELECTOR = '#mald-close';
const MINIMUM_COPIES_SELECTOR = '#mald-minads';
const MAXIMUM_DOWNLOADS_SELECTOR = '#mald-max';
const SKIP_LOW_SELECTOR = '#mald-skiplow';
const CREATIVE_SELECTION_SELECTOR = '#mald-tipo';

const FAST_DELAY_MS = 1;

function panelDefaults(delayBetweenDownloadsMs: number) {
  return buildSessionConfig({
    minimumCopiesInRotation: 2,
    creativeSelection: 'auto',
    skipLowImpressions: true,
    maximumDownloads: 50,
    delayBetweenDownloadsMs,
  });
}

interface PanelOptions {
  readonly resultTotal?: string;
  readonly locale?: AdLibraryLocale;
  readonly autoStart?: boolean;
  readonly delayBetweenDownloadsMs?: number;
}

interface PanelContext {
  readonly environment: PageEnvironment;
  readonly textOf: (selector: string) => string;
  readonly fill: (selector: string, value: string) => void;
  readonly click: (selector: string) => void;
  readonly waitForLog: (fragment: string) => Promise<void>;
  readonly waitForDownloads: (count: number) => Promise<void>;
}

function openPanel(cards: readonly string[], options: PanelOptions = {}): PanelContext {
  const locale = options.locale ?? 'es';
  const environment = createPageEnvironment({
    url: AD_LIBRARY_URL,
    html:
      options.resultTotal === undefined
        ? adLibraryPage(cards, { locale })
        : adLibraryPage(cards, { locale, resultTotal: options.resultTotal }),
  });
  environment.stubFetch({ default: { byteSize: 2048, contentType: 'video/mp4' } });

  buildAdLibraryPanel({
    defaults: panelDefaults(options.delayBetweenDownloadsMs ?? FAST_DELAY_MS),
    autoStart: options.autoStart ?? false,
  });

  const textOf = (selector: string): string =>
    environment.document.querySelector(selector)?.textContent ?? '';

  return {
    environment,
    textOf,
    fill: (selector, value) => {
      const field = environment.document.querySelector<HTMLInputElement>(selector);
      if (field) field.value = value;
    },
    click: (selector) => {
      environment.document.querySelector<HTMLElement>(selector)?.click();
    },
    waitForLog: (fragment) =>
      waitFor(`the log to mention ${fragment}`, () => textOf(LOG_SELECTOR).includes(fragment)),
    waitForDownloads: (count) =>
      waitFor(`${count} saved creatives`, () => environment.downloads.length >= count),
  };
}

describe('buildAdLibraryPanel', () => {
  it('mounts the panel with its title and the fields filled from the saved configuration', () => {
    const context = openPanel([]);
    const { document } = context.environment;

    expect(context.textOf(PANEL_SELECTOR)).toContain('Ecom Toolkit');
    expect(document.querySelector<HTMLInputElement>(MINIMUM_COPIES_SELECTOR)?.value).toBe('2');
    expect(document.querySelector<HTMLInputElement>(MAXIMUM_DOWNLOADS_SELECTOR)?.value).toBe('50');
    expect(document.querySelector<HTMLInputElement>(SKIP_LOW_SELECTOR)?.checked).toBe(true);
    expect(document.querySelector<HTMLSelectElement>(CREATIVE_SELECTION_SELECTOR)?.value).toBe(
      'auto',
    );
  });

  it('shows how many ads the search reported', () => {
    const context = openPanel([adCard({ libraryId: '100000000000001' })], { resultTotal: '550' });

    expect(context.textOf(TOTAL_SELECTOR)).toBe('Anuncios en esta búsqueda: ~550');
  });

  it('shows the total of an English search, thousands separator included', () => {
    const context = openPanel([adCard({ locale: 'en', libraryId: '1249043200627555' })], {
      locale: 'en',
      resultTotal: '48,000',
    });

    expect(context.textOf(TOTAL_SELECTOR)).toBe('Anuncios en esta búsqueda: ~48,000');
  });

  it('leaves the total line empty when the page never reported a result count', () => {
    const context = openPanel([adCard({ libraryId: '100000000000001' })]);

    expect(context.textOf(TOTAL_SELECTOR)).toBe('');
  });

  it('mounts a single panel even if the bookmarklet is fired twice', () => {
    const context = openPanel([]);

    buildAdLibraryPanel({ defaults: panelDefaults(FAST_DELAY_MS), autoStart: false });

    expect(context.environment.document.querySelectorAll(PANEL_SELECTOR)).toHaveLength(1);
  });

  it('takes the panel off the page when the close control is clicked', () => {
    const context = openPanel([]);

    context.click(CLOSE_SELECTOR);

    expect(context.environment.document.querySelectorAll(PANEL_SELECTOR)).toHaveLength(0);
  });

  it('downloads the ads the form asks for and counts them on screen', async () => {
    const context = openPanel([
      adCard({ libraryId: '100000000000001', copiesInRotation: 4, circulationDate: '27/6/2026' }),
      adCard({ libraryId: '100000000000002', copiesInRotation: 3, circulationDate: '27/6/2026' }),
    ]);

    context.fill(MINIMUM_COPIES_SELECTOR, '0');
    context.fill(MAXIMUM_DOWNLOADS_SELECTOR, '2');
    context.click(START_SELECTOR);

    await context.waitForLog('FIN.');

    expect(context.environment.downloads.map((download) => download.fileName)).toEqual([
      '4_ads_27_6_26_lamarca_100000000000001.mp4',
      '3_ads_27_6_26_lamarca_100000000000002.mp4',
    ]);
    expect(context.textOf(COUNT_SELECTOR)).toBe('2');
  });

  it('re enables the start button and disables stop once the run is over', async () => {
    const context = openPanel([adCard({ libraryId: '100000000000001' })]);
    const { document } = context.environment;

    context.fill(MINIMUM_COPIES_SELECTOR, '0');
    context.fill(MAXIMUM_DOWNLOADS_SELECTOR, '1');
    context.click(START_SELECTOR);

    await context.waitForLog('FIN.');

    expect(document.querySelector<HTMLButtonElement>(START_SELECTOR)?.disabled).toBe(false);
    expect(document.querySelector<HTMLButtonElement>(START_SELECTOR)?.textContent).toContain(
      'Iniciar',
    );
    expect(document.querySelector<HTMLButtonElement>(STOP_SELECTOR)?.disabled).toBe(true);
  });

  it('writes the stopped notice in the log when the run is cut from the panel', async () => {
    const context = openPanel(
      Array.from({ length: 8 }, (_unused, index) =>
        adCard({ libraryId: `20000000000000${index}` }),
      ),
      { delayBetweenDownloadsMs: 150 },
    );

    context.fill(MINIMUM_COPIES_SELECTOR, '0');
    context.fill(MAXIMUM_DOWNLOADS_SELECTOR, '0');
    context.click(START_SELECTOR);
    await context.waitForDownloads(1);

    context.click(STOP_SELECTOR);

    await context.waitForLog('detenido');
    await context.waitForLog('FIN.');
    expect(context.environment.downloads.length).toBeLessThan(8);
  });

  it('warns instead of downloading when the page shows no ad card', async () => {
    const context = openPanel([]);

    context.fill(MAXIMUM_DOWNLOADS_SELECTOR, '1');
    context.click(START_SELECTOR);
    await context.waitForLog('No detecté ninguna tarjeta');

    context.click(STOP_SELECTOR);
    await context.waitForLog('FIN.');

    expect(context.textOf(LOG_SELECTOR)).toContain('tarjetas detectadas en pantalla: 0');
    expect(context.environment.downloads).toHaveLength(0);
  });

  it('starts on its own with the saved filters when the bookmarklet was built with autostart on', async () => {
    const context = openPanel(
      [
        adCard({ libraryId: '100000000000001', copiesInRotation: 4 }),
        adCard({ libraryId: '100000000000002', copiesInRotation: 1 }),
      ],
      { autoStart: true },
    );

    await context.waitForDownloads(1);

    context.click(STOP_SELECTOR);
    await context.waitForLog('FIN.');
    expect(context.environment.downloads.map((download) => download.fileName)).toEqual([
      '4_ads_27_6_26_lamarca_100000000000001.mp4',
    ]);
  });
});

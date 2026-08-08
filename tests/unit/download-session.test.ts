import { describe, it, expect } from 'vitest';
import { DownloadSession } from '../../src/bookmarklet/ad-library/download-session.js';
import type { PageScroller } from '../../src/bookmarklet/ad-library/download-session.js';
import type { Ad, CountReporter, ProgressReporter } from '../../src/bookmarklet/domain/types.js';
import { buildAd, buildSessionConfig } from '../support/ad-fixtures.js';

const INITIAL_CONTENT_HEIGHT = 1000;
const CONTENT_HEIGHT_GROWTH = 500;
const SCROLL_SETTLE_MS = 2500;

interface HarnessOptions {
  readonly ads?: readonly Ad[];
  readonly downloadSucceeds?: (ad: Ad) => boolean;
  readonly onDownload?: (ad: Ad) => void;
  readonly growsOnScroll?: boolean;
  readonly adsRevealedByFirstScroll?: readonly Ad[];
}

interface Harness {
  readonly session: DownloadSession;
  readonly logs: readonly string[];
  readonly attempts: readonly number[];
  readonly downloadedAdIds: readonly string[];
  readonly waits: readonly number[];
  readonly scrollCount: () => number;
  readonly logText: () => string;
  readonly lastLog: () => string;
  readonly report: ProgressReporter;
  readonly reportAttempts: CountReporter;
}

function createHarness(options: HarnessOptions = {}): Harness {
  const logs: string[] = [];
  const attempts: number[] = [];
  const downloadedAdIds: string[] = [];
  const waits: number[] = [];

  let visibleAds: readonly Ad[] = options.ads ?? [];
  let contentHeight = INITIAL_CONTENT_HEIGHT;
  let scrollCount = 0;

  const scroller: PageScroller = {
    measureContentHeight: () => contentHeight,
    scrollToBottom: () => {
      scrollCount += 1;
      if (scrollCount > 1) return;
      if (options.growsOnScroll) contentHeight += CONTENT_HEIGHT_GROWTH;
      if (options.adsRevealedByFirstScroll) {
        visibleAds = [...visibleAds, ...options.adsRevealedByFirstScroll];
      }
    },
  };

  const session = new DownloadSession({
    scanAds: () => visibleAds,
    downloadCreatives: (ad, _filters, report) => {
      options.onDownload?.(ad);
      const saved = options.downloadSucceeds?.(ad) ?? true;
      if (saved) downloadedAdIds.push(ad.libraryId);
      report(`${saved ? '✓' : '✗'} ${ad.libraryId}`);
      return Promise.resolve(saved);
    },
    scroller,
    wait: (milliseconds) => {
      waits.push(milliseconds);
      return Promise.resolve();
    },
  });

  return {
    session,
    logs,
    attempts,
    downloadedAdIds,
    waits,
    scrollCount: () => scrollCount,
    logText: () => logs.join('\n'),
    lastLog: () => logs[logs.length - 1] ?? '',
    report: (message) => logs.push(message),
    reportAttempts: (attempted) => attempts.push(attempted),
  };
}

function adsWithIds(count: number, prefix: string): readonly Ad[] {
  return Array.from({ length: count }, (_unused, index) =>
    buildAd({ libraryId: `${prefix}${index}` }),
  );
}

describe('DownloadSession download limit', () => {
  it('never lets ads skipped for low impressions eat into the requested download total', async () => {
    const harness = createHarness({
      ads: [
        buildAd({ libraryId: '100000000000001', hasLowImpressions: true }),
        buildAd({ libraryId: '100000000000002', hasLowImpressions: true }),
        buildAd({ libraryId: '100000000000003' }),
        buildAd({ libraryId: '100000000000004' }),
        buildAd({ libraryId: '100000000000005' }),
      ],
    });

    const outcome = await harness.session.start(
      buildSessionConfig({ maximumDownloads: 1, skipLowImpressions: true }),
      harness.report,
      harness.reportAttempts,
    );

    expect(harness.downloadedAdIds).toEqual(['100000000000003']);
    expect(outcome).toEqual({ downloaded: 1, failed: 0, skippedForLowImpressions: 2 });
    expect(harness.logText()).toContain('saltados por pocas impresiones: 2');
    expect(harness.lastLog()).toContain('Descargados: 1');
  });

  it('stops at the requested total when more ads are available', async () => {
    const harness = createHarness({ ads: adsWithIds(6, '20000000000000') });

    await harness.session.start(
      buildSessionConfig({ maximumDownloads: 3 }),
      harness.report,
      harness.reportAttempts,
    );

    expect(harness.downloadedAdIds).toHaveLength(3);
    expect(harness.attempts).toEqual([1, 2, 3]);
  });

  it('announces that the total was reached when the last pending ad completes it', async () => {
    const harness = createHarness({ ads: adsWithIds(2, '21000000000000') });

    await harness.session.start(
      buildSessionConfig({ maximumDownloads: 2 }),
      harness.report,
      harness.reportAttempts,
    );

    expect(harness.logText()).toContain('— total alcanzado —');
  });

  it('downloads everything it finds when no total is configured', async () => {
    const harness = createHarness({ ads: adsWithIds(4, '30000000000000') });

    await harness.session.start(
      buildSessionConfig({ maximumDownloads: 0 }),
      harness.report,
      harness.reportAttempts,
    );

    expect(harness.downloadedAdIds).toHaveLength(4);
  });

  it('never downloads an ad again after a later scan returns it once more', async () => {
    const harness = createHarness({ ads: adsWithIds(2, '40000000000000') });

    await harness.session.start(
      buildSessionConfig({ autoScroll: true }),
      harness.report,
      harness.reportAttempts,
    );

    expect(harness.downloadedAdIds).toEqual(['400000000000000', '400000000000001']);
  });
});

describe('DownloadSession bookkeeping and diagnostics', () => {
  it('separates downloaded from failed creatives in the closing summary', async () => {
    const harness = createHarness({
      ads: adsWithIds(3, '50000000000000'),
      downloadSucceeds: (ad) => ad.libraryId !== '500000000000001',
    });

    const outcome = await harness.session.start(
      buildSessionConfig(),
      harness.report,
      harness.reportAttempts,
    );

    expect(outcome).toEqual({ downloaded: 2, failed: 1, skippedForLowImpressions: 0 });
    expect(harness.lastLog()).toContain('Descargados: 2');
    expect(harness.lastLog()).toContain('fallidos: 1');
  });

  it('warns with a checklist when it cannot find a single ad card on screen', async () => {
    const harness = createHarness({ ads: [] });

    await harness.session.start(buildSessionConfig(), harness.report, harness.reportAttempts);

    expect(harness.logs[0]).toContain('tarjetas detectadas en pantalla: 0');
    expect(harness.logText()).toContain('No detecté ninguna tarjeta');
    expect(harness.downloadedAdIds).toHaveLength(0);
  });

  it('explains the likely causes after three failures without a single saved file', async () => {
    const harness = createHarness({
      ads: adsWithIds(5, '60000000000000'),
      downloadSucceeds: () => false,
    });

    await harness.session.start(buildSessionConfig(), harness.report, harness.reportAttempts);

    expect(harness.downloadedAdIds).toHaveLength(0);
    expect(harness.logText()).toContain('3 fallos seguidos sin bajar nada');
    expect(harness.logText()).toContain('descargas múltiples');
    expect(harness.logText()).toContain('No se bajó ningún archivo');
  });

  it('reminds about the multiple downloads block even when files were saved', async () => {
    const harness = createHarness({ ads: adsWithIds(1, '70000000000000') });

    await harness.session.start(buildSessionConfig(), harness.report, harness.reportAttempts);

    expect(harness.logText()).toContain('NO ves los archivos en tu carpeta');
  });

  it('reports the number of cards it detected before starting', async () => {
    const harness = createHarness({ ads: adsWithIds(3, '71000000000000') });

    await harness.session.start(buildSessionConfig(), harness.report, harness.reportAttempts);

    expect(harness.logs[0]).toContain('tarjetas detectadas en pantalla: 3');
  });

  it('waits the configured delay after each download so Meta is not hammered', async () => {
    const harness = createHarness({ ads: adsWithIds(2, '72000000000000') });

    await harness.session.start(
      buildSessionConfig({ delayBetweenDownloadsMs: 1200 }),
      harness.report,
      harness.reportAttempts,
    );

    expect(harness.waits).toEqual([1200, 1200]);
  });
});

describe('DownloadSession filters', () => {
  it('downloads only the ads the brand repeats when a minimum is configured', async () => {
    const harness = createHarness({
      ads: [
        buildAd({ libraryId: '800000000000001', copiesInRotation: 1 }),
        buildAd({ libraryId: '800000000000002', copiesInRotation: 4 }),
        buildAd({ libraryId: '800000000000003', copiesInRotation: 2 }),
      ],
    });

    await harness.session.start(
      buildSessionConfig({ minimumCopiesInRotation: 2 }),
      harness.report,
      harness.reportAttempts,
    );

    expect(harness.downloadedAdIds).toEqual(['800000000000002', '800000000000003']);
  });

  it('downloads the low impression ads too once that filter is turned off', async () => {
    const harness = createHarness({
      ads: [
        buildAd({ libraryId: '900000000000001', hasLowImpressions: true }),
        buildAd({ libraryId: '900000000000002' }),
      ],
    });

    const outcome = await harness.session.start(
      buildSessionConfig({ skipLowImpressions: false }),
      harness.report,
      harness.reportAttempts,
    );

    expect(harness.downloadedAdIds).toHaveLength(2);
    expect(outcome.skippedForLowImpressions).toBe(0);
  });
});

describe('DownloadSession scrolling', () => {
  it('ends after a single pass when auto scroll is off', async () => {
    const harness = createHarness({ ads: adsWithIds(2, '10100000000000') });

    await harness.session.start(
      buildSessionConfig({ autoScroll: false }),
      harness.report,
      harness.reportAttempts,
    );

    expect(harness.scrollCount()).toBe(0);
    expect(harness.logText()).toContain('— sin auto-scroll, fin —');
  });

  it('gives up after three scrolls that bring neither new height nor new ads', async () => {
    const harness = createHarness({ ads: adsWithIds(1, '10200000000000') });

    await harness.session.start(
      buildSessionConfig({ autoScroll: true }),
      harness.report,
      harness.reportAttempts,
    );

    expect(harness.scrollCount()).toBe(3);
    expect(harness.waits.filter((delay) => delay === SCROLL_SETTLE_MS)).toHaveLength(3);
    expect(harness.logText()).toContain('— no hay más resultados —');
  });

  it('keeps going while scrolling reveals ads that were lazy loaded', async () => {
    const harness = createHarness({
      ads: adsWithIds(1, '10300000000000'),
      growsOnScroll: true,
      adsRevealedByFirstScroll: [buildAd({ libraryId: '103000000000099' })],
    });

    await harness.session.start(
      buildSessionConfig({ autoScroll: true }),
      harness.report,
      harness.reportAttempts,
    );

    expect(harness.downloadedAdIds).toEqual(['103000000000000', '103000000000099']);
  });
});

describe('DownloadSession stopping', () => {
  it('cuts a run that is already in flight and reports itself as stopped', async () => {
    const runningDuringDownload: boolean[] = [];

    const harness = createHarness({
      ads: adsWithIds(5, '13000000000000'),
      onDownload: () => {
        runningDuringDownload.push(harness.session.isRunning);
        harness.session.stop();
      },
    });

    await harness.session.start(
      buildSessionConfig({ maximumDownloads: 0 }),
      harness.report,
      harness.reportAttempts,
    );

    expect(harness.downloadedAdIds).toHaveLength(1);
    expect(runningDuringDownload).toEqual([true]);
    expect(harness.session.isRunning).toBe(false);
  });

  it('reports itself as not running once the run finished on its own', async () => {
    const harness = createHarness({ ads: adsWithIds(1, '14000000000000') });

    await harness.session.start(buildSessionConfig(), harness.report, harness.reportAttempts);

    expect(harness.session.isRunning).toBe(false);
  });
});

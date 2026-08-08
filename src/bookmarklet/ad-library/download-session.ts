import type {
  Ad,
  CountReporter,
  DownloadFilters,
  DownloadOutcome,
  DownloadSessionConfig,
  ProgressReporter,
} from '../domain/types.js';
import { passesFilters } from './ad-filters.js';

export type AdScanner = () => readonly Ad[];

export type CreativeDownloader = (
  ad: Ad,
  filters: DownloadFilters,
  report: ProgressReporter,
) => Promise<boolean>;

export type Waiter = (milliseconds: number) => Promise<void>;

export interface PageScroller {
  readonly measureContentHeight: () => number;
  readonly scrollToBottom: () => void;
}

export interface DownloadSessionDependencies {
  readonly scanAds: AdScanner;
  readonly downloadCreatives: CreativeDownloader;
  readonly scroller: PageScroller;
  readonly wait: Waiter;
}

const SCROLL_SETTLE_MS = 2500;
const EMPTY_ROUNDS_BEFORE_GIVING_UP = 3;
const FAILURES_BEFORE_BLOCKED_DOWNLOADS_HINT = 3;

export const browserPageScroller: PageScroller = {
  measureContentHeight: () => document.body.scrollHeight,
  scrollToBottom: () => window.scrollTo(0, document.body.scrollHeight),
};

export function waitMilliseconds(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function reportNoCardsFound(report: ProgressReporter): void {
  report('⚠ No detecté ninguna tarjeta de anuncio. Verificá que:');
  report('   • estás en los resultados de la Ad Library (no en la portada)');
  report('   • la página terminó de cargar y scrolleaste un poco');
}

function reportBlockedDownloadsDiagnosis(report: ProgressReporter): void {
  report('⛔ 3 fallos seguidos sin bajar nada. Posibles causas:');
  report('   • el navegador está bloqueando descargas múltiples → buscá el aviso "¿Permitir descargar varios archivos?" y tocá Permitir');
  report('   • permisos de descarga desactivados para este sitio');
  report('   • Meta está bloqueando la bajada directa (ver errores de arriba)');
}

function reportClosingAdvice(outcome: DownloadOutcome, report: ProgressReporter): void {
  if (outcome.downloaded === 0 && outcome.failed > 0) {
    report(`⛔ No se bajó ningún archivo (0 de ${outcome.failed}). Revisá los permisos de descarga del navegador y el aviso de "descargas múltiples".`);
  } else if (outcome.downloaded > 0) {
    report('ℹ Si el log dice ✓ pero NO ves los archivos en tu carpeta, el navegador está bloqueando descargas múltiples: buscá el ícono de descargas y tocá "Permitir".');
  }
}

function buildFinalSummary(outcome: DownloadOutcome): string {
  const failures = outcome.failed > 0 ? ` · fallidos: ${outcome.failed}` : '';
  const lowImpressions = outcome.skippedForLowImpressions > 0
    ? ` · saltados por pocas impresiones: ${outcome.skippedForLowImpressions}`
    : '';

  return `FIN. Descargados: ${outcome.downloaded}${failures}${lowImpressions}`;
}

function reachedDownloadLimit(config: DownloadSessionConfig, attempted: number): boolean {
  return config.maximumDownloads > 0 && attempted >= config.maximumDownloads;
}

export class DownloadSession {
  readonly #dependencies: DownloadSessionDependencies;

  #running = false;

  constructor(dependencies: DownloadSessionDependencies) {
    this.#dependencies = dependencies;
  }

  get isRunning(): boolean {
    return this.#running;
  }

  stop(): void {
    this.#running = false;
  }

  async start(
    config: DownloadSessionConfig,
    report: ProgressReporter,
    reportAttempts: CountReporter,
  ): Promise<DownloadOutcome> {
    const { scanAds, downloadCreatives, scroller, wait } = this.#dependencies;
    const processedLibraryIds = new Set<string>();

    let downloaded = 0;
    let failed = 0;
    let skippedForLowImpressions = 0;
    let attempted = 0;
    let emptyRounds = 0;

    this.#running = true;

    const adsVisibleOnStart = scanAds();
    report(`🔍 tarjetas detectadas en pantalla: ${adsVisibleOnStart.length}`);
    if (adsVisibleOnStart.length === 0) reportNoCardsFound(report);

    while (this.#running) {
      const pending: Ad[] = [];

      for (const ad of scanAds()) {
        if (processedLibraryIds.has(ad.libraryId)) continue;
        if (config.skipLowImpressions && ad.hasLowImpressions) {
          processedLibraryIds.add(ad.libraryId);
          skippedForLowImpressions += 1;
          continue;
        }
        if (passesFilters(ad, config)) pending.push(ad);
      }

      for (const ad of pending) {
        if (!this.#running) break;
        if (reachedDownloadLimit(config, attempted)) {
          this.#running = false;
          break;
        }

        processedLibraryIds.add(ad.libraryId);
        attempted += 1;
        reportAttempts(attempted);

        const saved = await downloadCreatives(ad, config, report);
        if (saved) downloaded += 1;
        else failed += 1;

        if (downloaded === 0 && failed === FAILURES_BEFORE_BLOCKED_DOWNLOADS_HINT) {
          reportBlockedDownloadsDiagnosis(report);
        }

        await wait(config.delayBetweenDownloadsMs);
      }

      if (!this.#running) break;
      if (reachedDownloadLimit(config, attempted)) {
        report('— total alcanzado —');
        break;
      }
      if (!config.autoScroll) {
        report('— sin auto-scroll, fin —');
        break;
      }

      const heightBeforeScroll = scroller.measureContentHeight();
      scroller.scrollToBottom();
      await wait(SCROLL_SETTLE_MS);

      const pageGrew = scroller.measureContentHeight() > heightBeforeScroll;
      const foundUnprocessedAds = scanAds()
        .some((ad) => !processedLibraryIds.has(ad.libraryId) && passesFilters(ad, config));

      if (pageGrew || foundUnprocessedAds) {
        emptyRounds = 0;
      } else {
        emptyRounds += 1;
        if (emptyRounds >= EMPTY_ROUNDS_BEFORE_GIVING_UP) {
          report('— no hay más resultados —');
          break;
        }
      }
    }

    this.#running = false;

    const outcome: DownloadOutcome = { downloaded, failed, skippedForLowImpressions };
    reportClosingAdvice(outcome, report);
    report(buildFinalSummary(outcome));

    return outcome;
  }
}

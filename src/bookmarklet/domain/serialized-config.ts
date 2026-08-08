import type { CreativeSelection, DownloadSessionConfig } from './types.js';

export interface SerializedBookmarkletConfig {
  readonly minAds: number;
  readonly tipo: string;
  readonly skipLow: boolean;
  readonly portada: boolean;
  readonly autoscroll: boolean;
  readonly maxCards: number;
  readonly delayMs: number;
}

const CREATIVE_SELECTIONS: readonly CreativeSelection[] = ['auto', 'video', 'imagen'];

const FALLBACK_DELAY_MS = 1200;

export function toCreativeSelection(value: string): CreativeSelection {
  return CREATIVE_SELECTIONS.find((selection) => selection === value) ?? 'auto';
}

export function serializeBookmarkletConfig(
  config: DownloadSessionConfig,
): SerializedBookmarkletConfig {
  return {
    minAds: config.minimumCopiesInRotation,
    tipo: config.creativeSelection,
    skipLow: config.skipLowImpressions,
    portada: config.includeVideoPoster,
    autoscroll: config.autoScroll,
    maxCards: config.maximumDownloads,
    delayMs: config.delayBetweenDownloadsMs,
  };
}

export function deserializeBookmarkletConfig(
  serialized: SerializedBookmarkletConfig,
): DownloadSessionConfig {
  return {
    minimumCopiesInRotation: serialized.minAds,
    creativeSelection: toCreativeSelection(serialized.tipo),
    skipLowImpressions: serialized.skipLow,
    includeVideoPoster: serialized.portada,
    autoScroll: serialized.autoscroll,
    maximumDownloads: serialized.maxCards,
    delayBetweenDownloadsMs: serialized.delayMs || FALLBACK_DELAY_MS,
  };
}

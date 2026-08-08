import type {
  Ad,
  AdCirculationDate,
  AdCreativeSources,
  DownloadFilters,
  DownloadSessionConfig,
} from '../../src/bookmarklet/domain/types.js';

export interface AdOverrides {
  readonly libraryId?: string;
  readonly copiesInRotation?: number;
  readonly hasVideo?: boolean;
  readonly hasLowImpressions?: boolean;
  readonly brand?: string;
  readonly circulationDate?: AdCirculationDate | null;
  readonly sources?: Partial<AdCreativeSources>;
}

const EMPTY_SOURCES: AdCreativeSources = {
  videoUrl: '',
  isStreamedVideo: false,
  imageUrl: '',
  posterUrl: '',
};

const DEFAULT_LIBRARY_ID = '100000000000001';
const DEFAULT_BRAND = 'lamarca';

const DEFAULT_FILTERS: DownloadFilters = {
  minimumCopiesInRotation: 0,
  creativeSelection: 'auto',
  skipLowImpressions: true,
  includeVideoPoster: false,
};

const DEFAULT_SESSION_CONFIG: DownloadSessionConfig = {
  ...DEFAULT_FILTERS,
  maximumDownloads: 0,
  autoScroll: false,
  delayBetweenDownloadsMs: 0,
};

export function buildAd(overrides: AdOverrides = {}): Ad {
  const sources: AdCreativeSources = { ...EMPTY_SOURCES, ...overrides.sources };

  return {
    libraryId: overrides.libraryId ?? DEFAULT_LIBRARY_ID,
    copiesInRotation: overrides.copiesInRotation ?? 1,
    hasVideo: overrides.hasVideo ?? sources.videoUrl !== '',
    hasLowImpressions: overrides.hasLowImpressions ?? false,
    brand: overrides.brand ?? DEFAULT_BRAND,
    circulationDate: overrides.circulationDate ?? null,
    sources,
  };
}

export function buildVideoAd(overrides: AdOverrides = {}): Ad {
  const libraryId = overrides.libraryId ?? DEFAULT_LIBRARY_ID;

  return buildAd({
    ...overrides,
    libraryId,
    sources: {
      videoUrl: `https://video.xx.fbcdn.net/v/${libraryId}.mp4`,
      posterUrl: `https://scontent.xx.fbcdn.net/v/${libraryId}_poster.jpg`,
      ...overrides.sources,
    },
  });
}

export function buildImageAd(overrides: AdOverrides = {}): Ad {
  const libraryId = overrides.libraryId ?? DEFAULT_LIBRARY_ID;

  return buildAd({
    ...overrides,
    libraryId,
    sources: {
      imageUrl: `https://scontent.xx.fbcdn.net/v/${libraryId}.jpg`,
      ...overrides.sources,
    },
  });
}

export function buildFilters(overrides: Partial<DownloadFilters> = {}): DownloadFilters {
  return { ...DEFAULT_FILTERS, ...overrides };
}

export function buildSessionConfig(
  overrides: Partial<DownloadSessionConfig> = {},
): DownloadSessionConfig {
  return { ...DEFAULT_SESSION_CONFIG, ...overrides };
}

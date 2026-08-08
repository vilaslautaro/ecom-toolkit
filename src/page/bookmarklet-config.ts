import type { DownloadSessionConfig } from '../bookmarklet/domain/types.js';

export type { SerializedBookmarkletConfig } from '../bookmarklet/domain/serialized-config.js';
export { serializeBookmarkletConfig } from '../bookmarklet/domain/serialized-config.js';

export const DEFAULT_BOOKMARKLET_CONFIG: DownloadSessionConfig = {
  minimumCopiesInRotation: 2,
  creativeSelection: 'auto',
  skipLowImpressions: true,
  includeVideoPoster: false,
  autoScroll: true,
  maximumDownloads: 50,
  delayBetweenDownloadsMs: 1200,
};

import type { Ad, DownloadFilters } from '../domain/types.js';

export function passesFilters(ad: Ad, filters: DownloadFilters): boolean {
  const belowMinimumCopies = filters.minimumCopiesInRotation > 0
    && ad.copiesInRotation < filters.minimumCopiesInRotation;
  if (belowMinimumCopies) return false;

  return !(filters.skipLowImpressions && ad.hasLowImpressions);
}

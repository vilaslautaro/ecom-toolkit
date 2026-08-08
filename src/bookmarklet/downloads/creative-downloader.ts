import type { Ad, DownloadFilters, ProgressReporter } from '../domain/types.js';
import { buildCreativeFileName, imageExtensionFor } from '../domain/creative-file-name.js';
import { describeDownloadError } from './download-error.js';
import { fetchBlob } from './blob-fetcher.js';
import { saveBlobAs } from './file-saver.js';

const BYTES_PER_MEGABYTE = 1e6;
const BYTES_PER_KILOBYTE = 1e3;
const VIDEO_EXTENSION = 'mp4';

function wantsVideo(ad: Ad, filters: DownloadFilters): boolean {
  return ad.hasVideo
    && (filters.creativeSelection === 'auto' || filters.creativeSelection === 'video');
}

function wantsImage(ad: Ad, filters: DownloadFilters): boolean {
  if (filters.creativeSelection === 'imagen') return true;
  if (filters.creativeSelection === 'auto' && !ad.hasVideo) return true;
  return ad.hasVideo && filters.includeVideoPoster;
}

function imageSourceOf(ad: Ad): string {
  return ad.hasVideo ? ad.sources.posterUrl : ad.sources.imageUrl;
}

async function downloadVideo(ad: Ad, report: ProgressReporter): Promise<boolean> {
  if (!ad.sources.videoUrl) {
    report(`✗ ${ad.libraryId} — no encontré la URL del video en la tarjeta`);
    return false;
  }

  try {
    if (ad.sources.isStreamedVideo) {
      report(`⚠ ${ad.libraryId}: video streaming, puede bajar incompleto`);
    }
    const blob = await fetchBlob(ad.sources.videoUrl);
    const fileName = buildCreativeFileName(ad, VIDEO_EXTENSION);
    saveBlobAs(blob, fileName);
    report(`✓ ${fileName}  (${(blob.size / BYTES_PER_MEGABYTE).toFixed(1)} MB)`);
    return true;
  } catch (error) {
    report(`✗ ${ad.libraryId} video — ${describeDownloadError(error)}`);
    return false;
  }
}

async function downloadImage(
  ad: Ad,
  report: ProgressReporter,
  reportMissingSource: boolean,
): Promise<boolean> {
  const imageSource = imageSourceOf(ad);
  if (!imageSource) {
    if (reportMissingSource) report(`✗ ${ad.libraryId} — no encontré imagen en la tarjeta`);
    return false;
  }

  try {
    const blob = await fetchBlob(imageSource);
    const fileName = buildCreativeFileName(ad, imageExtensionFor(blob.type));
    saveBlobAs(blob, fileName);
    report(`✓ ${fileName}  (${(blob.size / BYTES_PER_KILOBYTE).toFixed(0)} KB)`);
    return true;
  } catch (error) {
    report(`✗ ${ad.libraryId} imagen — ${describeDownloadError(error)}`);
    return false;
  }
}

export async function downloadAdCreatives(
  ad: Ad,
  filters: DownloadFilters,
  report: ProgressReporter,
): Promise<boolean> {
  const videoWasRequested = wantsVideo(ad, filters);
  const videoWasSaved = videoWasRequested ? await downloadVideo(ad, report) : false;
  const imageWasSaved = wantsImage(ad, filters)
    ? await downloadImage(ad, report, !videoWasRequested)
    : false;

  return videoWasSaved || imageWasSaved;
}

import { describe, it, expect, afterEach } from 'vitest';
import { downloadAdCreatives } from '../../src/bookmarklet/downloads/creative-downloader.js';
import { buildFilters, buildImageAd, buildVideoAd } from '../support/ad-fixtures.js';
import { closeOpenPages, createPageEnvironment } from '../support/page-environment.js';
import type { StubbedRoutes } from '../support/page-environment.js';

afterEach(closeOpenPages);

const ONE_MEGABYTE = 1_000_000;

function openDownloader(routes: StubbedRoutes) {
  const environment = createPageEnvironment();
  environment.stubFetch(routes);
  const logs: string[] = [];

  return {
    environment,
    logs,
    report: (message: string): number => logs.push(message),
    logText: (): string => logs.join('\n'),
  };
}

describe('downloadAdCreatives with the automatic selection', () => {
  it('saves the video of a video ad and reports its size in megabytes', async () => {
    const context = openDownloader({
      default: { byteSize: 2 * ONE_MEGABYTE, contentType: 'video/mp4' },
    });

    const saved = await downloadAdCreatives(
      buildVideoAd({ libraryId: '100200300400', copiesInRotation: 2 }),
      buildFilters(),
      context.report,
    );

    expect(saved).toBe(true);
    expect(context.environment.downloads).toHaveLength(1);
    expect(context.environment.downloads[0]?.fileName).toMatch(/\.mp4$/);
    expect(context.logText()).toContain('✓');
    expect(context.logText()).toContain('2.0 MB');
  });

  it('saves the image of an ad that has no video', async () => {
    const context = openDownloader({ default: { byteSize: 5000, contentType: 'image/jpeg' } });

    const saved = await downloadAdCreatives(
      buildImageAd({ libraryId: '120000000000001' }),
      buildFilters(),
      context.report,
    );

    expect(saved).toBe(true);
    expect(context.environment.downloads[0]?.fileName).toMatch(/\.jpg$/);
    expect(context.logText()).toContain('5 KB');
  });

  it('reports the failure and saves nothing when the browser blocks the download', async () => {
    const context = openDownloader({ default: { throws: new TypeError('Failed to fetch') } });

    const saved = await downloadAdCreatives(
      buildVideoAd({ libraryId: '100200300401' }),
      buildFilters(),
      context.report,
    );

    expect(saved).toBe(false);
    expect(context.environment.downloads).toHaveLength(0);
    expect(context.logText()).toContain('✗');
    expect(context.logText()).toContain('bloqueó la bajada');
  });

  it('says the card exposed no image when neither creative could be read from it', async () => {
    const context = openDownloader({ default: { byteSize: 1024 } });

    const saved = await downloadAdCreatives(
      buildImageAd({ libraryId: '100200300402', sources: { imageUrl: '' } }),
      buildFilters(),
      context.report,
    );

    expect(saved).toBe(false);
    expect(context.logText()).toContain('no encontré imagen en la tarjeta');
  });

  it('says the card exposed no video url when the ad claims to have one', async () => {
    const context = openDownloader({ default: { byteSize: 1024 } });

    const saved = await downloadAdCreatives(
      buildVideoAd({ libraryId: '100200300403', hasVideo: true, sources: { videoUrl: '' } }),
      buildFilters(),
      context.report,
    );

    expect(saved).toBe(false);
    expect(context.logText()).toContain('no encontré la URL del video en la tarjeta');
  });

  it('warns that a streamed video may be saved incomplete', async () => {
    const context = openDownloader({ default: { byteSize: 1024 } });

    await downloadAdCreatives(
      buildVideoAd({
        libraryId: '100200300404',
        sources: { videoUrl: 'blob:https://facebook.com/xyz', isStreamedVideo: true },
      }),
      buildFilters(),
      context.report,
    );

    expect(context.logText()).toContain('streaming, puede bajar incompleto');
  });

  it.each([
    ['image/png', '.png'],
    ['image/webp', '.webp'],
    ['image/gif', '.gif'],
    ['image/jpeg', '.jpg'],
  ])('names the file after the %s the server actually returned', async (contentType, extension) => {
    const context = openDownloader({ default: { byteSize: 1024, contentType } });

    await downloadAdCreatives(
      buildImageAd({ libraryId: '100200300405' }),
      buildFilters(),
      context.report,
    );

    expect(context.environment.downloads[0]?.fileName.endsWith(extension)).toBe(true);
  });
});

describe('downloadAdCreatives with an explicit selection', () => {
  it('saves the poster of a video ad when only images were requested', async () => {
    const context = openDownloader({ default: { byteSize: 5000, contentType: 'image/jpeg' } });

    const saved = await downloadAdCreatives(
      buildVideoAd({ libraryId: '110000000000001' }),
      buildFilters({ creativeSelection: 'imagen' }),
      context.report,
    );

    expect(saved).toBe(true);
    expect(context.environment.downloads).toHaveLength(1);
    expect(context.environment.downloads[0]?.fileName).toMatch(/\.jpg$/);
  });

  it('skips an image only ad when just videos were requested', async () => {
    const context = openDownloader({ default: { byteSize: 1024 } });

    const saved = await downloadAdCreatives(
      buildImageAd({ libraryId: '110000000000002' }),
      buildFilters({ creativeSelection: 'video' }),
      context.report,
    );

    expect(saved).toBe(false);
    expect(context.environment.downloads).toHaveLength(0);
    expect(context.logText()).toBe('');
  });

  it('saves both the video and its poster when the poster was requested as well', async () => {
    const context = openDownloader({
      'poster': { byteSize: 2048, contentType: 'image/jpeg' },
      default: { byteSize: 4096, contentType: 'video/mp4' },
    });

    const saved = await downloadAdCreatives(
      buildVideoAd({ libraryId: '110000000000003' }),
      buildFilters({ includeVideoPoster: true }),
      context.report,
    );

    expect(saved).toBe(true);
    expect(context.environment.downloads.map((download) => download.fileName)).toEqual([
      '1_ads_lamarca_110000000000003.mp4',
      '1_ads_lamarca_110000000000003.jpg',
    ]);
  });

  it('still counts the ad as saved when the video worked but its poster failed', async () => {
    const context = openDownloader({
      'poster': { status: 404, statusText: 'Not Found' },
      default: { byteSize: 4096, contentType: 'video/mp4' },
    });

    const saved = await downloadAdCreatives(
      buildVideoAd({ libraryId: '110000000000004' }),
      buildFilters({ includeVideoPoster: true }),
      context.report,
    );

    expect(saved).toBe(true);
    expect(context.environment.downloads).toHaveLength(1);
    expect(context.logText()).toContain('link vencido o sin acceso');
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import { downloadPageImages, downloadPageVideos } from '../../src/bookmarklet/shopify/page-media.js';
import { closeOpenPages, createPageEnvironment } from '../support/page-environment.js';
import type { PageEnvironment, StubbedRoutes } from '../support/page-environment.js';

afterEach(closeOpenPages);

const STORE_URL = 'https://lamarca.com/';
const PRODUCT_URL = 'https://lamarca.com/products/remera';

interface MediaContext {
  readonly environment: PageEnvironment;
  readonly statuses: readonly string[];
  readonly report: (message: string) => void;
  readonly lastStatus: () => string;
  readonly fileNames: () => readonly string[];
}

function openStorePage(body: string, routes: StubbedRoutes, url = STORE_URL): MediaContext {
  const environment = createPageEnvironment({
    url,
    html: `<!doctype html><html><body>${body}</body></html>`,
  });
  environment.stubFetch(routes);

  const statuses: string[] = [];

  return {
    environment,
    statuses,
    report: (message) => {
      statuses.push(message);
    },
    lastStatus: () => statuses[statuses.length - 1] ?? '',
    fileNames: () => environment.downloads.map((download) => download.fileName),
  };
}

describe('the file name taken from a media url', () => {
  const RIGHT_TO_LEFT_OVERRIDE = String.fromCharCode(0x202e);

  const IMAGE_ROUTES: StubbedRoutes = {
    'products/remera.js': { status: 404 },
    default: { byteSize: 2048, contentType: 'image/jpeg' },
  };

  async function saveImageNamed(urlPath: string): Promise<string> {
    const context = openStorePage(
      `<img src="https://cdn.shopify.com/${urlPath}" data-natural-width="1200">`,
      IMAGE_ROUTES,
    );
    await downloadPageImages(context.report);

    return context.fileNames()[0] ?? '';
  }

  it('keeps a readable name when the store names its file sensibly', async () => {
    expect(await saveImageNamed('remera-azul_1024x.jpg')).toBe('img_1_remera-azul_1024x.jpg');
  });

  it('leaves a traversal attempt with no separator to traverse with', async () => {
    const fileName = await saveImageNamed('a/..%2F..%2Fetc%2Fpasswd.jpg');

    expect(fileName).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect(fileName).not.toContain('/');
    expect(fileName).not.toContain('\\');
    expect(fileName.startsWith('img_1_.')).toBe(false);
  });

  it('drops the characters that let a name disguise its own extension', async () => {
    const fileName = await saveImageNamed(`factura${RIGHT_TO_LEFT_OVERRIDE}gpj.exe`);

    expect(fileName).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect(fileName.endsWith('.jpg')).toBe(true);
  });

  it('forces a known extension onto a name that claims to be executable', async () => {
    expect(await saveImageNamed('payload.exe')).toBe('img_1_payload.exe.jpg');
  });

  it('caps a name long enough to break a filesystem', async () => {
    const fileName = await saveImageNamed(`${'a'.repeat(400)}.jpg`);

    expect(fileName.length).toBeLessThan(120);
  });

  it('falls back to its own name when the url segment sanitizes away to nothing', async () => {
    expect(await saveImageNamed('%%%')).toBe('img_1_img0.jpg');
  });
});

describe('downloadPageImages', () => {
  it('saves the large images of the page and leaves icons and thumbnails out', async () => {
    const context = openStorePage(
      `<img src="https://cdn.shopify.com/icono.png" data-natural-width="32">
       <img src="https://cdn.shopify.com/producto-1.jpg" data-natural-width="1200">
       <img src="https://cdn.shopify.com/producto-2.jpg" data-natural-width="800">`,
      { default: { byteSize: 2048, contentType: 'image/jpeg' } },
    );

    await downloadPageImages(context.report);

    expect(context.environment.downloads).toHaveLength(2);
    expect(context.fileNames().every((fileName) => !fileName.includes('icono'))).toBe(true);
    expect(context.lastStatus()).toContain('2 imágenes');
  });

  it('says it found nothing when every image is too small to be a product photo', async () => {
    const context = openStorePage(
      '<img src="https://cdn.shopify.com/i.png" data-natural-width="10">',
      { default: { byteSize: 10 } },
    );

    await downloadPageImages(context.report);

    expect(context.environment.downloads).toHaveLength(0);
    expect(context.lastStatus()).toContain('No encontré imágenes');
  });

  it('numbers the files so two photos with the same name do not overwrite each other', async () => {
    const context = openStorePage(
      `<img src="https://cdn.shopify.com/a/foto.jpg" data-natural-width="900">
       <img src="https://cdn.shopify.com/b/foto.jpg" data-natural-width="900">`,
      { default: { byteSize: 1024, contentType: 'image/jpeg' } },
    );

    await downloadPageImages(context.report);

    expect(context.fileNames()).toEqual(['img_1_foto.jpg', 'img_2_foto.jpg']);
  });

  it('keeps going with the rest of the batch when one image fails', async () => {
    const context = openStorePage(
      `<img src="https://cdn.shopify.com/rota.jpg" data-natural-width="900">
       <img src="https://cdn.shopify.com/sana.jpg" data-natural-width="900">`,
      {
        rota: { throws: new TypeError('Failed to fetch') },
        default: { byteSize: 1024, contentType: 'image/jpeg' },
      },
    );

    await downloadPageImages(context.report);

    expect(context.environment.downloads).toHaveLength(1);
    expect(context.lastStatus()).toContain('1 imágenes');
  });

  it('adds the images of the product feed to the ones rendered on the page', async () => {
    const context = openStorePage(
      '<img src="https://cdn.shopify.com/en-la-pagina.jpg" data-natural-width="900">',
      {
        'remera.js': {
          json: { images: ['//cdn.shopify.com/desde-el-feed.jpg'] },
        },
        default: { byteSize: 1024, contentType: 'image/jpeg' },
      },
      PRODUCT_URL,
    );

    await downloadPageImages(context.report);

    expect(context.fileNames()).toEqual([
      'img_1_en-la-pagina.jpg',
      'img_2_desde-el-feed.jpg',
    ]);
  });

  it('still saves the rendered images when the product feed is not reachable', async () => {
    const context = openStorePage(
      '<img src="https://cdn.shopify.com/en-la-pagina.jpg" data-natural-width="900">',
      {
        'remera.js': { status: 404 },
        default: { byteSize: 1024, contentType: 'image/jpeg' },
      },
      PRODUCT_URL,
    );

    await downloadPageImages(context.report);

    expect(context.fileNames()).toEqual(['img_1_en-la-pagina.jpg']);
  });
});

describe('downloadPageVideos', () => {
  it('collects the sources of the video elements and of their nested source tags', async () => {
    const context = openStorePage(
      `<video src="https://cdn.shopify.com/uno.mp4"></video>
       <video><source src="https://cdn.shopify.com/dos.mp4"></video>`,
      { default: { byteSize: 4096, contentType: 'video/mp4' } },
    );

    await downloadPageVideos(context.report);

    expect(context.environment.downloads).toHaveLength(2);
    expect(context.fileNames().every((fileName) => fileName.endsWith('.mp4'))).toBe(true);
  });

  it('says it found nothing when the page has no video at all', async () => {
    const context = openStorePage('', { default: { byteSize: 0 } });

    await downloadPageVideos(context.report);

    expect(context.lastStatus()).toContain('No encontré videos');
  });

  it('takes the tallest mp4 source of each media entry in the product feed', async () => {
    const context = openStorePage(
      '',
      {
        'remera.js': {
          json: {
            media: [
              {
                sources: [
                  { url: 'https://cdn.shopify.com/chico.mp4', format: 'mp4', height: 480 },
                  { url: 'https://cdn.shopify.com/grande.mp4', format: 'mp4', height: 1080 },
                  { url: 'https://cdn.shopify.com/playlist.m3u8', format: 'm3u8', height: 2160 },
                ],
              },
            ],
          },
        },
        default: { byteSize: 4096, contentType: 'video/mp4' },
      },
      PRODUCT_URL,
    );

    await downloadPageVideos(context.report);

    expect(context.fileNames()).toEqual(['vid_1_grande.mp4']);
  });

  it('gives a default extension to a feed source whose url carries none', async () => {
    const context = openStorePage(
      '',
      {
        'remera.js': {
          json: {
            media: [{ sources: [{ url: 'https://cdn.shopify.com/stream', mime_type: 'video/mp4' }] }],
          },
        },
        default: { byteSize: 4096, contentType: 'video/mp4' },
      },
      PRODUCT_URL,
    );

    await downloadPageVideos(context.report);

    expect(context.fileNames()).toEqual(['vid_1_stream.mp4']);
  });
});

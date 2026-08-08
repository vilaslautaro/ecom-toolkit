import { describe, it, expect, afterEach } from 'vitest';
import { fetchBlob } from '../../src/bookmarklet/downloads/blob-fetcher.js';
import { closeOpenPages, createPageEnvironment } from '../support/page-environment.js';

afterEach(closeOpenPages);

const CREATIVE_URL = 'https://video.xx.fbcdn.net/v/x.mp4';

describe('fetchBlob', () => {
  it('turns a bad HTTP status into an error instead of saving the error body as a file', async () => {
    const environment = createPageEnvironment();
    environment.stubFetch({ default: { status: 403, statusText: 'Forbidden' } });

    await expect(fetchBlob(CREATIVE_URL)).rejects.toThrow(/HTTP 403/);
  });

  it('keeps the status text in the message so the log says why it failed', async () => {
    const environment = createPageEnvironment();
    environment.stubFetch({ default: { status: 500, statusText: 'Internal Server Error' } });

    await expect(fetchBlob(CREATIVE_URL)).rejects.toThrow(/Internal Server Error/);
  });

  it('returns the blob with its size and content type when the response is fine', async () => {
    const environment = createPageEnvironment();
    environment.stubFetch({ default: { status: 200, byteSize: 4096, contentType: 'video/mp4' } });

    const blob = await fetchBlob(CREATIVE_URL);

    expect(blob.size).toBe(4096);
    expect(blob.type).toBe('video/mp4');
  });

  it('lets a network level failure travel up untouched', async () => {
    const environment = createPageEnvironment();
    environment.stubFetch({ default: { throws: new TypeError('Failed to fetch') } });

    await expect(fetchBlob(CREATIVE_URL)).rejects.toThrow(/Failed to fetch/);
  });
});

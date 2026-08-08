import { describe, it, expect, afterEach } from 'vitest';
import { saveBlobAs } from '../../src/bookmarklet/downloads/file-saver.js';
import { closeOpenPages, createPageEnvironment } from '../support/page-environment.js';

afterEach(closeOpenPages);

const FILE_NAME = '4_ads_27_6_26_lamarca_100000000000001.mp4';

describe('saveBlobAs', () => {
  it('clicks an anchor carrying the download attribute so the browser saves the file', () => {
    const environment = createPageEnvironment();

    saveBlobAs(new Blob(['x']), FILE_NAME);

    expect(environment.downloads).toEqual([
      { fileName: FILE_NAME, href: environment.createdObjectUrls[0]?.url },
    ]);
  });

  it('hands the browser an object url built from the blob it was given', () => {
    const environment = createPageEnvironment();
    const blob = new Blob(['x']);

    saveBlobAs(blob, FILE_NAME);

    expect(environment.createdObjectUrls[0]?.blob).toBe(blob);
  });

  it('leaves no anchor behind in the page it was invoked on', () => {
    const environment = createPageEnvironment();

    saveBlobAs(new Blob(['x']), FILE_NAME);

    expect(environment.document.querySelectorAll('a')).toHaveLength(0);
  });
});

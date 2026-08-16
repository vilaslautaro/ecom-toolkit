import type { Page } from '@playwright/test';

const IMAGES_TIMEOUT_MS = 15000;

export async function waitForRenderingToSettle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  await page.waitForFunction(
    () => Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
    undefined,
    { timeout: IMAGES_TIMEOUT_MS },
  );
}

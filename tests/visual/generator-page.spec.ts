import { expect, test } from '@playwright/test';
import { waitForRenderingToSettle } from './rendering-settled.js';

const DRAG_BUTTON = '#dragBtn';
const FINGERPRINT = '#fphash';

const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MOBILE_VIEWPORT = { width: 375, height: 812 };

test.describe('the generator page', () => {
  test.describe('on a desktop viewport', () => {
    test.use({ viewport: DESKTOP_VIEWPORT });

    test('renders the whole page as approved', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator(DRAG_BUTTON)).toBeVisible();
      await waitForRenderingToSettle(page);

      await expect(page).toHaveScreenshot('generator-page-desktop.png', {
        fullPage: true,
        mask: [page.locator(FINGERPRINT)],
      });
    });
  });

  test.describe('on a mobile viewport', () => {
    test.use({ viewport: MOBILE_VIEWPORT });

    test('renders the whole page as approved', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator(DRAG_BUTTON)).toBeVisible();
      await waitForRenderingToSettle(page);

      await expect(page).toHaveScreenshot('generator-page-mobile.png', {
        fullPage: true,
        mask: [page.locator(FINGERPRINT)],
      });
    });
  });
});

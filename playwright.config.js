import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

const VISUAL_PROJECT_IS_ENABLED = process.env.VISUAL_SNAPSHOTS === '1';

const visualProject = {
  name: 'visual',
  testDir: './tests/visual',
  use: {
    ...devices['Desktop Chrome'],
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    locale: 'es-AR',
    timezoneId: 'UTC',
  },
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.01,
    },
  },
};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    acceptDownloads: true,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ...(VISUAL_PROJECT_IS_ENABLED ? [visualProject] : []),
  ],

  webServer: {
    command: 'npx tsx scripts/serve.ts',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});

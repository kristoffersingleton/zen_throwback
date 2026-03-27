import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3901',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },

    // Dark-mode variants — only used by 07-dark-mode.spec.js
    { name: 'chromium-dark', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
    { name: 'webkit-dark',   use: { ...devices['Desktop Safari'], colorScheme: 'dark' } },
  ],

  webServer: {
    command: 'npx serve . --listen 3901 --no-clipboard',
    url: 'http://localhost:3901',
    reuseExistingServer: !process.env.CI,
  },
});

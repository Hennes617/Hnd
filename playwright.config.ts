import { defineConfig, devices } from '@playwright/test';
const production = process.env.HND_E2E_PRODUCTION === '1';
const baseURL = production ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:5173';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: production ? 'npm run preview -w @hnd/web -- --host 127.0.0.1 --port 4173 --strictPort' : 'npm run dev',
    url: baseURL, reuseExistingServer: !production && !process.env.CI, timeout: 90_000,
  },
});

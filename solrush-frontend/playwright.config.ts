import { defineConfig } from '@playwright/test';

const port = 3001;

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `NEXT_PUBLIC_E2E_WALLET=1 PORT=${port} npm run dev`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});

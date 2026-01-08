import { test, expect } from '@playwright/test';

test('perps renders with wallet disconnected', async ({ page }) => {
  await page.goto('/perps?wallet=off');
  await expect(page.getByTestId('perps-cta')).toHaveText('Connect Wallet');
});

test('perps loads markets and price with wallet connected', async ({ page }) => {
  await page.goto('/perps');
  await expect(page.getByTestId('perps-cta')).toHaveText(/Enter Size|Review Trade|Quoting/);

  const mark = page.getByTestId('perps-metric-mark');
  await expect(mark).toBeVisible();
});

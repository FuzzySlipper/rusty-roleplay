import { expect, test, type Page } from '@playwright/test';

// Ordinary E2E runs cannot assume the host-local debug service/profile exists.
// eslint-disable-next-line playwright/no-skipped-test -- opt-in live service proof
test.skip(
  process.env['RUSTY_ROLEPLAY_LIVE_RUN'] !== '1',
  'requires the local Rusty Crew debug service and Live Tester profile',
);

const actionLabels = [
  'Regenerate',
  'Continue',
  'Edit',
  'Delete',
  'Branch',
  'Bookmark',
] as const;

async function enterLiveTesterProfile(page: Page): Promise<void> {
  await page.goto('/?api=http://127.0.0.1:9348&profile=tester');
  await expect(page.locator('rv-transcript-viewport')).toBeVisible();
}

test('message actions reveal on hover and keyboard focus', async ({ page }) => {
  await enterLiveTesterProfile(page);

  const message = page.locator('.rv-message--assistant').first();
  const actions = message.locator('.rv-revision__actions');
  await expect(actions.getByRole('button')).toHaveText(actionLabels);
  await expect(actions).toHaveCSS('opacity', '0');
  await expect(actions).toHaveCSS('pointer-events', 'none');

  await message.hover();
  await expect(actions).toHaveCSS('opacity', '1');
  await expect(actions).toHaveCSS('pointer-events', 'auto');

  await page.locator('rv-message-input').hover();
  await expect(actions).toHaveCSS('opacity', '0');

  const regenerate = actions.getByRole('button', { name: 'Regenerate' });
  await regenerate.focus();
  await expect(regenerate).toBeFocused();
  await expect(actions).toHaveCSS('opacity', '1');
  await expect(actions).toHaveCSS('pointer-events', 'auto');
});

test.describe('touch device', () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });

  test('message actions remain visible without hover support', async ({
    page,
  }) => {
    await enterLiveTesterProfile(page);

    await expect
      .poll(() => page.evaluate(() => matchMedia('(hover: none)').matches))
      .toBe(true);
    const actions = page
      .locator('.rv-message--assistant')
      .first()
      .locator('.rv-revision__actions');
    await expect(actions).toHaveCSS('opacity', '1');
    await expect(actions).toHaveCSS('pointer-events', 'auto');
  });
});

import { expect, test } from '@playwright/test';

/**
 * Milestone 4 — Package Boundary Proof.
 *
 * Verifies, against the running app, that rusty-roleplay consumes rusty-view
 * (published @rusty-view/* packages, partial-compiled) without forking: the base
 * transcript renders a preloaded session via the imported renderer, an RP
 * message decorator is applied by that base renderer, an RP sidebar panel is
 * added through the layout's extension slot, and the profile gate is exercised
 * on the way in.
 *
 * This also covers the "preloaded transcript renders rows" path (messages
 * present at init), the regression scenario for rusty-view's virtual-scroll
 * init handling.
 */
test('profile gate → transcript rows, decorator, and RP extensions', async ({
  page,
}) => {
  await page.goto('/');

  // Profile selection gate.
  await expect(
    page.getByRole('heading', { name: 'Choose a profile' }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Sister A/ }).click();
  await page.getByRole('button', { name: /Enter as Sister A/ }).click();

  // Base chat mechanics consumed from rusty-view, mounted in the RP shell.
  await expect(page.locator('rv-transcript-viewport')).toBeVisible();
  await expect(page.locator('rv-message-input')).toBeVisible();

  // The transcript renders real message ROWS (preloaded at init) via the
  // imported base renderer.
  await expect(page.locator('.rv-transcript__item')).toHaveCount(3);
  await expect(
    page.getByText('The northern road is quiet', { exact: false }),
  ).toBeVisible();

  // RP message decorator applied by the base renderer (narrator prefix marker).
  await expect(page.locator('.rv-message__prefix').first()).toContainText('📖');

  // RP-specific extensions added without touching the base packages.
  await expect(page.getByRole('heading', { name: 'Lorebook' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Characters' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mechanic' })).toBeVisible();
});

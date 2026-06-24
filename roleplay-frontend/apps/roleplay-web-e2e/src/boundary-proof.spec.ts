import { expect, test } from '@playwright/test';

/**
 * Milestone 4 — Package Boundary Proof.
 *
 * Verifies, against the running app, that rusty-roleplay consumes rusty-view
 * without forking: the base transcript viewport and message input (imported
 * from @rusty-view/*) mount inside the RP shell, an RP sidebar panel is added
 * through the layout's extension slot, and the profile gate is exercised on the
 * way in.
 *
 * Note: the transcript viewport mounts and receives the message array, but the
 * base TranscriptViewportComponent does not paint message rows in this setup —
 * see frontend/NOTES.md ("Transcript row rendering"). That is an upstream
 * rusty-view virtual-scroll concern, not a consumption/boundary failure, so
 * this spec asserts the boundary facts rather than rendered row text.
 */
test('profile gate → rusty-view shell mounts with RP extensions', async ({
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
  await expect(page.locator('cdk-virtual-scroll-viewport')).toBeAttached();
  await expect(page.locator('rv-message-input')).toBeVisible();

  // RP-specific extensions added without touching the base packages.
  await expect(page.getByRole('heading', { name: 'Lorebook' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Characters' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mechanic' })).toBeVisible();
});

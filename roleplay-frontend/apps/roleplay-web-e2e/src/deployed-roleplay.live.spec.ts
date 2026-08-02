import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface BrowserConsoleEntry {
  readonly type: string;
  readonly text: string;
  readonly location: string;
}

interface BrowserPageError {
  readonly message: string;
  readonly stack: string | undefined;
}

interface ScreenshotEvidence {
  readonly name: string;
  readonly path: string;
}

// eslint-disable-next-line playwright/no-skipped-test -- opt-in real deployment
test.skip(
  process.env['RUSTY_ROLEPLAY_LIVE_RUN'] !== '1',
  'requires an explicitly selected deployed Rusty Roleplay backend',
);

test('deployed roleplay narrator survives refresh with RP controls @live-roleplay', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(360_000);

  const { backendUrl, profileName, sessionName, sessionId, expectedCharacter } =
    liveConfiguration();
  const artifactDirectory = testInfo.outputPath('live-artifacts');
  const screenshots: ScreenshotEvidence[] = [];
  const consoleEntries: BrowserConsoleEntry[] = [];
  const pageErrors: BrowserPageError[] = [];

  await mkdir(artifactDirectory, { recursive: true });
  page.on('console', (message) => {
    const location = message.location();
    consoleEntries.push({
      type: message.type(),
      text: message.text(),
      location: `${location.url}:${location.lineNumber}:${location.columnNumber}`,
    });
  });
  page.on('pageerror', (error) => {
    pageErrors.push({ message: error.message, stack: error.stack });
  });

  const health = await request.get(`${backendUrl}/v1/admin/healthz`);
  expect(health.ok(), `deployed backend must answer at ${backendUrl}`).toBe(
    true,
  );

  await page.goto(`/?api=${encodeURIComponent(backendUrl)}`);
  await expect(
    page.getByRole('heading', { name: 'Choose a profile' }),
  ).toHaveCount(0);

  await enterRoleplay(page, profileName);
  await expect(page.locator('rv-transcript-viewport')).toBeVisible();
  await expect(page.locator('.scene')).toHaveText(sessionName);
  await capture(page, testInfo, screenshots, '00-direct-roleplay-entry');
  const modelActivityToggle = page.getByTestId('model-activity-toggle');
  await expect(modelActivityToggle).not.toBeChecked();
  await modelActivityToggle.check();
  await capture(page, testInfo, screenshots, '01-profile-selected');

  await page.getByRole('button', { name: 'RP Sessions', exact: true }).click();
  await expect(
    page
      .locator('app-roleplay-session-panel')
      .getByRole('button', { name: new RegExp(sessionName) })
      .first(),
  ).toBeVisible();
  await capture(page, testInfo, screenshots, '02-rp-session-panel');
  await page.getByRole('button', { name: 'Close Roleplay Sessions' }).click();

  await page.getByRole('button', { name: 'RP Setup', exact: true }).click();
  await page.getByRole('tab', { name: 'Characters', exact: true }).click();
  await expect(
    page.getByText(expectedCharacter, { exact: true }).first(),
  ).toBeVisible();
  await capture(page, testInfo, screenshots, '03-rp-setup-character-control');
  await page.getByTestId('top-menu-panel-close').click();
  await expect(page.getByTestId('top-menu-overlay-custom')).toHaveCount(0);

  const phaseIndicator = page.locator('rp-narrator-phase-indicator');
  await installPhaseRecorder(phaseIndicator);
  const marker = `TASK5550_DEPLOYED_${Date.now()}`;
  const prompt = [
    `${marker}: At the silver orchard gate, Rowan asks why the serpent-and-rose crest matches Elara's locket.`,
    'Consult the relevant lore and answer with two concise in-world paragraphs.',
  ].join(' ');

  await page.locator('textarea').fill(prompt);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const userMessage = page
    .locator('[data-testid="message-row"][data-message-role="user"]')
    .filter({ hasText: marker });
  await expect(userMessage).toBeVisible({ timeout: 30_000 });

  const assistant = userMessage.locator(
    'xpath=following::div[@data-testid="message-row" and @data-message-role="assistant"][1]',
  );
  await expect(assistant).toBeVisible({ timeout: 180_000 });
  await capture(page, testInfo, screenshots, '04-narrator-streaming');
  await expect(assistant).toHaveAttribute('data-message-status', 'completed', {
    timeout: 300_000,
  });

  const recallTool = assistant
    .locator('[data-testid="tool-call-block"][data-status="completed"]')
    .filter({ hasText: 'recall_lore' });
  await expect(recallTool).toBeVisible();
  await expect(recallTool).toHaveAttribute('data-status', 'completed');
  const reasoning = assistant.getByTestId('reasoning-block').first();
  await capture(page, testInfo, screenshots, '05-turn-complete');
  // Real narrator providers may omit visible reasoning while still emitting
  // completed tool activity and answer text.
  // eslint-disable-next-line playwright/no-conditional-in-test
  if ((await reasoning.count()) > 0) {
    const reasoningToggle = reasoning.getByTestId('reasoning-toggle');
    await reasoningToggle.click();
    // eslint-disable-next-line playwright/no-conditional-expect
    await expect(reasoningToggle).toHaveAttribute('aria-expanded', 'true');
    // eslint-disable-next-line playwright/no-conditional-expect
    await expect(reasoning.locator('.rv-block__content')).toContainText(/\S+/);
    await capture(page, testInfo, screenshots, '06-reasoning-expanded');
  }

  await expect(phaseIndicator).toContainText('Idle', { timeout: 30_000 });
  const phaseHistory = await recordedPhases(phaseIndicator);
  expect(phaseHistory).toContain('Searching lore...');
  expect(phaseHistory).toContain('Writing...');
  expect(phaseHistory).toContain('Reviewing...');
  expect(phaseHistory.at(-1)).toBe('Idle');

  const visibleTranscript = await page
    .locator('rv-transcript-viewport')
    .innerText();
  const toolNames = await assistant
    .getByTestId('tool-call-block')
    .locator('.rv-block__tool-name')
    .allTextContents();
  const assistantText = await assistant
    .getByTestId('text-block-content')
    .allTextContents();

  await page.reload();
  await enterRoleplay(page, profileName);
  await expect(page.locator('.scene')).toHaveText(sessionName);
  await expect(page.getByTestId('model-activity-toggle')).toBeChecked();
  await expect(page.getByText(marker, { exact: false })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page
      .locator('[data-testid="tool-call-block"][data-status="completed"]')
      .filter({ hasText: 'recall_lore' })
      .last(),
  ).toBeVisible();
  await capture(page, testInfo, screenshots, '07-transcript-after-refresh');

  const sessionSnapshotResponse = await request.get(
    `${backendUrl}/v1/chat/sessions/${encodeURIComponent(sessionId)}`,
  );
  expect(sessionSnapshotResponse.ok()).toBe(true);
  const sessionSnapshot: unknown = await sessionSnapshotResponse.json();
  const debugSnapshot = {
    capturedAt: new Date().toISOString(),
    backendUrl,
    profileName,
    sessionName,
    sessionId,
    marker,
    phaseHistory,
    toolNames,
    reasoningBlockCount: await assistant.getByTestId('reasoning-block').count(),
    assistantText,
    sessionSnapshot,
  };
  const errorConsoleEntries = consoleEntries.filter(
    (entry) => entry.type === 'error',
  );
  const evidencePacket = {
    scenario: testInfo.title,
    backendUrl,
    profileName,
    sessionName,
    sessionId,
    marker,
    screenshots,
    phaseHistory,
    toolNames,
    assistantText,
    visibleTranscript,
    consoleEntries,
    pageErrors,
    transcriptRefreshVerified: true,
    roleplayControlVerified: `RP Setup → Characters → ${expectedCharacter}`,
  };

  await writeJson(join(artifactDirectory, 'console.json'), consoleEntries);
  await writeJson(join(artifactDirectory, 'page-errors.json'), pageErrors);
  await writeFile(
    join(artifactDirectory, 'visible-transcript.txt'),
    `${visibleTranscript}\n`,
  );
  await writeJson(
    join(artifactDirectory, 'debug-snapshot.json'),
    debugSnapshot,
  );
  await writeJson(
    join(artifactDirectory, 'evidence-packet.json'),
    evidencePacket,
  );
  await writeFile(
    join(artifactDirectory, 'scenario-summary.md'),
    [
      '# Deployed Rusty Roleplay live scenario',
      '',
      `- Backend: ${backendUrl}`,
      `- Profile: ${profileName}`,
      `- Session: ${sessionName}`,
      `- Session ID: ${sessionId}`,
      `- Phase history: ${phaseHistory.join(' → ')}`,
      `- Tools rendered: ${toolNames.join(', ')}`,
      `- Transcript refresh: verified with ${marker}`,
      `- Roleplay control: RP Setup → Characters → ${expectedCharacter}`,
      `- Console errors: ${errorConsoleEntries.length}`,
      `- Page errors: ${pageErrors.length}`,
      '',
    ].join('\n'),
  );

  expect(errorConsoleEntries).toEqual([]);
  expect(pageErrors).toEqual([]);
});

async function enterRoleplay(page: Page, profileName: string): Promise<void> {
  await expect(page.locator('rv-transcript-viewport')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('.profile')).toHaveText(profileName);
}

async function installPhaseRecorder(phaseIndicator: Locator): Promise<void> {
  await phaseIndicator.evaluate((element) => {
    const record = (): void => {
      const phase = element.textContent?.trim();
      if (phase === undefined || phase.length === 0) return;
      const recorded = (element.getAttribute('data-recorded-phases') ?? '')
        .split('|')
        .filter((item) => item.length > 0);
      if (recorded.at(-1) !== phase) {
        element.setAttribute(
          'data-recorded-phases',
          [...recorded, phase].join('|'),
        );
      }
    };
    record();
    new MutationObserver(record).observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
}

async function recordedPhases(
  phaseIndicator: Locator,
): Promise<readonly string[]> {
  return (
    (await phaseIndicator.getAttribute('data-recorded-phases')) ?? ''
  ).split('|');
}

async function capture(
  page: Page,
  testInfo: TestInfo,
  screenshots: ScreenshotEvidence[],
  name: string,
): Promise<void> {
  const path = testInfo.outputPath('live-artifacts', `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  screenshots.push({ name, path });
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} must name the deployed Rusty Roleplay backend`);
  }
  return value.replace(/\/+$/, '');
}

function liveConfiguration(): {
  readonly backendUrl: string;
  readonly profileName: string;
  readonly sessionName: string;
  readonly sessionId: string;
  readonly expectedCharacter: string;
} {
  return {
    backendUrl: requiredEnvironment('RUSTY_ROLEPLAY_LIVE_BACKEND_URL'),
    profileName:
      process.env['RUSTY_ROLEPLAY_LIVE_PROFILE_NAME'] ?? 'Roleplay Test',
    sessionName:
      process.env['RUSTY_ROLEPLAY_LIVE_SESSION_NAME'] ?? 'The Silver Orchard',
    sessionId:
      process.env['RUSTY_ROLEPLAY_LIVE_SESSION_ID'] ?? 'roleplay-test-scene',
    expectedCharacter:
      process.env['RUSTY_ROLEPLAY_LIVE_CHARACTER_NAME'] ?? 'Elara Voss',
  };
}

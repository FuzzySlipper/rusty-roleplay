import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DEPLOYMENT_ROOT = '/home/system/rusty-roleplay-test';
const COMPOSE_FILE = `${DEPLOYMENT_ROOT}/compose.yaml`;

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

interface ApiEnvelope<T> {
  readonly ok: boolean;
  readonly data: T;
}

interface MechanicProposalRecord {
  readonly proposalId: string;
  readonly status: string;
  readonly revision: number;
  readonly rationale: string;
  readonly proposedValue: unknown;
}

interface MechanicDiagnosticRecord {
  readonly diagnosticId: string;
  readonly outcome: string;
  readonly revision: number;
  readonly symptom: string;
  readonly notes?: string;
}

test.skip(
  process.env['RUSTY_ROLEPLAY_MECHANIC_LIVE_RUN'] !== '1',
  'requires the explicitly selected isolated Rusty Roleplay deployment',
);

test('deployed mechanic diagnoses, proposes, applies, and survives restart @live-mechanic', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(720_000);
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(30_000);

  const config = liveConfiguration();
  const artifactDirectory = testInfo.outputPath('live-artifacts');
  const screenshots: ScreenshotEvidence[] = [];
  const consoleEntries: BrowserConsoleEntry[] = [];
  const pageErrors: BrowserPageError[] = [];
  const marker = `TASK5962_BROWSER_${Date.now()}`;
  const acceptedExemplar = `Rain counted three patient notes against the silver orchard gate. ${marker}`;
  const rejectedExemplar = `This rejected browser proposal must remain inert. ${marker}`;
  const symptom = `Flat and contradictory crest explanation ${marker}`;

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

  const loopbackHealth = await healthReceipt(request, config.backendUrl);
  const lanHealth = await healthReceipt(request, config.lanUrl);
  const sourceRevision = (await run('git', ['rev-parse', 'HEAD'])).trim();
  const containerBefore = await containerReceipt();
  const beforeNarratorConfig = await narratorConfig(
    request,
    config.backendUrl,
    config.narratorProfileId,
  );
  const isolationReceipt = await mechanicIsolationReceipt(
    request,
    config.backendUrl,
    config.narratorProfileId,
    config.mechanicProfileId,
  );

  await page.goto(`/?api=${encodeURIComponent(config.backendUrl)}`);
  await enterProfile(page, config.narratorProfileName);
  await openMechanicPanel(page);
  const panel = page.locator('rp-mechanic-panel');
  await panel
    .getByRole('combobox', { name: 'Profile', exact: true })
    .selectOption({ value: config.mechanicProfileId });
  await expect(
    panel.getByRole('heading', { name: config.mechanicName }),
  ).toBeVisible();
  await expect(
    panel.getByText('roleplay_mechanic', { exact: true }),
  ).toBeVisible();
  await expect(panel.getByText('Verified', { exact: true })).toBeVisible();
  await capture(page, testInfo, screenshots, '00-isolated-mechanic-profile');

  await panel.getByRole('button', { name: 'Sessions', exact: true }).click();
  const attachedSession = panel
    .locator('li')
    .filter({ hasText: `RP: ${config.roleplaySessionId}` })
    .first();
  await expect(attachedSession).toBeVisible();
  const mechanicSessionRead = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === 'GET' &&
      url.pathname === `/v1/chat/sessions/${config.mechanicSessionId}` &&
      response.ok()
    );
  });
  await panel.getByRole('button', { name: 'Enter mechanic mode' }).click();
  await mechanicSessionRead;
  await expect(
    panel.getByRole('button', { name: 'Return to RP' }),
  ).toBeVisible();
  await expect(page.locator('rv-transcript-viewport')).toBeVisible();
  await capture(page, testInfo, screenshots, '01-attached-mechanic-session');
  await page
    .getByRole('button', { name: 'Close Mechanic / OOC Workspace' })
    .click();

  const proposalMarkdown = [
    '---',
    `roleplay_session_id: ${config.roleplaySessionId}`,
    'change_kind: exemplar',
    `rationale: ${marker}`,
    'evidence:',
    '  - attached-transcript-and-recall-trace',
    '---',
    acceptedExemplar,
  ].join('\n');
  const diagnosticMarkdown = [
    '---',
    `symptom: ${symptom}`,
    'hypothesis: Retrieved lore confirms the visual match but leaves its origin unconstrained.',
    '---',
    `${marker}: grounded in the attached transcript, scene, and recall trace.`,
  ].join('\n');
  const prompt = [
    `Live browser certification ${marker}. The narrator output feels flat and contradictory.`,
    `Call inspect_roleplay_transcript for sessionId ${config.roleplaySessionId} with limit 8.`,
    `Call inspect_roleplay_scene for sessionId ${config.roleplaySessionId}.`,
    `Call inspect_lore_retrieval for sessionId ${config.roleplaySessionId} with limit 5.`,
    'Call propose_roleplay_change exactly once using this complete Markdown as its proposal argument:',
    proposalMarkdown,
    'Call record_roleplay_diagnostic exactly once using this complete Markdown as its report argument:',
    diagnosticMarkdown,
    'Do not directly mutate or apply anything. Explain that user approval is required.',
  ].join('\n\n');

  await page.locator('rv-message-input textarea').fill(prompt);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const userMessage = page
    .locator('[data-testid="message-row"][data-message-role="user"]')
    .filter({ hasText: marker });
  await expect(userMessage).toBeVisible({ timeout: 30_000 });
  const assistant = userMessage.locator(
    'xpath=following::div[@data-testid="message-row" and @data-message-role="assistant"][1]',
  );
  await expect(assistant).toHaveAttribute('data-message-status', 'completed', {
    timeout: 300_000,
  });
  const toolNames = await assistant
    .getByTestId('tool-call-block')
    .locator('.rv-block__tool-name')
    .allTextContents();
  for (const tool of [
    'inspect_roleplay_transcript',
    'inspect_roleplay_scene',
    'inspect_lore_retrieval',
    'propose_roleplay_change',
    'record_roleplay_diagnostic',
  ]) {
    expect(toolNames).toContain(tool);
  }
  await expect(assistant).toContainText(/approv/i);
  await capture(page, testInfo, screenshots, '02-real-mechanic-wake');

  const proposed = await waitForProposal(
    request,
    config.backendUrl,
    config.roleplaySessionId,
    marker,
    'proposed',
  );
  const diagnostic = await waitForDiagnostic(
    request,
    config.backendUrl,
    config.mechanicSessionId,
    marker,
  );
  expect(
    await narratorConfig(request, config.backendUrl, config.narratorProfileId),
  ).toEqual(beforeNarratorConfig);

  await openMechanicPanel(page);
  await panel.getByRole('button', { name: 'Proposals', exact: true }).click();
  await panel.getByRole('button', { name: 'Refresh', exact: true }).click();
  const acceptedProposalCard = panel
    .locator('.proposal-list li')
    .filter({ has: panel.getByText(marker, { exact: true }) })
    .first();
  await expect(acceptedProposalCard).toBeVisible();
  await acceptedProposalCard.locator('.card-main').click();
  const proposalDetail = panel.locator('article.detail');
  await expect(proposalDetail).toContainText(acceptedExemplar);
  await expect(proposalDetail.locator('.status')).toHaveText('Pending');
  await capture(page, testInfo, screenshots, '03-proposal-inert');

  await proposalDetail
    .getByRole('button', { name: 'Approve', exact: true })
    .click();
  await expect(proposalDetail.locator('.status')).toHaveText('Approved');
  await waitForProposal(
    request,
    config.backendUrl,
    config.roleplaySessionId,
    marker,
    'approved',
  );
  expect(
    await narratorConfig(request, config.backendUrl, config.narratorProfileId),
  ).toEqual(beforeNarratorConfig);
  await capture(page, testInfo, screenshots, '04-approved-still-inert');

  await proposalDetail
    .getByRole('button', { name: 'Apply approved change', exact: true })
    .click();
  await expect(proposalDetail.locator('.status')).toHaveText('Applied');
  const applied = await waitForProposal(
    request,
    config.backendUrl,
    config.roleplaySessionId,
    marker,
    'applied',
  );
  const appliedNarratorConfig = await narratorConfig(
    request,
    config.backendUrl,
    config.narratorProfileId,
  );
  expect(appliedNarratorConfig['exemplar']).toBe(acceptedExemplar);
  await capture(page, testInfo, screenshots, '05-applied-through-frontend');

  const rejected = await createRejectedProposal(
    request,
    config.backendUrl,
    config.mechanicSessionId,
    config.roleplaySessionId,
    rejectedExemplar,
    marker,
  );
  await panel.getByRole('button', { name: 'Refresh', exact: true }).click();
  const rejectedProposalCard = panel
    .locator('.proposal-list li')
    .filter({ hasText: `Rejected ${marker}` })
    .first();
  await expect(rejectedProposalCard).toBeVisible();
  await rejectedProposalCard.locator('.card-main').click();
  await proposalDetail
    .getByRole('button', { name: 'Reject', exact: true })
    .click();
  await expect(proposalDetail.locator('.status')).toHaveText('Rejected');
  const rejectedApply = await request.post(
    `${config.backendUrl}/v1/admin/roleplay/mechanic-proposals/${encodeURIComponent(rejected.proposalId)}/apply`,
    { data: { actorId: 'task-5962-browser' } },
  );
  expect(rejectedApply.status()).toBe(409);
  expect(
    (
      await narratorConfig(request, config.backendUrl, config.narratorProfileId)
    )['exemplar'],
  ).toBe(acceptedExemplar);
  await capture(page, testInfo, screenshots, '06-rejected-change-inert');

  await panel.getByRole('button', { name: 'Diagnostics', exact: true }).click();
  await panel.getByRole('button', { name: 'Refresh', exact: true }).click();
  const diagnosticCard = panel
    .locator('.cards li')
    .filter({ hasText: symptom })
    .first();
  await expect(diagnosticCard).toBeVisible();
  await diagnosticCard.locator('.card-main').click();
  const diagnosticDetail = panel.locator('article.detail');
  await diagnosticDetail
    .getByRole('combobox', { name: 'Outcome', exact: true })
    .selectOption('improved');
  await diagnosticDetail
    .getByRole('textbox', { name: 'Follow-up notes', exact: true })
    .fill(`Visible browser outcome saved for ${marker}.`);
  await diagnosticDetail.getByRole('button', { name: 'Save outcome' }).click();
  await expect(
    diagnosticDetail.getByRole('combobox', {
      name: 'Outcome',
      exact: true,
    }),
  ).toHaveValue('improved');
  const improvedDiagnostic = await waitForDiagnostic(
    request,
    config.backendUrl,
    config.mechanicSessionId,
    'Visible browser outcome saved',
    'improved',
  );
  await capture(page, testInfo, screenshots, '07-diagnostic-outcome');

  const visibleTranscript = await page
    .locator('rv-transcript-viewport')
    .innerText();
  await page.reload();
  await enterProfile(page, config.narratorProfileName);
  await selectMechanicProfile(page, config.mechanicProfileId);
  await openProposal(page, marker);
  await expect(
    page.locator('rp-mechanic-panel article.detail .status'),
  ).toHaveText('Applied');
  await capture(page, testInfo, screenshots, '08-applied-after-refresh');

  await page.goto('about:blank');
  await restartIsolatedDeployment();
  const loopbackHealthAfterRestart = await waitForHealth(
    request,
    config.backendUrl,
  );
  const lanHealthAfterRestart = await waitForHealth(request, config.lanUrl);
  const containerAfter = await containerReceipt();

  await page.goto(`/?api=${encodeURIComponent(config.backendUrl)}`);
  await enterProfile(page, config.narratorProfileName);
  await selectMechanicProfile(page, config.mechanicProfileId);
  await openProposal(page, marker);
  await expect(
    page.locator('rp-mechanic-panel article.detail .status'),
  ).toHaveText('Applied');
  await page
    .locator('rp-mechanic-panel')
    .getByRole('button', { name: 'Diagnostics', exact: true })
    .click();
  await expect(
    page
      .locator('rp-mechanic-panel .cards li')
      .filter({ hasText: symptom })
      .first(),
  ).toContainText('Improved');
  const narratorConfigAfterRestart = await narratorConfig(
    request,
    config.backendUrl,
    config.narratorProfileId,
  );
  expect(narratorConfigAfterRestart['exemplar']).toBe(acceptedExemplar);
  await capture(
    page,
    testInfo,
    screenshots,
    '09-persisted-after-container-restart',
  );

  const proposalAfterRestart = await readProposal(
    request,
    config.backendUrl,
    applied.proposalId,
  );
  const diagnosticAfterRestart = await waitForDiagnostic(
    request,
    config.backendUrl,
    config.mechanicSessionId,
    'Visible browser outcome saved',
    'improved',
  );
  const debugSnapshot = {
    capturedAt: new Date().toISOString(),
    marker,
    sourceRevision,
    containerBefore,
    containerAfter,
    loopbackHealth,
    lanHealth,
    loopbackHealthAfterRestart,
    lanHealthAfterRestart,
    isolationReceipt,
    beforeNarratorConfig,
    narratorConfigAfterRestart,
    proposed,
    proposalAfterRestart,
    diagnostic,
    diagnosticAfterRestart,
    rejectedProposalId: rejected.proposalId,
    rejectedApplyStatus: rejectedApply.status(),
    toolNames,
  };
  const errorConsoleEntries = consoleEntries.filter(
    (entry) => entry.type === 'error',
  );
  const evidencePacket = {
    scenario: testInfo.title,
    marker,
    backendUrl: config.backendUrl,
    lanUrl: config.lanUrl,
    narratorProfileId: config.narratorProfileId,
    mechanicProfileId: config.mechanicProfileId,
    mechanicSessionId: config.mechanicSessionId,
    roleplaySessionId: config.roleplaySessionId,
    proposalId: applied.proposalId,
    diagnosticId: improvedDiagnostic.diagnosticId,
    sourceRevision,
    imageId: containerAfter.imageId,
    imageSourceRevision:
      containerAfter.labels['org.opencontainers.image.revision'],
    crewRevision: containerAfter.labels['io.rusty-roleplay.crew-revision'],
    toolNames,
    screenshots,
    consoleEntries,
    pageErrors,
    proposalStayedInertUntilApply: true,
    approvedStayedInertUntilApply: true,
    appliedThroughFrontend: true,
    rejectionStayedInert: true,
    diagnosticOutcomeShown: true,
    refreshPersistenceVerified: true,
    containerRestartPersistenceVerified: true,
    loopbackAndLanHealthVerified: true,
  };

  await writeJson(join(artifactDirectory, 'console.json'), consoleEntries);
  await writeJson(join(artifactDirectory, 'page-errors.json'), pageErrors);
  await writeFile(
    join(artifactDirectory, 'visible-mechanic-transcript.txt'),
    `${visibleTranscript}\n`,
  );
  await writeJson(join(artifactDirectory, 'backend-state-receipt.json'), {
    proposalAfterRestart,
    diagnosticAfterRestart,
    narratorConfigAfterRestart,
    rejectedProposalId: rejected.proposalId,
    rejectedApplyStatus: rejectedApply.status(),
  });
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
      '# Deployed mechanic live certification',
      '',
      `- Marker: ${marker}`,
      `- Source revision: ${sourceRevision}`,
      `- Image ID: ${containerAfter.imageId}`,
      `- Image source revision: ${containerAfter.labels['org.opencontainers.image.revision'] ?? 'unknown'}`,
      `- Crew revision: ${containerAfter.labels['io.rusty-roleplay.crew-revision'] ?? 'unknown'}`,
      `- Mechanic profile: ${config.mechanicProfileId}`,
      `- Mechanic session: ${config.mechanicSessionId}`,
      `- Proposal: ${applied.proposalId} (applied and restart-persistent)`,
      `- Diagnostic: ${improvedDiagnostic.diagnosticId} (improved and restart-persistent)`,
      `- Rejected apply status: ${rejectedApply.status()}`,
      `- Tools rendered: ${toolNames.join(', ')}`,
      `- Loopback health: ${config.backendUrl}`,
      `- LAN health: ${config.lanUrl}`,
      `- Console errors: ${errorConsoleEntries.length}`,
      `- Page errors: ${pageErrors.length}`,
      '',
    ].join('\n'),
  );

  expect(containerAfter.imageId).toBe(containerBefore.imageId);
  expect(containerAfter.startedAt).not.toBe(containerBefore.startedAt);
  expect(errorConsoleEntries).toEqual([]);
  expect(pageErrors).toEqual([]);
});

async function enterProfile(page: Page, profileName: string): Promise<void> {
  const profile = page.getByRole('button', { name: profileName, exact: true });
  await expect(profile).toBeVisible({ timeout: 30_000 });
  await profile.click();
  await page
    .getByRole('button', { name: `Enter as ${profileName}`, exact: true })
    .click();
  await expect(page.locator('rv-transcript-viewport')).toBeVisible({
    timeout: 30_000,
  });
}

async function openMechanicPanel(page: Page): Promise<void> {
  const panel = page.locator('rp-mechanic-panel');
  if (!(await panel.isVisible())) {
    await page.getByRole('button', { name: 'Mechanic', exact: true }).click();
  }
  await expect(panel).toBeVisible();
}

async function selectMechanicProfile(
  page: Page,
  mechanicProfileId: string,
): Promise<void> {
  await openMechanicPanel(page);
  const panel = page.locator('rp-mechanic-panel');
  await panel
    .getByRole('combobox', { name: 'Profile', exact: true })
    .selectOption({ value: mechanicProfileId });
  await expect(panel.getByText('Verified', { exact: true })).toBeVisible();
}

async function openProposal(page: Page, marker: string): Promise<void> {
  const panel = page.locator('rp-mechanic-panel');
  await panel.getByRole('button', { name: 'Proposals', exact: true }).click();
  await panel.getByRole('button', { name: 'Refresh', exact: true }).click();
  const proposal = panel
    .locator('.proposal-list li')
    .filter({ has: panel.getByText(marker, { exact: true }) })
    .first();
  await expect(proposal).toBeVisible();
  await proposal.locator('.card-main').click();
}

async function mechanicIsolationReceipt(
  request: APIRequestContext,
  backendUrl: string,
  narratorProfileId: string,
  mechanicProfileId: string,
): Promise<Record<string, unknown>> {
  const registry = await apiData<{
    readonly items: readonly Record<string, unknown>[];
  }>(request, `${backendUrl}/v1/admin/profiles/registry`);
  const narrator = registry.items.find(
    (item) => item['profileId'] === narratorProfileId,
  );
  const mechanic = registry.items.find(
    (item) => item['profileId'] === mechanicProfileId,
  );
  expect(narrator).toBeDefined();
  expect(mechanic).toBeDefined();
  expect(mechanicProfileId).not.toBe(narratorProfileId);
  const config = await apiData<Record<string, unknown>>(
    request,
    `${backendUrl}/v1/admin/roleplay/profiles/${mechanicProfileId}/mechanic-config`,
  );
  expect(config['configured']).toBe(true);
  expect(config['localToolProfileId']).toBe('roleplay_mechanic');
  expect(config['toolPolicyIsolated']).toBe(true);
  expect(narrator?.['localToolProfileId']).not.toBe('roleplay_mechanic');
  return { narrator, mechanic, mechanicConfig: config };
}

async function narratorConfig(
  request: APIRequestContext,
  backendUrl: string,
  profileId: string,
): Promise<Record<string, unknown>> {
  const data = await apiData<{ readonly config: Record<string, unknown> }>(
    request,
    `${backendUrl}/v1/admin/roleplay/profiles/${profileId}/narrator-config`,
  );
  return data.config;
}

async function waitForProposal(
  request: APIRequestContext,
  backendUrl: string,
  roleplaySessionId: string,
  rationale: string,
  status: string,
): Promise<MechanicProposalRecord> {
  return poll(async () => {
    const proposals = await apiData<readonly MechanicProposalRecord[]>(
      request,
      `${backendUrl}/v1/admin/roleplay/mechanic-proposals?roleplay_session_id=${encodeURIComponent(roleplaySessionId)}`,
    );
    return proposals.find(
      (proposal) =>
        proposal.rationale === rationale && proposal.status === status,
    );
  }, `proposal ${rationale} to reach ${status}`);
}

async function waitForDiagnostic(
  request: APIRequestContext,
  backendUrl: string,
  mechanicSessionId: string,
  marker: string,
  outcome?: string,
): Promise<MechanicDiagnosticRecord> {
  return poll(async () => {
    const data = await apiData<{
      readonly items: readonly MechanicDiagnosticRecord[];
    }>(
      request,
      `${backendUrl}/v1/admin/roleplay/mechanic-diagnostics?mechanic_session_id=${encodeURIComponent(mechanicSessionId)}`,
    );
    return data.items.find(
      (diagnostic) =>
        `${diagnostic.symptom} ${diagnostic.notes ?? ''}`.includes(marker) &&
        (outcome === undefined || diagnostic.outcome === outcome),
    );
  }, `diagnostic containing ${marker}`);
}

async function createRejectedProposal(
  request: APIRequestContext,
  backendUrl: string,
  mechanicSessionId: string,
  roleplaySessionId: string,
  proposedValue: string,
  marker: string,
): Promise<MechanicProposalRecord> {
  return apiData<MechanicProposalRecord>(
    request,
    `${backendUrl}/v1/admin/roleplay/mechanic-proposals`,
    {
      method: 'POST',
      data: {
        proposalId: `mechanic-proposal-browser-rejected-${Date.now()}`,
        mechanicSessionId,
        roleplaySessionId,
        kind: 'exemplar',
        proposedValue,
        rationale: `Rejected ${marker}`,
        diagnosticContext: { source: 'task-5962-browser-certification' },
      },
    },
  );
}

async function readProposal(
  request: APIRequestContext,
  backendUrl: string,
  proposalId: string,
): Promise<MechanicProposalRecord> {
  return apiData<MechanicProposalRecord>(
    request,
    `${backendUrl}/v1/admin/roleplay/mechanic-proposals/${encodeURIComponent(proposalId)}`,
  );
}

async function apiData<T>(
  request: APIRequestContext,
  url: string,
  options: Parameters<APIRequestContext['fetch']>[1] = {},
): Promise<T> {
  const response = await request.fetch(url, options);
  expect(response.ok(), await response.text()).toBe(true);
  const envelope = (await response.json()) as ApiEnvelope<T>;
  expect(envelope.ok).toBe(true);
  return envelope.data;
}

async function healthReceipt(
  request: APIRequestContext,
  baseUrl: string,
): Promise<Record<string, unknown>> {
  return apiData<Record<string, unknown>>(
    request,
    `${baseUrl}/v1/admin/healthz`,
  );
}

async function waitForHealth(
  request: APIRequestContext,
  baseUrl: string,
): Promise<Record<string, unknown>> {
  return poll(
    async () => {
      try {
        const response = await request.get(`${baseUrl}/v1/admin/healthz`, {
          timeout: 5_000,
        });
        if (!response.ok()) return undefined;
        const envelope = (await response.json()) as ApiEnvelope<
          Record<string, unknown>
        >;
        return envelope.ok ? envelope.data : undefined;
      } catch {
        return undefined;
      }
    },
    `${baseUrl} health after restart`,
    90_000,
  );
}

async function restartIsolatedDeployment(): Promise<void> {
  if (process.env['RUSTY_ROLEPLAY_MECHANIC_ALLOW_RESTART'] !== '1') {
    throw new Error(
      'RUSTY_ROLEPLAY_MECHANIC_ALLOW_RESTART=1 is required for the isolated restart proof',
    );
  }
  await run('docker', [
    'compose',
    '--file',
    COMPOSE_FILE,
    '--project-directory',
    DEPLOYMENT_ROOT,
    'restart',
    'rusty-roleplay',
  ]);
}

async function containerReceipt(): Promise<{
  readonly containerId: string;
  readonly imageId: string;
  readonly configuredImage: string;
  readonly startedAt: string;
  readonly labels: Readonly<Record<string, string>>;
}> {
  const containerId = (
    await run('docker', [
      'compose',
      '--file',
      COMPOSE_FILE,
      '--project-directory',
      DEPLOYMENT_ROOT,
      'ps',
      '-q',
      'rusty-roleplay',
    ])
  ).trim();
  expect(containerId).not.toBe('');
  const raw = await run('docker', ['inspect', containerId]);
  const inspected = JSON.parse(raw) as readonly {
    readonly Id: string;
    readonly Image: string;
    readonly Config: {
      readonly Image: string;
      readonly Labels: Readonly<Record<string, string>> | null;
    };
    readonly State: { readonly StartedAt: string };
  }[];
  const container = inspected[0];
  if (container === undefined)
    throw new Error('isolated container disappeared');
  return {
    containerId: container.Id,
    imageId: container.Image,
    configuredImage: container.Config.Image,
    startedAt: container.State.StartedAt,
    labels: container.Config.Labels ?? {},
  };
}

async function run(command: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync(command, [...args], {
    maxBuffer: 10 * 1024 * 1024,
  });
  return result.stdout;
}

async function poll<T>(
  read: () => Promise<T | undefined>,
  description: string,
  timeout = 30_000,
): Promise<T> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await read();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${description}`);
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
    throw new Error(`${name} must name the isolated Rusty Roleplay deployment`);
  }
  return value.replace(/\/+$/, '');
}

function liveConfiguration(): {
  readonly backendUrl: string;
  readonly lanUrl: string;
  readonly narratorProfileId: string;
  readonly narratorProfileName: string;
  readonly mechanicProfileId: string;
  readonly mechanicName: string;
  readonly mechanicSessionId: string;
  readonly roleplaySessionId: string;
} {
  return {
    backendUrl: requiredEnvironment('RUSTY_ROLEPLAY_LIVE_BACKEND_URL'),
    lanUrl: requiredEnvironment('RUSTY_ROLEPLAY_LIVE_LAN_URL'),
    narratorProfileId: 'roleplay-test',
    narratorProfileName: 'Roleplay Test',
    mechanicProfileId: 'roleplay-mechanic-test',
    mechanicName: 'Maren',
    mechanicSessionId: requiredEnvironment(
      'RUSTY_ROLEPLAY_LIVE_MECHANIC_SESSION_ID',
    ),
    roleplaySessionId: 'roleplay-test-scene',
  };
}

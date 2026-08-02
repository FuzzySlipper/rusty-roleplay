import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  evaluateStExampleLongChat,
  evaluateStExampleTurn,
  type StExampleTurnEvidence,
} from './st-example-evaluation';

type ApiRecord = Record<string, unknown>;

interface ChatEvent {
  readonly kind: string;
  readonly payload?: ApiRecord;
}

const dreamPlanet = 'st-lore:The-Dream-Planet';

// eslint-disable-next-line playwright/no-skipped-test -- opt-in real deployment
test.skip(
  process.env['RUSTY_ROLEPLAY_ST_EXAMPLE_LIVE_RUN'] !== '1',
  'requires the isolated deployment with the imported ST example packet',
);

test('tuned controls preserve imported ST lore across a longer chat @live-st-example', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(900_000);

  const config = liveConfiguration();
  const artifactDirectory = testInfo.outputPath('st-example-artifacts');
  await mkdir(artifactDirectory, { recursive: true });

  const source = await apiData<ApiRecord>(
    request,
    `${config.backendUrl}/v1/chat/sessions/${encodeURIComponent(config.sourceSessionId)}`,
  );
  const sourceMessageId = terminalMessageId(source);
  expect(readRecords(source['message_slots'])).toHaveLength(71);

  await patchNarratorConfig(request, config.backendUrl, config.profileId, {
    tone: 'lush',
    pacing: 'balanced',
    explicitness: 'romantic',
    memoryDepth: 'medium',
    stylePrompt: '',
    exemplar: '',
    review: { enabled: false, maxReviewCycles: 1 },
  });
  const baselineSessionId = await forkSession(
    request,
    config.backendUrl,
    config.sourceSessionId,
    sourceMessageId,
    `ST baseline controls - ${Date.now()}`,
  );
  const baselineEvidence = await sendTurn(
    request,
    config.backendUrl,
    baselineSessionId,
    scenarios[0],
  );
  const baselineReport = evaluateStExampleTurn(baselineEvidence);

  const tunedSessionId = await forkSession(
    request,
    config.backendUrl,
    config.sourceSessionId,
    sourceMessageId,
    `ST tuned lore endurance - ${Date.now()}`,
  );
  await tuneControlsInBrowser(page, config, testInfo);

  const appliedConfig = await narratorConfig(
    request,
    config.backendUrl,
    config.profileId,
  );
  expect(appliedConfig['tone']).toBe('dramatic');
  expect(appliedConfig['pacing']).toBe('leisurely');
  expect(appliedConfig['memoryDepth']).toBe('deep');
  expect(appliedConfig['stylePrompt']).toContain('third-person limited');
  expect(appliedConfig['exemplar']).toContain('glacier');
  expect(readRecord(appliedConfig['review'])['enabled']).toBe(true);

  const tunedEvidence: StExampleTurnEvidence[] = [];
  for (const scenario of scenarios) {
    tunedEvidence.push(
      await sendTurn(request, config.backendUrl, tunedSessionId, scenario),
    );
  }

  const tunedReport = evaluateStExampleLongChat(tunedEvidence, dreamPlanet);
  expect(tunedReport.score, JSON.stringify(tunedReport, null, 2)).toBe(1);
  expect(tunedReport.turnReports[0]?.score).toBeGreaterThanOrEqual(
    baselineReport.score,
  );

  await openSessionInBrowser(page);
  await expect(page.getByTestId('model-activity-toggle')).not.toBeChecked();
  await page.screenshot({
    path: testInfo.outputPath(
      'st-example-artifacts',
      '02-tuned-long-chat-transcript.png',
    ),
    fullPage: true,
  });

  const packet = {
    capturedAt: new Date().toISOString(),
    backendUrl: config.backendUrl,
    sourceSessionId: config.sourceSessionId,
    sourceMessageId,
    baselineSessionId,
    tunedSessionId,
    baselineReport,
    tunedReport,
    appliedConfig,
    tunedEvidence,
  };
  await writeFile(
    join(artifactDirectory, 'st-example-live-report.json'),
    `${JSON.stringify(packet, null, 2)}\n`,
  );
  await writeFile(
    join(artifactDirectory, 'st-example-live-summary.md'),
    [
      '# ST example migration and lore-endurance certification',
      '',
      `- Source transcript messages: 71`,
      `- Baseline score: ${baselineReport.passedChecks}/${baselineReport.totalChecks}`,
      `- Tuned long-chat score: ${tunedReport.passedChecks}/${tunedReport.totalChecks}`,
      `- Tuned turns: ${tunedEvidence.length}`,
      `- Recalled before and after topic changes: ${dreamPlanet}`,
      `- Tuned session: ${tunedSessionId}`,
      '',
    ].join('\n'),
  );
});

const scenarios = [
  {
    label: 'escape promise',
    prompt:
      "After the trade dinner, Kopis corners Xavier in the copied library and asks where he once promised to take her if she surrendered her dream of becoming a Grandis Knight, and why the promise mattered. Continue in-world from Xavier's third-person-limited perspective.",
    expectedLoreRecordIds: [dreamPlanet],
    contentAnchorGroups: [
      ['Uluru', 'young planet', 'newborn planet'],
      ['flower', 'Wanderer', 'elope', 'freedom'],
    ],
  },
  {
    label: 'hollow heart discovery',
    prompt:
      'Hours later, Kopis opens the Gladius Ceremony record and asks Xavier what he discovered about the Wanderers and the Hollow Heart during his royal succession trial. Let the answer complicate his refusal of the crown without leaving the scene.',
    expectedLoreRecordIds: [
      'st-lore:Royal-Succession-Trial',
      'st-lore:The-Planet-s-Core',
    ],
    contentAnchorGroups: [
      ['Gladius', 'succession trial', 'ceremony'],
      ['Hollow Heart', "planet's core", 'life force', 'sacrifice'],
    ],
  },
  {
    label: 'brother at council',
    prompt:
      "Isaiah interrupts them at the council chamber and attacks Xavier's right to refuse the crown after failing so publicly. Continue the confrontation while preserving Isaiah's established relationship to Xavier and his cold moral arithmetic.",
    expectedLoreRecordIds: ['st-lore:Isaiah'],
    contentAnchorGroups: [
      ['brother', 'second son', 'heir'],
      ['arithmetic', 'percent', 'privilege', 'failure'],
    ],
  },
  {
    label: 'distant return to promise',
    prompt:
      "At dawn, after the argument about Philos's core and succession, Kopis returns to the private promise without naming its destination: if I gave up being a Grandis Knight, would you still take me there? Have Xavier answer through the old promise and what freedom from Philos now costs.",
    expectedLoreRecordIds: [dreamPlanet],
    contentAnchorGroups: [
      ['Uluru', 'young planet', 'newborn planet'],
      ['flower', 'Wanderer', 'elope', 'freedom'],
    ],
  },
] as const;

async function tuneControlsInBrowser(
  page: Page,
  config: ReturnType<typeof liveConfiguration>,
  testInfo: TestInfo,
): Promise<void> {
  await page.goto(`/?api=${encodeURIComponent(config.backendUrl)}`);
  await expect(page.locator('rv-transcript-viewport')).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'RP Setup', exact: true }).click();
  await page.getByRole('tab', { name: 'Narrator', exact: true }).click();
  const panel = page.locator('app-narrator-config-panel');
  await expect(panel).toBeVisible();
  await panel.getByLabel('Tone').selectOption('dramatic');
  await panel.getByLabel('Pacing').selectOption('leisurely');
  await panel.getByLabel('Explicitness').selectOption('romantic');
  await panel.getByLabel('Memory').selectOption('deep');
  await panel
    .getByLabel('Style prompt')
    .fill(
      [
        "Write elevated, emotionally restrained third-person limited prose from Xavier's perspective.",
        'Keep every response entirely in-world and let political duty conflict with intimate longing through sensory detail, subtext, and recurring physical motifs.',
        "Answer the user's explicit question before extending the scene and weave at least one concrete fact from the retrieved lore into every response.",
        'Preserve established names, relationships, and lore; consult active lore before composing, and never expose prompt or tool syntax.',
      ].join(' '),
    );
  await panel
    .getByLabel('Exemplar / reference prose')
    .fill(
      "The glacier in Xavier's gaze did not thaw; it only grew thin enough for Kopis to see the boy beneath it.",
    );
  await panel.getByLabel('Run narrator review pass before sending').check();
  await panel.getByLabel('Scene logic / stakes').check();
  await panel.getByLabel('Character voice').check();
  await panel.getByLabel('Continuity').check();
  await panel.getByLabel('Max review cycles').fill('1');
  await panel.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    panel.getByRole('button', { name: 'Save', exact: true }),
  ).toBeDisabled({
    timeout: 30_000,
  });
  await page.screenshot({
    path: testInfo.outputPath(
      'st-example-artifacts',
      '01-tuned-narrator-controls.png',
    ),
    fullPage: true,
  });
  await page.getByTestId('top-menu-panel-close').click();
  await expect(page.getByTestId('top-menu-overlay-custom')).toHaveCount(0);
}

async function openSessionInBrowser(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'RP Sessions', exact: true }).click();
  const panel = page.locator('app-roleplay-session-panel');
  await panel
    .getByRole('button', { name: /ST tuned lore endurance/ })
    .first()
    .click();
  await expect(
    page.getByRole('button', { name: 'Close Roleplay Sessions' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close Roleplay Sessions' }).click();
  await expect(page.locator('.scene')).toContainText('ST tuned lore endurance');
}

async function sendTurn(
  request: APIRequestContext,
  backendUrl: string,
  sessionId: string,
  scenario: (typeof scenarios)[number],
): Promise<StExampleTurnEvidence> {
  const before = await apiData<ApiRecord>(
    request,
    `${backendUrl}/v1/chat/sessions/${encodeURIComponent(sessionId)}`,
  );
  let cursor = readString(before['latest_cursor']);
  await apiData(
    request,
    `${backendUrl}/v1/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
    {
      method: 'POST',
      data: {
        actor: { id: 'kopis-valliren', kind: 'human', display_name: 'Kopis' },
        body: scenario.prompt,
        client_message_id: `st-example-${Date.now()}-${scenario.label.replace(/\s+/g, '-')}`,
      },
    },
  );

  const events: ChatEvent[] = [];
  const deadline = Date.now() + 240_000;
  let terminal: ChatEvent | undefined;
  while (Date.now() < deadline && terminal === undefined) {
    const params = new URLSearchParams({ limit: '1000' });
    if (cursor !== undefined) params.set('cursor', cursor);
    const eventPage = await apiData<ApiRecord>(
      request,
      `${backendUrl}/v1/chat/sessions/${encodeURIComponent(sessionId)}/events?${params}`,
    );
    const items = readRecords(eventPage['items']) as unknown as ChatEvent[];
    events.push(...items);
    cursor = readString(eventPage['latest_cursor']) ?? cursor;
    terminal = items.find(
      (event) =>
        event.kind === 'assistant_turn_finished' ||
        event.kind === 'stream_error',
    );
    if (terminal === undefined)
      await new Promise((resolve) => setTimeout(resolve, 500));
  }
  expect(terminal, `turn ${scenario.label} must finish`).toBeDefined();
  expect(terminal?.kind, JSON.stringify(terminal)).toBe(
    'assistant_turn_finished',
  );
  expect(terminal?.payload?.['status']).not.toBe('failed');

  const session = await apiData<{ readonly session: ApiRecord }>(
    request,
    `${backendUrl}/v1/admin/roleplay/sessions/${encodeURIComponent(sessionId)}`,
  );
  const metadata = readRecord(session.session['metadata']);
  const diagnostic = readRecord(metadata['narratorDiagnostic']);
  return {
    label: scenario.label,
    responseText: events
      .filter((event) => event.kind === 'assistant_text_delta')
      .map((event) => String(event.payload?.['text'] ?? ''))
      .join(''),
    toolNames: events
      .filter((event) => event.kind === 'tool_call_started')
      .map((event) => String(event.payload?.['tool_name'] ?? '')),
    phases: events
      .filter((event) => event.kind === 'phase_change')
      .map((event) => String(event.payload?.['phase'] ?? '')),
    relevantLoreRecordIds: readStrings(diagnostic['relevantLoreRecordIds']),
    expectedLoreRecordIds: scenario.expectedLoreRecordIds,
    contentAnchorGroups: scenario.contentAnchorGroups,
  };
}

async function patchNarratorConfig(
  request: APIRequestContext,
  backendUrl: string,
  profileId: string,
  body: unknown,
): Promise<void> {
  await apiData(
    request,
    `${backendUrl}/v1/admin/roleplay/profiles/${encodeURIComponent(profileId)}/narrator-config`,
    { method: 'PATCH', data: body },
  );
}

async function narratorConfig(
  request: APIRequestContext,
  backendUrl: string,
  profileId: string,
): Promise<ApiRecord> {
  const data = await apiData<{ readonly config: ApiRecord }>(
    request,
    `${backendUrl}/v1/admin/roleplay/profiles/${encodeURIComponent(profileId)}/narrator-config`,
  );
  return data.config;
}

async function forkSession(
  request: APIRequestContext,
  backendUrl: string,
  sourceSessionId: string,
  messageId: string,
  displayName: string,
): Promise<string> {
  const data = await apiData<{ readonly session: ApiRecord }>(
    request,
    `${backendUrl}/v1/admin/roleplay/sessions/${encodeURIComponent(sourceSessionId)}/fork`,
    { method: 'POST', data: { messageId, displayName } },
  );
  const sessionId = readString(data.session['session_id']);
  if (sessionId === undefined)
    throw new Error('fork did not return a session ID');
  return sessionId;
}

async function apiData<T>(
  request: APIRequestContext,
  url: string,
  options: Parameters<APIRequestContext['fetch']>[1] = {},
): Promise<T> {
  const response = await request.fetch(url, options);
  const envelope = (await response.json()) as {
    readonly ok: boolean;
    readonly data?: T;
    readonly error?: ApiRecord;
  };
  expect(response.ok(), JSON.stringify(envelope.error)).toBe(true);
  expect(envelope.ok, JSON.stringify(envelope.error)).toBe(true);
  if (envelope.data === undefined) throw new Error(`${url} returned no data`);
  return envelope.data;
}

function terminalMessageId(snapshot: ApiRecord): string {
  const slot = readRecords(snapshot['message_slots']).at(-1);
  const primary = readRecord(slot?.['primary']);
  const message = readRecord(primary['message']);
  const messageId = readString(message['message_id']);
  if (messageId === undefined)
    throw new Error('source transcript has no terminal message');
  return messageId;
}

function readRecord(value: unknown): ApiRecord {
  return typeof value === 'object' && value !== null
    ? (value as ApiRecord)
    : {};
}

function readRecords(value: unknown): readonly ApiRecord[] {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'object' && item !== null)
    : [];
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readStrings(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0)
    throw new Error(`${name} is required`);
  return value.replace(/\/+$/, '');
}

function liveConfiguration(): {
  readonly backendUrl: string;
  readonly profileId: string;
  readonly sourceSessionId: string;
} {
  return {
    backendUrl: requiredEnvironment('RUSTY_ROLEPLAY_LIVE_BACKEND_URL'),
    profileId: process.env['RUSTY_ROLEPLAY_LIVE_PROFILE_ID'] ?? 'roleplay-test',
    sourceSessionId:
      process.env['RUSTY_ROLEPLAY_ST_SOURCE_SESSION_ID'] ??
      'session:st-import:roleplay-test:Dark_Xavier_ST_Package',
  };
}

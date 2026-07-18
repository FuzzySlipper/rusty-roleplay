import { expect, test, type Page, type Route } from '@playwright/test';

const SESSION_ID = 'boundary-roleplay-session';
const PROFILE_ID = 'sister-a';

const SESSION = {
  session_id: SESSION_ID,
  agent_id: PROFILE_ID,
  profile_id: PROFILE_ID,
  kind: 'full',
  status: 'idle',
  title: 'Northmarch Road',
  latest_cursor: `${SESSION_ID}:11`,
  created_at: '2026-07-10T00:00:00Z',
  updated_at: '2026-07-10T00:01:00Z',
  message_count: 3,
  tool_event_count: 1,
};

const EVENTS = [
  event(1, 'assistant_turn_started', {}),
  event(2, 'assistant_text_delta', {
    message_id: 'boundary-assistant-1',
    delta: 'The northern road is quiet but for the wind across the milestones.',
  }),
  event(3, 'assistant_message_completed', {
    message_id: 'boundary-assistant-1',
    status: 'completed',
  }),
  event(4, 'message_created', {
    message_id: 'boundary-user-1',
    role: 'user',
    body: 'I check the milestone for recent tracks.',
  }),
  event(5, 'assistant_turn_started', {}),
  event(6, 'assistant_reasoning_delta', {
    wake_id: 'boundary-wake-2',
    text: 'I should inspect the tracks before answering.',
    visibility: 'reasoning',
  }),
  event(7, 'tool_call_started', {
    tool_call_id: 'boundary-tool-1',
    tool_name: 'inspect_tracks',
    summary: 'Inspecting the milestone tracks',
    status: 'started',
  }),
  event(8, 'tool_call_completed', {
    tool_call_id: 'boundary-tool-1',
    tool_name: 'inspect_tracks',
    summary: 'Found boot prints toward the hall',
    status: 'completed',
  }),
  event(9, 'assistant_text_delta', {
    wake_id: 'boundary-wake-2',
    text: 'Boot prints lead toward the baron’s hall.',
  }),
  event(10, 'assistant_message_completed', {
    wake_id: 'boundary-wake-2',
    body: 'Boot prints lead toward the baron’s hall.',
    status: 'completed',
  }),
  event(11, 'phase_change', { phase: 'idle' }),
];

test('direct startup → transcript rows, decorator, and RP extensions', async ({
  page,
}) => {
  const registryRequested = deferred();
  const releaseRegistry = deferred();
  await installBackendFixture(page, registryRequested, releaseRegistry);

  await page.goto('/');
  await registryRequested.promise;

  await expect(
    page.getByRole('heading', { name: 'rusty-roleplay' }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Opening roleplay…');
  await expect(page.getByRole('button', { name: 'Sister A' })).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Choose a profile' }),
  ).toHaveCount(0);

  releaseRegistry.resolve();

  await expect(page.locator('rv-transcript-viewport')).toBeVisible();
  await expect(page.locator('rv-message-input')).toBeVisible();
  await expect(page.locator('.rv-transcript__item')).toHaveCount(3);
  await expect(
    page.getByText('The northern road is quiet', { exact: false }),
  ).toBeVisible();
  await expect(page.locator('.rv-message__prefix').first()).toContainText('📖');

  const modelActivityToggle = page.getByTestId('model-activity-toggle');
  await expect(modelActivityToggle).not.toBeChecked();
  await expect(page.getByTestId('reasoning-block')).toHaveCount(0);
  await expect(page.getByTestId('tool-call-block')).toHaveCount(0);

  await modelActivityToggle.check();
  await expect(page.getByTestId('reasoning-block')).toHaveCount(1);
  await expect(page.getByTestId('tool-call-block')).toHaveCount(1);
  await expect(page.getByTestId('tool-call-block')).toContainText(
    'inspect_tracks',
  );

  await modelActivityToggle.uncheck();
  await expect(page.getByTestId('reasoning-block')).toHaveCount(0);
  await expect(page.getByTestId('tool-call-block')).toHaveCount(0);

  await expect(page.getByRole('button', { name: 'RP Sessions' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'RP Setup' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lore' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mechanic' })).toBeVisible();
  await expect(
    page
      .getByTestId('top-menu')
      .getByRole('button', { name: 'Prompt', exact: true }),
  ).toHaveCount(0);

  await page.getByRole('button', { name: 'Debug', exact: true }).click();
  const debugDialog = page.getByRole('dialog', { name: 'Debug' });
  await debugDialog
    .getByRole('button', { name: 'Prompt', exact: true })
    .click();
  await expect(
    debugDialog.getByRole('heading', { name: 'Prompt Stack' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(debugDialog).toBeHidden();

  await page.getByRole('button', { name: 'RP Setup' }).click();
  await expect(page.getByRole('tab', { name: 'Personas' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Characters' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'ST Import' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Narrator' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Text Style' })).toBeVisible();
});

test('direct startup refuses to treat a mechanic profile as the narrator', async ({
  page,
}) => {
  await page.route('**/v1/admin/profiles/registry', (route) =>
    fulfillJson(route, {
      items: [
        {
          profileId: 'mechanic-only',
          displayName: 'Mechanic Only',
          lifecycleStatus: 'active',
          localToolProfileId: 'basic_chat',
        },
      ],
    }),
  );

  await page.goto('/');

  await expect(page.getByRole('alert')).toHaveText(
    'No Roleplay narrator profile is configured in Rusty Crew.',
  );
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Choose a profile' }),
  ).toHaveCount(0);
  await expect(page.locator('rv-transcript-viewport')).toHaveCount(0);
});

async function installBackendFixture(
  page: Page,
  registryRequested: Deferred,
  releaseRegistry: Deferred,
): Promise<void> {
  await page.route('**/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === '/v1/admin/profiles/registry') {
      registryRequested.resolve();
      await releaseRegistry.promise;
      return fulfillJson(route, {
        items: [
          {
            profileId: PROFILE_ID,
            displayName: 'Sister A',
            lifecycleStatus: 'active',
            localToolProfileId: 'roleplay_lore',
          },
        ],
      });
    }
    if (path === '/v1/chat/commands') {
      return fulfillJson(route, { commands: [] });
    }
    if (path === '/v1/chat/sessions') {
      return fulfillJson(route, {
        items: [SESSION],
        total: 1,
        limit: 100,
        offset: 0,
      });
    }
    if (path === `/v1/chat/sessions/${SESSION_ID}/stream`) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: ': connected\n\n',
      });
    }
    if (path === `/v1/chat/sessions/${SESSION_ID}/events`) {
      return fulfillJson(route, { items: [] });
    }
    if (path === `/v1/chat/sessions/${SESSION_ID}`) {
      return fulfillJson(route, { session: SESSION, events: EVENTS });
    }
    if (path === '/v1/admin/roleplay/sessions') {
      return fulfillJson(route, {
        items: [
          {
            ...SESSION,
            display_name: 'Northmarch Road',
            character_id: 'narrator',
            character_name: 'Narrator',
            active_layer_ids: [],
            active_layer_count: 0,
            archived: false,
          },
        ],
      });
    }
    if (path.endsWith('/characters') || path.endsWith('/personas')) {
      return fulfillJson(route, { items: [] });
    }
    if (path === '/v1/admin/roleplay/lore/layers') {
      return fulfillJson(route, { layers: [] });
    }
    if (path.endsWith('/layers')) {
      return fulfillJson(route, { layers: [] });
    }
    if (path.includes('/lore/entries/search')) {
      return fulfillJson(route, { entries: [] });
    }
    if (path.endsWith('/alternatives')) {
      return fulfillJson(route, { alternatives: [] });
    }
    return fulfillJson(route, {
      items: [],
      sessions: [],
      proposals: [],
      diagnostics: [],
      layers: [],
      entries: [],
    });
  });
}

function event(
  sequenceId: number,
  kind: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return {
    event_id: `${SESSION_ID}:${sequenceId}`,
    session_id: SESSION_ID,
    sequence_id: sequenceId,
    created_at: `2026-07-10T00:00:${String(sequenceId).padStart(2, '0')}Z`,
    kind,
    payload,
  };
}

function fulfillJson(route: Route, data: unknown): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      data,
      meta: { request_id: 'task-5550', schema_version: 1 },
    }),
  });
}

interface Deferred {
  readonly promise: Promise<void>;
  resolve(): void;
}

function deferred(): Deferred {
  let resolvePromise: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: resolvePromise,
  };
}

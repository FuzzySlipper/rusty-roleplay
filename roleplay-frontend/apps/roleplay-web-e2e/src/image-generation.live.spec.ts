import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

interface PresetEnvelope {
  readonly data?: {
    readonly presets?: readonly {
      readonly id?: string;
    }[];
  };
}

interface AttachmentEnvelope {
  readonly data?: {
    readonly items?: readonly AttachmentRecord[];
  };
}

interface AttachmentRecord {
  readonly mime_type?: string;
  readonly metadata_json?: {
    readonly provenance?: {
      readonly workflow_preset_id?: string;
    };
  };
}

// eslint-disable-next-line playwright/no-skipped-test -- opt-in real ComfyUI deployment
test.skip(
  process.env['RUSTY_ROLEPLAY_IMAGE_LIVE_RUN'] !== '1',
  'requires an explicitly configured Rusty Roleplay, Crew, View, and ComfyUI deployment',
);

test('operator and narrator image generation remain inline, durable, and flow-safe @live-image-generation', async ({
  page,
  request,
}) => {
  test.setTimeout(900_000);

  const backendUrl = requiredEnvironment(
    'RUSTY_ROLEPLAY_LIVE_BACKEND_URL',
  ).replace(/\/+$/, '');
  const sessionId = requiredEnvironment('RUSTY_ROLEPLAY_LIVE_SESSION_ID');
  const presetsResponse = await request.get(
    `${backendUrl}/v1/admin/image-generation/presets`,
  );
  expect(
    presetsResponse.ok(),
    'Crew must expose the image-generation operator routes',
  ).toBe(true);
  const presetEnvelope = (await presetsResponse.json()) as PresetEnvelope;
  const presetId = presetEnvelope.data?.presets?.[0]?.id;
  expect(
    presetId,
    'Crew must have at least one approved ComfyUI preset',
  ).toBeTruthy();

  await page.addInitScript(() => {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('rusty-roleplay:image-generation:')) {
        localStorage.removeItem(key);
      }
    }
  });
  await page.goto(`/?api=${encodeURIComponent(backendUrl)}`);
  await expect(page.locator('rv-transcript-viewport')).toBeVisible({
    timeout: 30_000,
  });

  const initialImages = await generatedImages(request, backendUrl, sessionId);
  const modelActivityToggle = page.getByTestId('model-activity-toggle');
  await modelActivityToggle.setChecked(false);

  await openImagesPanel(page);
  const contextToggle = page.getByRole('checkbox', {
    name: 'Mark this image for compatible multimodal narrators',
  });
  await expect(contextToggle).not.toBeChecked();
  await page
    .getByLabel('Optional subject or direction')
    .fill(`Live roleplay image certification ${Date.now()}`);
  await page.getByRole('button', { name: 'Rebuild from roleplay' }).click();
  await page.getByRole('button', { name: 'Generate image' }).click();
  await expect(
    page.getByText(
      'Image completed, linked to the transcript, and saved in Gallery.',
    ),
  ).toBeVisible({ timeout: 600_000 });
  await expect
    .poll(
      async () =>
        (await generatedImages(request, backendUrl, sessionId)).length,
      { timeout: 60_000 },
    )
    .toBeGreaterThan(initialImages.length);
  await expect(page.locator('.gallery-grid img').last()).toBeVisible();

  await page.getByRole('button', { name: 'Close RP Setup' }).click();
  const inlineImagesAfterOperator = page.locator(
    'rv-transcript-viewport .rv-attachment[data-kind="image"] img',
  );
  await expect(inlineImagesAfterOperator.last()).toBeVisible({
    timeout: 60_000,
  });
  await expect(modelActivityToggle).not.toBeChecked();
  await expectNoOuterScrollbar(page);

  const narratorMarker = `ROLEPLAY_IMAGE_TOOL_${Date.now()}`;
  await page
    .locator('textarea')
    .fill(
      [
        `${narratorMarker}: use image_generate exactly once with preset ${presetId}.`,
        'Illustrate the current scene, then briefly acknowledge the completed image.',
      ].join(' '),
    );
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const userMessage = page
    .locator('[data-testid="message-row"][data-message-role="user"]')
    .filter({ hasText: narratorMarker });
  await expect(userMessage).toBeVisible({ timeout: 30_000 });
  const assistant = userMessage.locator(
    'xpath=following::div[@data-testid="message-row" and @data-message-role="assistant"][1]',
  );
  await expect(assistant).toHaveAttribute('data-message-status', 'completed', {
    timeout: 600_000,
  });
  await modelActivityToggle.check();
  const narratorImageTool = assistant
    .locator('[data-testid="tool-call-block"][data-status="completed"]')
    .filter({ hasText: 'image_generate' });
  await expect(narratorImageTool).toBeVisible();
  await modelActivityToggle.uncheck();
  await expect(narratorImageTool).toBeHidden();
  await expect(
    assistant.locator('.rv-attachment[data-kind="image"] img'),
  ).toBeVisible();

  const finalImages = await generatedImages(request, backendUrl, sessionId);
  expect(finalImages.length).toBeGreaterThan(initialImages.length + 1);
  await page.reload();
  await expect(page.locator('rv-transcript-viewport')).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.locator('.rv-attachment[data-kind="image"] img').last(),
  ).toBeVisible({ timeout: 60_000 });

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoOuterScrollbar(page);
  const inlineImage = page
    .locator('.rv-attachment[data-kind="image"] img')
    .last();
  const imageBounds = await inlineImage.boundingBox();
  expect(imageBounds).not.toBeNull();
  expect(imageBounds?.x ?? 0).toBeGreaterThanOrEqual(0);
  expect((imageBounds?.x ?? 0) + (imageBounds?.width ?? 0)).toBeLessThanOrEqual(
    390,
  );
});

async function openImagesPanel(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'RP Setup', exact: true }).click();
  await page.getByRole('tab', { name: 'Images', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Images' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Generate image' }),
  ).toBeVisible({ timeout: 30_000 });
}

async function generatedImages(
  request: APIRequestContext,
  backendUrl: string,
  sessionId: string,
): Promise<readonly AttachmentRecord[]> {
  const response = await request.get(
    `${backendUrl}/v1/chat/sessions/${encodeURIComponent(
      sessionId,
    )}/attachments?include_removed=false&limit=100&offset=0`,
  );
  expect(response.ok()).toBe(true);
  const envelope = (await response.json()) as AttachmentEnvelope;
  return (envelope.data?.items ?? []).filter(
    (item) =>
      item.mime_type?.startsWith('image/') === true &&
      typeof item.metadata_json?.provenance?.workflow_preset_id === 'string',
  );
}

async function expectNoOuterScrollbar(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollHeight <=
          document.documentElement.clientHeight + 1,
      ),
    )
    .toBe(true);
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required for live image-generation proof`);
  }
  return value;
}

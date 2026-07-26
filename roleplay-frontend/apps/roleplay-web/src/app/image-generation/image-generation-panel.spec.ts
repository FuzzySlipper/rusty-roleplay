import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { ChatMessage } from '@rusty-view/chat-domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoleplayWorkbench } from '../roleplay-workbench';
import { ImageGenerationApi } from './image-generation-api';
import type {
  GeneratedImage,
  ImageGenerationPresetSummary,
} from './image-generation.model';
import { ImageGenerationPanelComponent } from './image-generation-panel';

describe('ImageGenerationPanelComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('builds a character prompt and generates against the active session', async () => {
    const harness = await render([]);
    const host = harness.fixture.nativeElement as HTMLElement;

    findButton(host, 'Character').click();
    findButton(host, 'Rebuild from roleplay').click();
    harness.fixture.detectChanges();

    const prompt = host.querySelector(
      'textarea[rows="12"]',
    ) as HTMLTextAreaElement;
    expect(prompt.value).toContain('Prince Xavier');
    expect(prompt.value).toContain('Clockwork observatory');

    const form = host.querySelector('form');
    if (!(form instanceof HTMLFormElement)) {
      throw new Error('Expected image generation form.');
    }
    form.dispatchEvent(new Event('submit'));

    await vi.waitFor(() => {
      expect(harness.api.generate).toHaveBeenCalledOnce();
    });
    expect(harness.api.generate.mock.calls[0]?.[0]).toMatchObject({
      sessionId: 'session-1',
      preset: 'scene-v1',
      mode: 'character',
      includeInNarratorContext: false,
      anchorMessageId: 'assistant-1',
    });
    await vi.waitFor(() => {
      expect(harness.selectSession).toHaveBeenCalledWith('session-1');
    });
  });

  it('reloads a durable gallery and regenerates with a fresh seed', async () => {
    const image = generatedImage();
    const harness = await render([image]);
    const host = harness.fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('1 generated images');
    findButton(host, 'Regenerate with new seed').click();

    await vi.waitFor(() => {
      expect(harness.api.generate).toHaveBeenCalledOnce();
    });
    const request = harness.api.generate.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      prompt: 'Moonlit observatory',
      preset: 'scene-v1',
      width: 1216,
      height: 832,
      steps: 24,
    });
    expect(request).not.toHaveProperty('seed');
  });
});

async function render(gallery: readonly GeneratedImage[]): Promise<{
  readonly fixture: ComponentFixture<ImageGenerationPanelComponent>;
  readonly api: {
    readonly listPresets: ReturnType<typeof vi.fn>;
    readonly listGallery: ReturnType<typeof vi.fn>;
    readonly generate: ReturnType<typeof vi.fn>;
  };
  readonly selectSession: ReturnType<typeof vi.fn>;
}> {
  const selectSession = vi.fn().mockResolvedValue(undefined);
  const api = {
    listPresets: vi.fn().mockResolvedValue([preset()]),
    listGallery: vi.fn().mockResolvedValue(gallery),
    generate: vi.fn().mockResolvedValue([]),
  };
  const workbench = {
    activeProfile: signal({ id: 'profile-1', name: 'Narrator' }),
    activeCharacterId: signal('xavier'),
    activePlayerPersonaId: signal(undefined),
    characters: signal([
      {
        id: 'xavier',
        name: 'Prince Xavier',
        description: 'Silver-haired swordsman',
        personality: 'Guarded',
        scenario: 'Clockwork observatory',
        firstMessage: '',
        alternateGreetings: [],
        exampleMessages: [],
        tags: [],
        avatarUrl: undefined,
        status: 'active',
        createdAt: undefined,
        updatedAt: undefined,
      },
    ]),
    playerPersonas: signal([]),
    lore: signal([]),
    sceneLabel: signal('Clockwork observatory'),
    mood: signal('tense'),
    chatStore: {
      activeSessionId: signal('session-1'),
      messages: signal([message()]),
      selectSession,
    },
  };
  await TestBed.configureTestingModule({
    imports: [ImageGenerationPanelComponent],
    providers: [
      { provide: ImageGenerationApi, useValue: api },
      { provide: RoleplayWorkbench, useValue: workbench },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ImageGenerationPanelComponent);
  fixture.detectChanges();
  await vi.waitFor(() => {
    expect(api.listPresets).toHaveBeenCalledOnce();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Generate image');
  });
  return { fixture, api, selectSession };
}

function preset(): ImageGenerationPresetSummary {
  return {
    id: 'scene-v1',
    version: '1.0.0',
    providerId: 'comfy-local',
    defaults: {
      negativePrompt: undefined,
      width: 1024,
      height: 1024,
      steps: 24,
    },
    limits: {
      minWidth: 512,
      maxWidth: 1536,
      minHeight: 512,
      maxHeight: 1536,
      minSteps: 1,
      maxSteps: 50,
      maxPromptChars: 8000,
      maxOutputs: 1,
    },
    styles: ['cinematic'],
  };
}

function message(): ChatMessage {
  return {
    id: 'assistant-1',
    sessionId: 'session-1',
    author: { role: 'assistant', displayName: 'Narrator' },
    createdAt: '2026-07-26T00:00:00Z',
    status: 'completed',
    blocks: [
      {
        id: 'assistant-1-text',
        messageId: 'assistant-1',
        kind: 'text',
        content: 'The clockwork telescope turns toward the moon.',
        estimatedHeight: undefined,
        renderPolicy: 'full',
      },
    ],
  };
}

function generatedImage(): GeneratedImage {
  return {
    id: 'attachment-1',
    sessionId: 'session-1',
    filename: 'image.png',
    mimeType: 'image/png',
    byteSize: 128,
    url: 'http://crew.test/image.png',
    thumbnailUrl: undefined,
    createdAt: '2026-07-26T00:00:00Z',
    width: 1216,
    height: 832,
    mode: 'scene',
    includeInNarratorContext: false,
    linkedMessageId: 'assistant-1',
    provenance: {
      adapter: 'comfyui',
      providerId: 'comfy-local',
      providerJobId: 'job-1',
      presetId: 'scene-v1',
      presetVersion: '1.0.0',
      prompt: 'Moonlit observatory',
      negativePrompt: 'watermark',
      seed: 42,
      width: 1216,
      height: 832,
      steps: 24,
      style: 'cinematic',
    },
  };
}

function findButton(host: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll('button')).find((candidate) =>
    candidate.textContent?.trim().startsWith(label),
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button ${label} was not found.`);
  }
  return button;
}

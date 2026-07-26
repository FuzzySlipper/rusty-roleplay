import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BACKEND_CONFIG } from '../backend-config';
import {
  ImageGenerationApi,
  mapGeneratedImage,
  mapPreset,
} from './image-generation-api';

describe('ImageGenerationApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('maps the redacted preset catalog', () => {
    expect(mapPreset(presetRecord())).toMatchObject({
      id: 'scene-v1',
      version: '1.0.0',
      providerId: 'comfy-local',
      defaults: { width: 1024, height: 1024, steps: 24 },
      styles: ['cinematic'],
    });
  });

  it('generates, preserves provenance, and links the image to the terminal message', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          data: {
            session_id: 'session-1',
            attachments: [
              {
                attachmentId: 'attachment-1',
                filename: 'image-generate-1.png',
                mimeType: 'image/png',
                byteSize: 128,
                downloadUrl:
                  '/v1/chat/sessions/session-1/attachments/attachment-1/content',
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          data: { items: [attachmentRecord([])], total: 1 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          data: {
            status: 'linked',
            attachment: attachmentRecord([
              {
                link_id: 'link-1',
                attachment_id: 'attachment-1',
                session_id: 'session-1',
                message_id: 'assistant-1',
                block_id: 'assistant-1-attachment-attachment-1',
                scope_id: null,
                metadata_json: {
                  source: 'roleplay_image_generation',
                  mode: 'scene',
                  include_in_narrator_context: false,
                },
                created_at: '2026-07-26T00:00:01Z',
              },
            ]),
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const api = createApi();

    const images = await api.generate({
      sessionId: 'session-1',
      preset: 'scene-v1',
      prompt: 'Moonlit observatory',
      negativePrompt: 'watermark',
      width: 1216,
      height: 832,
      steps: 24,
      style: 'cinematic',
      mode: 'scene',
      includeInNarratorContext: false,
      anchorMessageId: 'assistant-1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const generateInit = fetchMock.mock.calls[0]?.[1];
    const generateBody = JSON.parse(String(generateInit?.body)) as Record<
      string,
      unknown
    >;
    expect(generateBody).toEqual({
      session_id: 'session-1',
      preset: 'scene-v1',
      prompt: 'Moonlit observatory',
      negative_prompt: 'watermark',
      width: 1216,
      height: 832,
      steps: 24,
      style: 'cinematic',
    });
    expect(generateBody).not.toHaveProperty('workflow');
    expect(generateBody).not.toHaveProperty('includeInNarratorContext');

    const linkInit = fetchMock.mock.calls[2]?.[1];
    const linkBody = JSON.parse(String(linkInit?.body)) as Record<
      string,
      unknown
    >;
    expect(linkBody).toMatchObject({
      attachment_id: 'attachment-1',
      message_id: 'assistant-1',
      block_id: 'assistant-1-attachment-attachment-1',
      metadata_json: {
        source: 'brain_tool_media',
        tool_name: 'image_generate',
      },
      link_metadata_json: {
        source: 'roleplay_image_generation',
        mode: 'scene',
        include_in_narrator_context: false,
      },
    });

    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      id: 'attachment-1',
      mode: 'scene',
      linkedMessageId: 'assistant-1',
      includeInNarratorContext: false,
      url: 'http://crew.test:9347/v1/chat/sessions/session-1/attachments/attachment-1/content',
      provenance: {
        presetId: 'scene-v1',
        prompt: 'Moonlit observatory',
        seed: 42,
      },
    });
  });

  it('filters generic attachments out of the generated-image gallery', () => {
    expect(
      mapGeneratedImage(
        {
          ...attachmentRecord([]),
          metadata_json: { source: 'upload' },
        },
        'http://crew.test:9347',
      ),
    ).toBeUndefined();
  });
});

function createApi(): ImageGenerationApi {
  TestBed.configureTestingModule({
    providers: [
      ImageGenerationApi,
      {
        provide: BACKEND_CONFIG,
        useValue: {
          rustyCrewBaseUrl: 'http://crew.test:9347',
          lorekeepBaseUrl: 'http://lore.test:8790',
          bearerToken: undefined,
          runtimeProfileId: undefined,
        },
      },
    ],
  });
  return TestBed.inject(ImageGenerationApi);
}

function presetRecord(): Record<string, unknown> {
  return {
    id: 'scene-v1',
    version: '1.0.0',
    provider_id: 'comfy-local',
    defaults: { width: 1024, height: 1024, steps: 24 },
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

function attachmentRecord(
  links: readonly Record<string, unknown>[],
): Record<string, unknown> {
  return {
    attachment_id: 'attachment-1',
    session_id: 'session-1',
    status: 'active',
    filename: 'image-generate-1.png',
    mime_type: 'image/png',
    byte_size: 128,
    storage_url: 'artifact://tool-media/session/image.png',
    download_url:
      '/v1/chat/sessions/session-1/attachments/attachment-1/content',
    thumbnail_url: null,
    extracted_text: null,
    extracted_text_truncated: false,
    metadata_json: {
      source: 'brain_tool_media',
      tool_name: 'image_generate',
      width: 1216,
      height: 832,
      provenance: {
        adapter: 'comfyui',
        provider_id: 'comfy-local',
        provider_job_id: 'job-1',
        workflow_preset_id: 'scene-v1',
        workflow_preset_version: '1.0.0',
        prompt: 'Moonlit observatory',
        negative_prompt: 'watermark',
        seed: 42,
        width: 1216,
        height: 832,
        steps: 24,
        style: 'cinematic',
      },
    },
    created_at: '2026-07-26T00:00:00Z',
    updated_at: '2026-07-26T00:00:01Z',
    expires_at: null,
    links,
  };
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

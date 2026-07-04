import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LORE_LAYER_API_CONFIG,
  LoreLayerApi,
  mapChatLoreLayer,
  mapLoreLayer,
} from './lore-layer-api';

describe('LoreLayerApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps snake_case lore layer records into frontend view models', () => {
    expect(
      mapLoreLayer({
        layer_id: 'world-main',
        profile_id: 'profile-a',
        name: 'World',
        description: 'Shared world.',
        purpose: 'world',
        write_policy: 'manual',
        is_archived: false,
        entry_count: 3,
        created_at: '2026-07-04T00:00:00Z',
        updated_at: '2026-07-04T00:00:01Z',
      }),
    ).toEqual({
      layerId: 'world-main',
      profileId: 'profile-a',
      name: 'World',
      description: 'Shared world.',
      purpose: 'world',
      writePolicy: 'manual',
      archived: false,
      entryCount: 3,
      createdAt: '2026-07-04T00:00:00Z',
      updatedAt: '2026-07-04T00:00:01Z',
    });
  });

  it('maps chat layer priority and enabled state', () => {
    expect(
      mapChatLoreLayer({
        layer_id: 'story',
        profile_id: 'profile-a',
        name: 'Story',
        priority: 2,
        enabled: false,
      }),
    ).toMatchObject({
      layerId: 'story',
      priority: 2,
      enabled: false,
    });
  });

  it('maps nested chat layer detail records from the live API shape', () => {
    expect(
      mapChatLoreLayer({
        chat_id: 'session-a',
        layer_id: 'world-main',
        priority: 0,
        enabled: true,
        created_at: '2026-07-04T00:00:00Z',
        layer: {
          layer_id: 'world-main',
          profile_id: 'profile-a',
          name: 'World Main',
          description: 'Shared setting.',
          purpose: 'world',
          write_policy: 'manual',
          is_archived: false,
          entry_count: 2,
          created_at: '2026-07-03T00:00:00Z',
          updated_at: '2026-07-03T00:00:01Z',
        },
      }),
    ).toEqual({
      layerId: 'world-main',
      profileId: 'profile-a',
      name: 'World Main',
      description: 'Shared setting.',
      purpose: 'world',
      writePolicy: 'manual',
      archived: false,
      entryCount: 2,
      createdAt: '2026-07-03T00:00:00Z',
      updatedAt: '2026-07-03T00:00:01Z',
      enabled: true,
      priority: 0,
    });
  });

  it('calls the profile layer route with auth headers', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        data: {
          layers: [
            {
              layer_id: 'world-main',
              profile_id: 'profile-a',
              name: 'World',
            },
          ],
        },
        meta: { request_id: 'req', schema_version: 1 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = createApi();

    const layers = await api.listProfileLayers('profile-a');

    expect(layers[0]?.layerId).toBe('world-main');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://crew.test/v1/admin/roleplay/lore/layers?profile_id=profile-a',
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer token-a');
  });

  it('throws API error messages from failed envelopes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            ok: false,
            error: { message: 'No layer for you.' },
            meta: { request_id: 'req', schema_version: 1 },
          },
          404,
        ),
      ),
    );
    const api = createApi();

    await expect(api.getChatLayers('session-a')).rejects.toThrow(
      'No layer for you.',
    );
  });
});

function createApi(): LoreLayerApi {
  TestBed.configureTestingModule({
    providers: [
      LoreLayerApi,
      {
        provide: LORE_LAYER_API_CONFIG,
        useValue: { baseUrl: 'http://crew.test', bearerToken: 'token-a' },
      },
    ],
  });
  return TestBed.inject(LoreLayerApi);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

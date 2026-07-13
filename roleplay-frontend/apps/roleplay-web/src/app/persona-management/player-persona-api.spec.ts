import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@rusty-view/transport', () => ({
  ChatTransport: class ChatTransport {},
}));

vi.mock('@rusty-view/chat-store', () => ({
  CHAT_STORAGE_ADAPTER: Symbol('CHAT_STORAGE_ADAPTER'),
  ChatStore: class ChatStore {},
  IndexedDbChatStorage: class IndexedDbChatStorage {},
}));

import { BACKEND_CONFIG } from '../backend-config';
import { mapPlayerPersona, PlayerPersonaApi } from './player-persona-api';

describe('PlayerPersonaApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps persona records from snake_case payloads', () => {
    expect(
      mapPlayerPersona({
        persona_id: 'persona-a',
        profile_id: 'profile-a',
        display_name: 'Jorge',
        avatar_url: 'https://example.test/jorge.png',
        avatar_asset_ref: 'asset-a',
        description: 'A player character',
        notes: 'Private notes',
        tags: ['mage'],
        status: 'active',
        created_at: '2026-07-04T00:00:00Z',
        updated_at: '2026-07-04T00:00:01Z',
      }),
    ).toEqual({
      id: 'persona-a',
      profileId: 'profile-a',
      name: 'Jorge',
      avatarUrl: 'https://example.test/jorge.png',
      avatarAssetRef: 'asset-a',
      description: 'A player character',
      notes: 'Private notes',
      tags: ['mage'],
      status: 'active',
      createdAt: '2026-07-04T00:00:00Z',
      updatedAt: '2026-07-04T00:00:01Z',
    });
  });

  it('creates personas with auth headers', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return jsonResponse({
          ok: true,
          data: {
            persona: {
              persona_id: 'persona-a',
              profile_id: 'profile-a',
              display_name: 'Jorge',
            },
          },
        });
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = createApi();

    const persona = await api.createPersona('profile-a', {
      name: 'Jorge',
      avatarUrl: 'data:image/png;base64,abc',
      description: 'A player character',
      notes: 'Private notes',
      tags: ['mage'],
    });

    expect(persona.id).toBe('persona-a');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://crew.test/v1/admin/roleplay/profiles/profile-a/personas',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Jorge',
          displayName: 'Jorge',
          description: 'A player character',
          notes: 'Private notes',
          tags: ['mage'],
          avatarUrl: 'data:image/png;base64,abc',
        }),
        headers: expect.any(Headers),
      }),
    );
    const call = fetchMock.mock.calls[0] as
      | [RequestInfo | URL, RequestInit]
      | undefined;
    const headers = call?.[1].headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer token-a');
  });
});

function createApi(): PlayerPersonaApi {
  TestBed.configureTestingModule({
    providers: [
      PlayerPersonaApi,
      {
        provide: BACKEND_CONFIG,
        useValue: {
          rustyCrewBaseUrl: 'http://crew.test',
          lorekeepBaseUrl: 'http://lore.test',
          bearerToken: 'token-a',
        },
      },
    ],
  });
  return TestBed.inject(PlayerPersonaApi);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

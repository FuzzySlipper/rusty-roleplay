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
import { mapRoleplaySession, RoleplaySessionApi } from './roleplay-session-api';

describe('RoleplaySessionApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps roleplay session metadata from snake_case records', () => {
    expect(
      mapRoleplaySession({
        session_id: 'session-a',
        profile_id: 'profile-a',
        agent_id: 'agent-a',
        status: 'idle',
        display_name: 'The Gate',
        character_id: 'hero',
        character_name: 'Hero',
        active_layer_ids: ['world'],
        active_layer_count: 1,
        last_message_preview: 'Hello',
        archived: false,
        created_at: '2026-07-04T00:00:00Z',
        updated_at: '2026-07-04T00:00:01Z',
      }),
    ).toEqual({
      sessionId: 'session-a',
      profileId: 'profile-a',
      agentId: 'agent-a',
      status: 'idle',
      displayName: 'The Gate',
      characterId: 'hero',
      characterName: 'Hero',
      activeLayerIds: ['world'],
      activeLayerCount: 1,
      lastMessagePreview: 'Hello',
      archived: false,
      createdAt: '2026-07-04T00:00:00Z',
      updatedAt: '2026-07-04T00:00:01Z',
    });
  });

  it('creates roleplay sessions with RP metadata and auth headers', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return jsonResponse({
          ok: true,
          data: {
            session: {
              session_id: 'session-a',
              profile_id: 'profile-a',
              display_name: 'The Gate',
            },
          },
          meta: { request_id: 'req', schema_version: 1 },
        });
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = createApi();

    const session = await api.createSession('profile-a', {
      displayName: 'The Gate',
      characterId: 'hero',
      activeLayerIds: ['world'],
    });

    expect(session.sessionId).toBe('session-a');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://crew.test/v1/admin/roleplay/sessions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          profileId: 'profile-a',
          displayName: 'The Gate',
          characterId: 'hero',
          activeLayerIds: ['world'],
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

function createApi(): RoleplaySessionApi {
  TestBed.configureTestingModule({
    providers: [
      RoleplaySessionApi,
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
  return TestBed.inject(RoleplaySessionApi);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

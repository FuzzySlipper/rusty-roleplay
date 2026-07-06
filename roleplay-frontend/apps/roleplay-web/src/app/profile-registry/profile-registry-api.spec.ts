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
import { mapProfile, ProfileRegistryApi } from './profile-registry-api';

describe('ProfileRegistryApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps registry records into selectable profiles', () => {
    expect(
      mapProfile({
        profileId: 'rp-narrator',
        displayName: 'RP Narrator',
      }),
    ).toEqual({
      id: 'rp-narrator',
      name: 'RP Narrator',
      hasPassword: false,
    });
  });

  it('loads profiles with auth headers', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        data: {
          items: [{ profileId: 'rp-narrator', displayName: 'RP Narrator' }],
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = createApi();

    const profiles = await api.listProfiles();

    expect(profiles[0]?.id).toBe('rp-narrator');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://crew.test/v1/admin/profiles/registry',
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    const call = fetchMock.mock.calls[0] as
      | [RequestInfo | URL, RequestInit]
      | undefined;
    const headers = call?.[1].headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer token-a');
  });
});

function createApi(): ProfileRegistryApi {
  TestBed.configureTestingModule({
    providers: [
      ProfileRegistryApi,
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
  return TestBed.inject(ProfileRegistryApi);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

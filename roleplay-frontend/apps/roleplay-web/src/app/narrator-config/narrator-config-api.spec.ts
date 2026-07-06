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
import { mapNarratorConfig, NarratorConfigApi } from './narrator-config-api';
import type { NarratorConfig } from './narrator-config.model';

describe('NarratorConfigApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps narrator config from backend records', () => {
    expect(
      mapNarratorConfig({
        tone: 'wry',
        pacing: 'rapid',
        explicitness: 'suggestive',
        memoryDepth: 'deep',
        exemplar: 'Keep the rhythm clipped.',
        review: {
          enabled: true,
          maxReviewCycles: 2,
          checkGravityDrift: false,
          checkCharacterVoice: true,
          checkContinuity: false,
        },
      }),
    ).toEqual({
      tone: 'wry',
      pacing: 'rapid',
      explicitness: 'suggestive',
      memoryDepth: 'deep',
      exemplar: 'Keep the rhythm clipped.',
      review: {
        enabled: true,
        maxReviewCycles: 2,
        checkGravityDrift: false,
        checkCharacterVoice: true,
        checkContinuity: false,
      },
    });
  });

  it('saves narrator config with auth headers', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return jsonResponse({
          ok: true,
          data: { config: savedConfig },
          meta: { request_id: 'req', schema_version: 1 },
        });
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = createApi();

    const config = await api.saveConfig('profile-a', savedConfig);

    expect(config.tone).toBe('wry');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://crew.test/v1/admin/roleplay/profiles/profile-a/narrator-config',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(savedConfig),
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

const savedConfig: NarratorConfig = {
  tone: 'wry',
  pacing: 'balanced',
  explicitness: 'romantic',
  memoryDepth: 'deep',
  exemplar: 'Keep continuity clear.',
  review: {
    enabled: true,
    maxReviewCycles: 2,
    checkGravityDrift: true,
    checkCharacterVoice: true,
    checkContinuity: true,
  },
};

function createApi(): NarratorConfigApi {
  TestBed.configureTestingModule({
    providers: [
      NarratorConfigApi,
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
  return TestBed.inject(NarratorConfigApi);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

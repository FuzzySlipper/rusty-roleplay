import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BACKEND_CONFIG } from '../backend-config';
import { mapAlternateSlot, RoleplayBranchingApi } from './roleplay-branching-api';

describe('roleplay branching API mapping', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('maps terminal alternative slots into rusty-view alternate slots', () => {
    expect(
      mapAlternateSlot({
        slot_id: 'slot-a',
        session_id: 'session-a',
        active_variant_id: 'alt-a',
        primary: {
          variant_id: 'primary-a',
          source: 'primary',
          ordinal: 0,
          message: {
            message_id: 'message-a',
            author_role: 'assistant',
            body: 'Primary',
            created_at: '2026-07-04T00:00:00Z',
          },
        },
        alternates: [
          {
            variant_id: 'alt-a',
            source: 'alternate',
            ordinal: 1,
            message: {
              message_id: 'message-b',
              author_role: 'assistant',
              body: 'Alternate',
              created_at: '2026-07-04T00:00:01Z',
              metadata_json: {
                speaker_identity: {
                  speaker_kind: 'character',
                  display_name: 'Seraphina',
                  avatar_url: 'https://example.test/seraphina.png',
                },
              },
            },
          },
        ],
      }),
    ).toMatchObject({
      id: 'slot-a',
      sessionId: 'session-a',
      activeVariantId: 'alt-a',
      primary: {
        id: 'primary-a',
        message: { id: 'message-a', blocks: [{ content: 'Primary' }] },
      },
      alternates: [
        {
          id: 'alt-a',
          message: {
            id: 'message-b',
            blocks: [{ content: 'Alternate' }],
            metadata: {
              speaker_identity: {
                speaker_kind: 'character',
                display_name: 'Seraphina',
                avatar_url: 'https://example.test/seraphina.png',
              },
            },
          },
        },
      ],
    });
  });

  it('requests generated alternatives from the crew generate route', async () => {
    const fetchMock = vi.fn(
      async () =>
        jsonResponse(
          {
            ok: true,
            data: {
              status: 'generated',
              session_id: 'session-a',
              slot: slotPayload(),
              variant: {},
            },
          },
          201,
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = createApi();

    await api.generateAlternative('session-a', 'slot-a', undefined);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://crew.test/v1/admin/roleplay/sessions/session-a/alternatives/generate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ slotId: 'slot-a' }),
        headers: expect.any(Headers),
      }),
    );
  });

  it('forks sessions through the singular crew fork route', async () => {
    const fetchMock = vi.fn(
      async () =>
        jsonResponse(
          {
            ok: true,
            data: {
              session: {
                session_id: 'session-fork',
                profile_id: 'profile-a',
                display_name: 'Fork from scene',
              },
            },
          },
          201,
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = createApi();

    await api.forkSession('session-a', 'message-a', 'Fork from scene');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://crew.test/v1/admin/roleplay/sessions/session-a/fork',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          messageId: 'message-a',
          displayName: 'Fork from scene',
        }),
        headers: expect.any(Headers),
      }),
    );
  });
});

function createApi(): RoleplayBranchingApi {
  TestBed.configureTestingModule({
    providers: [
      RoleplayBranchingApi,
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
  return TestBed.inject(RoleplayBranchingApi);
}

function slotPayload(): Record<string, unknown> {
  return {
    slot_id: 'slot-a',
    session_id: 'session-a',
    primary: {
      variant_id: 'primary-a',
      source: 'primary',
      ordinal: 0,
      message: {
        message_id: 'message-a',
        author_role: 'assistant',
        body: 'Primary',
        created_at: '2026-07-04T00:00:00Z',
      },
    },
    alternates: [],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

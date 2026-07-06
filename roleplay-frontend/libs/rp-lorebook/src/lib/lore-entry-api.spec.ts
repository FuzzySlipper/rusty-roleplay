import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LORE_ENTRY_API_CONFIG,
  LoreEntryApi,
  mapLoreEntry,
  mapLoreEntryDetail,
} from './lore-entry-api';

describe('LoreEntryApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('maps Crew lore records into frontend lore entries', () => {
    expect(
      mapLoreEntry({
        record_id: 'entry-a',
        title: 'Clockmaker Song',
        body: 'The clockmaker sings three notes at dusk.',
        canon_status: 'canon',
        status: 'active',
        source: 'import',
        durability_rationale: 'Seeded by browser smoke.',
        created_at: '2026-07-05T00:00:00Z',
        revision: 3,
        content: { metadata_json: { tags: ['clockmaker', 'song'] } },
      }),
    ).toEqual({
      recordId: 'entry-a',
      revision: 3,
      layerIds: [],
      sourceLayerId: undefined,
      sourceLayerWritePolicy: undefined,
      slug: 'entry-a',
      title: 'Clockmaker Song',
      summary: 'The clockmaker sings three notes at dusk.',
      body: 'The clockmaker sings three notes at dusk.',
      canonLevel: 'established',
      tags: ['clockmaker', 'song'],
      capturedBy: 'import',
      captureReason: 'Seeded by browser smoke.',
      capturedAt: '2026-07-05T00:00:00Z',
      supersedesRecordId: '',
      supersededByRecordId: '',
    });
  });

  it('maps detail provenance and supersession data', () => {
    expect(
      mapLoreEntryDetail({
        entry: {
          record_id: 'entry-a',
          title: 'Clockmaker Song',
          body: 'A song.',
          revision: 2,
        },
        provenance: [
          {
            actor: 'browser-editor',
            note: 'Manual edit.',
            created_at: '2026-07-05T01:00:00Z',
          },
        ],
        supersession: {
          supersedesRecordId: 'entry-old',
          supersededByRecordId: 'entry-new',
        },
      }),
    ).toMatchObject({
      recordId: 'entry-a',
      revision: 2,
      layerIds: [],
      sourceLayerId: undefined,
      sourceLayerWritePolicy: undefined,
      capturedBy: 'browser-editor',
      captureReason: 'Manual edit.',
      capturedAt: '2026-07-05T01:00:00Z',
      supersedesRecordId: 'entry-old',
      supersededByRecordId: 'entry-new',
    });
  });

  it('calls Crew lore search with scope, paging, and auth headers', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        data: {
          entries: [
            {
              record_id: 'entry-a',
              title: 'Clockmaker Song',
              body: 'A song.',
            },
          ],
          total: 1,
          totalExact: true,
          hasMore: false,
          limit: 10,
          offset: 0,
        },
        meta: { request_id: 'req', schema_version: 1 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = createApi();

    const result = await api.searchEntryPage('clockmaker', {
      profileId: 'profile-a',
      chatId: 'session-a',
      layerIds: ['world-main'],
      limit: 10,
      offset: 0,
    });

    expect(result.entries[0]?.recordId).toBe('entry-a');
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toContain('/v1/admin/roleplay/lore/entries/search?');
    const parsed = new URL(String(url));
    expect(parsed.searchParams.get('q')).toBe('clockmaker');
    expect(parsed.searchParams.get('profile_id')).toBe('profile-a');
    expect(parsed.searchParams.get('chat_id')).toBe('session-a');
    expect(parsed.searchParams.get('layer_id')).toBe('world-main');
    expect(parsed.searchParams.get('limit')).toBe('10');
    expect((init?.headers as Headers).get('authorization')).toBe(
      'Bearer token-a',
    );
  });

  it('reads one Crew lore entry with layer context', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        data: {
          entry: {
            record_id: 'entry-a',
            revision: 1,
            title: 'Clockmaker Song',
            body: 'A song.',
          },
        },
        meta: { request_id: 'req', schema_version: 1 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = createApi();

    const entry = await api.readEntry('entry-a', {
      profileId: 'profile-a',
      chatId: 'session-a',
      layerIds: ['world-main'],
    });

    expect(entry?.title).toBe('Clockmaker Song');
    const [url] = fetchMock.mock.calls[0] ?? [];
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe('/v1/admin/roleplay/lore/entries/entry-a');
    expect(parsed.searchParams.get('profile_id')).toBe('profile-a');
    expect(parsed.searchParams.get('chat_id')).toBe('session-a');
    expect(parsed.searchParams.get('layer_id')).toBe('world-main');
  });

  it('creates a manual Crew lore entry linked to a layer', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        data: {
          entry: {
            record_id: 'entry-a',
            revision: 1,
            title: 'Clockmaker Song',
            body: 'A song.',
          },
        },
        meta: { request_id: 'req', schema_version: 1 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = createApi();

    await api.createEntry({
      layerId: 'world-main',
      worldId: 'profile-a',
      title: 'Clockmaker Song',
      body: 'A song.',
      tags: ['song'],
      canonLevel: 'speculative',
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://crew.test/v1/admin/roleplay/lore/entries');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body['layer_id']).toBe('world-main');
    expect(body).toMatchObject({
      write: {
        world_id: 'profile-a',
        title: 'Clockmaker Song',
        body: 'A song.',
        canon_status: 'draft',
        content: {
          tags: ['song'],
          metadata_json: { tags: ['song'] },
        },
      },
    });
  });

  it('updates a Crew lore entry with the expected revision', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        data: {
          entry: {
            record_id: 'entry-a',
            revision: 4,
            title: 'Clockmaker Song',
            body: 'A revised song.',
          },
        },
        meta: { request_id: 'req', schema_version: 1 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = createApi();

    const entry = await api.updateEntry({
      recordId: 'entry-a',
      expectedRevision: 3,
      title: 'Clockmaker Song',
      body: 'A revised song.',
      tags: ['song', 'clockmaker'],
      canonLevel: 'established',
      scope: { layerIds: ['world-main'] },
    });

    expect(entry.revision).toBe(4);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe('/v1/admin/roleplay/lore/entries/entry-a');
    expect(parsed.searchParams.get('layer_id')).toBe('world-main');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      expected_revision: 3,
      title: 'Clockmaker Song',
      body: 'A revised song.',
      canon_status: 'canon',
      content: {
        tags: ['song', 'clockmaker'],
      },
    });
  });

  it('calls Crew lore entry promote route', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        data: {
          entry: {
            record_id: 'entry-promoted',
            revision: 1,
            title: 'Promoted lore',
            body: 'Durable now.',
          },
        },
        meta: { request_id: 'req', schema_version: 1 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = createApi();

    await api.promoteEntry({
      entryId: 'entry-a',
      sourceLayerId: 'story-events',
      targetLayerId: 'world-main',
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      'http://crew.test/v1/admin/roleplay/lore/entries/entry-a/promote',
    );
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      sourceLayerId: 'story-events',
      targetLayerId: 'world-main',
    });
  });

  it('throws API error messages from failed envelopes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            ok: false,
            error: { message: 'Lore unavailable.' },
            meta: { request_id: 'req', schema_version: 1 },
          },
          503,
        ),
      ),
    );
    const api = createApi();

    await expect(api.searchEntries('campaign', '')).rejects.toThrow(
      'Lore unavailable.',
    );
  });
});

function createApi(): LoreEntryApi {
  TestBed.configureTestingModule({
    providers: [
      LoreEntryApi,
      {
        provide: LORE_ENTRY_API_CONFIG,
        useValue: { baseUrl: 'http://crew.test', bearerToken: 'token-a' },
      },
    ],
  });
  return TestBed.inject(LoreEntryApi);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

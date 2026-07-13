import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BACKEND_CONFIG } from '../backend-config';
import {
  mapStPacketImportResult,
  StPacketImportApi,
} from './st-packet-import-api';
import type { StImportPlan } from './st-import-planner';

describe('ST packet import API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps upstream import results', () => {
    expect(
      mapStPacketImportResult({
        importId: 'imp',
        profileId: 'profile-a',
        character: { id: 'char-a' },
        persona: { id: 'persona-a' },
        lore: { layerId: 'layer-a' },
        session: { sessionId: 'session-a' },
        counts: {
          characters: 1,
          personas: 1,
          loreEntries: 24,
          messages: 71,
          assistantVariantRows: 36,
          assistantMultiSwipeRows: 9,
          variants: 82,
        },
      }),
    ).toEqual({
      importId: 'imp',
      profileId: 'profile-a',
      characterId: 'char-a',
      personaId: 'persona-a',
      loreLayerId: 'layer-a',
      sessionId: 'session-a',
      counts: {
        characters: 1,
        personas: 1,
        loreEntries: 24,
        messages: 71,
        assistantVariantRows: 36,
        assistantMultiSwipeRows: 9,
        variants: 82,
      },
    });
  });

  it('posts normalized plans to the rusty-crew ST packet endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            importId: 'imp',
            profileId: 'profile-a',
            counts: {
              characters: 1,
              personas: 1,
              loreEntries: 2,
              messages: 3,
              assistantVariantRows: 1,
              assistantMultiSwipeRows: 1,
              variants: 4,
            },
          },
        }),
        { status: 200 },
      ),
    );
    TestBed.configureTestingModule({
      providers: [
        StPacketImportApi,
        {
          provide: BACKEND_CONFIG,
          useValue: {
            rustyCrewBaseUrl: 'http://crew.test',
            bearerToken: 'token-a',
          },
        },
      ],
    });

    const api = TestBed.inject(StPacketImportApi);
    const result = await api.importPlan(minimalPlan());

    expect(result.counts.messages).toBe(3);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://crew.test/v1/admin/roleplay/imports/st-packet',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(minimalPlan()),
      }),
    );
    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers;
    expect(headers).toBeInstanceOf(Headers);
    expect((headers as Headers).get('authorization')).toBe('Bearer token-a');
  });
});

function minimalPlan(): StImportPlan {
  return {
    profileId: 'profile-a',
    importId: 'imp',
    provenance: { source: 'test' },
    rawSource: {},
    loreEntries: [],
    transcriptRows: [],
    importSummary: {
      artifacts: [],
      firstClassFields: [],
      preservedMetadata: [],
      notDuplicatedRuntimeCeremony: [],
      counts: {
        characters: 0,
        personas: 0,
        loreEntries: 0,
        transcriptRows: 0,
        assistantRows: 0,
        assistantVariantRows: 0,
      },
      warnings: [],
    },
  };
}

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
import {
  mapMechanicDiagnostic,
  mapMechanicProfileConfig,
  mapMechanicProposal,
  mapMechanicSessionSummary,
  MechanicApi,
} from './mechanic-api';

describe('MechanicApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps the approved mechanic profile and read-only auto-monitor contract', () => {
    expect(
      mapMechanicProfileConfig({
        profileId: 'mechanic',
        configured: true,
        config: {
          name: 'Maren',
          providerAlias: 'deepseek-flash',
          autoMonitor: {
            enabled: false,
            available: false,
            status: 'inactive_future',
          },
        },
        localToolProfileId: 'roleplay_mechanic',
        toolPolicyIsolated: true,
        applies: 'next_wake',
      }),
    ).toEqual({
      profileId: 'mechanic',
      configured: true,
      name: 'Maren',
      providerAlias: 'deepseek-flash',
      autoMonitor: {
        enabled: false,
        available: false,
        status: 'inactive_future',
      },
      localToolProfileId: 'roleplay_mechanic',
      toolPolicyIsolated: true,
      applies: 'next_wake',
    });
  });

  it('maps proposal diffs, session associations, and diagnostic outcomes', () => {
    const proposal = mapMechanicProposal({
      proposalId: 'proposal-1',
      mechanicSessionId: 'mechanic-session',
      roleplaySessionId: 'rp-session',
      profileId: 'narrator',
      kind: 'exemplar',
      beforeValue: 'Before',
      proposedValue: 'After',
      rationale: 'Fix pacing.',
      diagnosticContext: { source: 'mechanic' },
      status: 'proposed',
      revision: 2,
      history: [
        {
          eventId: 'event-1',
          kind: 'proposed',
          actorId: 'mechanic',
          details: {},
          createdAt: '2026-07-13T00:00:00Z',
        },
      ],
      createdAt: '2026-07-13T00:00:00Z',
      updatedAt: '2026-07-13T00:00:00Z',
    });
    const session = mapMechanicSessionSummary({
      association: {
        mechanicSessionId: 'mechanic-session',
        mechanicProfileId: 'mechanic',
        roleplaySessionId: 'rp-session',
        roleplayProfileId: 'narrator',
        revision: 1,
        createdAt: '2026-07-13T00:00:00Z',
        updatedAt: '2026-07-13T00:00:00Z',
      },
      session: { status: 'idle', archived: false },
    });
    const diagnostic = mapMechanicDiagnostic({
      diagnosticId: 'diagnostic-1',
      mechanicSessionId: 'mechanic-session',
      mechanicProfileId: 'mechanic',
      roleplaySessionId: 'rp-session',
      roleplayProfileId: 'narrator',
      symptom: 'Flat output',
      hypothesis: 'Exemplar rewards summary.',
      proposalIds: ['proposal-1'],
      appliedProposalIds: [],
      outcome: 'pending',
      revision: 1,
      createdAt: '2026-07-13T00:00:00Z',
      updatedAt: '2026-07-13T00:00:00Z',
    });

    expect(proposal.beforeValue).toBe('Before');
    expect(proposal.proposedValue).toBe('After');
    expect(session.association.roleplaySessionId).toBe('rp-session');
    expect(diagnostic.proposalIds).toEqual(['proposal-1']);
    expect(diagnostic.outcome).toBe('pending');
  });

  it('uses the revision-gated decision and outcome routes with auth', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          data: proposalRecord('approved', 2),
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          data: {
            diagnostic: {
              diagnosticId: 'diagnostic-1',
              mechanicSessionId: 'mechanic-session',
              mechanicProfileId: 'mechanic',
              roleplaySessionId: 'rp-session',
              roleplayProfileId: 'narrator',
              symptom: 'Flat output',
              hypothesis: 'Weak exemplar',
              proposalIds: ['proposal-1'],
              appliedProposalIds: [],
              outcome: 'improved',
              notes: 'Three turns held the beat.',
              revision: 2,
              createdAt: '2026-07-13T00:00:00Z',
              updatedAt: '2026-07-13T00:01:00Z',
            },
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const api = createApi();

    await api.approveProposal({
      proposalId: 'proposal-1',
      reviewerId: 'operator',
      expectedRevision: 1,
      note: 'Looks correct.',
    });
    await api.updateDiagnosticOutcome({
      diagnosticId: 'diagnostic-1',
      outcome: 'improved',
      expectedRevision: 1,
      notes: 'Three turns held the beat.',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://crew.test/v1/admin/roleplay/mechanic-proposals/proposal-1/approve',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          reviewerId: 'operator',
          expectedRevision: 1,
          note: 'Looks correct.',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://crew.test/v1/admin/roleplay/mechanic-diagnostics/diagnostic-1/outcome',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          outcome: 'improved',
          expectedRevision: 1,
          notes: 'Three turns held the beat.',
        }),
      }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer token-a');
  });
});

function proposalRecord(
  status: string,
  revision: number,
): Record<string, unknown> {
  return {
    proposalId: 'proposal-1',
    mechanicSessionId: 'mechanic-session',
    roleplaySessionId: 'rp-session',
    profileId: 'narrator',
    kind: 'exemplar',
    beforeValue: 'Before',
    proposedValue: 'After',
    rationale: 'Fix pacing.',
    diagnosticContext: {},
    status,
    revision,
    history: [],
    createdAt: '2026-07-13T00:00:00Z',
    updatedAt: '2026-07-13T00:01:00Z',
  };
}

function createApi(): MechanicApi {
  TestBed.configureTestingModule({
    providers: [
      MechanicApi,
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
  return TestBed.inject(MechanicApi);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

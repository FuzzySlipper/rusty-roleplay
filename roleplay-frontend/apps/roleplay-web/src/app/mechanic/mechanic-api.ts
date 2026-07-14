import { inject, Injectable } from '@angular/core';
import type {
  MechanicDiagnostic,
  MechanicDiagnosticOutcome,
  MechanicDiagnosticOutcomeWrite,
  MechanicProfileConfig,
  MechanicProfileConfigWrite,
  MechanicProposal,
  MechanicProposalDecision,
  MechanicProposalKind,
  MechanicProposalStatus,
  MechanicSessionAssociation,
  MechanicSessionAttachment,
  MechanicSessionSummary,
} from '@rusty-roleplay/rp-mechanic';

import { BACKEND_CONFIG } from '../backend-config';

interface ApiEnvelope<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: {
    readonly message?: string;
    readonly reason_code?: string;
  };
}

type ApiRecord = Record<string, unknown>;

export interface MechanicProposalQuery {
  readonly mechanicSessionId?: string;
  readonly roleplaySessionId?: string;
  readonly profileId?: string;
  readonly status?: MechanicProposalStatus;
  readonly kind?: MechanicProposalKind;
}

export interface MechanicSessionQuery {
  readonly mechanicProfileId?: string;
  readonly roleplaySessionId?: string;
  readonly roleplayProfileId?: string;
  readonly attached?: boolean;
}

export interface MechanicDiagnosticQuery {
  readonly mechanicSessionId?: string;
  readonly roleplaySessionId?: string;
  readonly roleplayProfileId?: string;
  readonly outcome?: MechanicDiagnosticOutcome;
  readonly proposalId?: string;
}

@Injectable()
export class MechanicApi {
  private readonly config = inject(BACKEND_CONFIG);

  async readProfileConfig(profileId: string): Promise<MechanicProfileConfig> {
    const data = await this.request<ApiRecord>(this.profilePath(profileId));
    return mapMechanicProfileConfig(data);
  }

  async saveProfileConfig(
    profileId: string,
    config: MechanicProfileConfigWrite,
  ): Promise<MechanicProfileConfig> {
    const data = await this.request<ApiRecord>(this.profilePath(profileId), {
      method: 'PATCH',
      body: JSON.stringify({
        name: config.name,
        ...(config.providerAlias !== undefined
          ? { providerAlias: config.providerAlias }
          : {}),
        autoMonitor: config.autoMonitor,
      }),
    });
    return mapMechanicProfileConfig(data);
  }

  async listProposals(
    query: MechanicProposalQuery = {},
  ): Promise<readonly MechanicProposal[]> {
    const data = await this.request<readonly ApiRecord[]>(
      this.queryPath('/v1/admin/roleplay/mechanic-proposals', {
        mechanic_session_id: query.mechanicSessionId,
        roleplay_session_id: query.roleplaySessionId,
        profile_id: query.profileId,
        status: query.status,
        kind: query.kind,
      }),
    );
    return data.map(mapMechanicProposal);
  }

  async readProposal(proposalId: string): Promise<MechanicProposal> {
    const data = await this.request<ApiRecord>(this.proposalPath(proposalId));
    return mapMechanicProposal(data);
  }

  async approveProposal(
    decision: MechanicProposalDecision,
  ): Promise<MechanicProposal> {
    return this.decideProposal('approve', decision);
  }

  async rejectProposal(
    decision: MechanicProposalDecision,
  ): Promise<MechanicProposal> {
    return this.decideProposal('reject', decision);
  }

  async applyProposal(
    proposalId: string,
    actorId: string,
  ): Promise<MechanicProposal> {
    const data = await this.request<{ readonly proposal?: ApiRecord }>(
      `${this.proposalPath(proposalId)}/apply`,
      { method: 'POST', body: JSON.stringify({ actorId }) },
    );
    return mapMechanicProposal(requiredRecord(data.proposal, 'proposal'));
  }

  async listSessions(
    query: MechanicSessionQuery = {},
  ): Promise<readonly MechanicSessionSummary[]> {
    const data = await this.request<{
      readonly items?: readonly ApiRecord[];
    }>(
      this.queryPath('/v1/admin/roleplay/mechanic-sessions', {
        mechanic_profile_id: query.mechanicProfileId,
        roleplay_session_id: query.roleplaySessionId,
        roleplay_profile_id: query.roleplayProfileId,
        attached:
          query.attached === undefined ? undefined : String(query.attached),
      }),
    );
    return (data.items ?? []).map(mapMechanicSessionSummary);
  }

  async createSession(
    profileId: string,
    roleplaySessionId?: string,
  ): Promise<MechanicSessionSummary> {
    const data = await this.request<ApiRecord>(
      '/v1/admin/roleplay/mechanic-sessions',
      {
        method: 'POST',
        body: JSON.stringify({
          profileId,
          ...(roleplaySessionId !== undefined ? { roleplaySessionId } : {}),
        }),
      },
    );
    return mapMechanicSessionSummary(data);
  }

  async attachSession(
    request: MechanicSessionAttachment,
  ): Promise<MechanicSessionAssociation> {
    const data = await this.request<{ readonly association?: ApiRecord }>(
      `${this.sessionPath(request.mechanicSessionId)}/attach`,
      {
        method: 'POST',
        body: JSON.stringify({
          roleplaySessionId: request.roleplaySessionId,
          expectedRevision: request.expectedRevision,
        }),
      },
    );
    return mapMechanicSessionAssociation(
      requiredRecord(data.association, 'association'),
    );
  }

  async archiveSession(mechanicSessionId: string): Promise<void> {
    await this.request<unknown>(
      `${this.sessionPath(mechanicSessionId)}/archive`,
      {
        method: 'POST',
      },
    );
  }

  async restoreSession(mechanicSessionId: string): Promise<void> {
    await this.request<unknown>(
      `${this.sessionPath(mechanicSessionId)}/restore`,
      {
        method: 'POST',
      },
    );
  }

  async listDiagnostics(
    query: MechanicDiagnosticQuery = {},
  ): Promise<readonly MechanicDiagnostic[]> {
    const data = await this.request<{
      readonly items?: readonly ApiRecord[];
    }>(
      this.queryPath('/v1/admin/roleplay/mechanic-diagnostics', {
        mechanic_session_id: query.mechanicSessionId,
        roleplay_session_id: query.roleplaySessionId,
        roleplay_profile_id: query.roleplayProfileId,
        outcome: query.outcome,
        proposal_id: query.proposalId,
      }),
    );
    return (data.items ?? []).map(mapMechanicDiagnostic);
  }

  async updateDiagnosticOutcome(
    request: MechanicDiagnosticOutcomeWrite,
  ): Promise<MechanicDiagnostic> {
    const data = await this.request<{ readonly diagnostic?: ApiRecord }>(
      `/v1/admin/roleplay/mechanic-diagnostics/${encodeURIComponent(request.diagnosticId)}/outcome`,
      {
        method: 'POST',
        body: JSON.stringify({
          outcome: request.outcome,
          expectedRevision: request.expectedRevision,
          ...(request.notes !== undefined ? { notes: request.notes } : {}),
        }),
      },
    );
    return mapMechanicDiagnostic(requiredRecord(data.diagnostic, 'diagnostic'));
  }

  private async decideProposal(
    action: 'approve' | 'reject',
    decision: MechanicProposalDecision,
  ): Promise<MechanicProposal> {
    const data = await this.request<ApiRecord>(
      `${this.proposalPath(decision.proposalId)}/${action}`,
      {
        method: 'POST',
        body: JSON.stringify({
          reviewerId: decision.reviewerId,
          expectedRevision: decision.expectedRevision,
          ...(decision.note !== undefined ? { note: decision.note } : {}),
        }),
      },
    );
    return mapMechanicProposal(data);
  }

  private profilePath(profileId: string): string {
    return `/v1/admin/roleplay/profiles/${encodeURIComponent(profileId)}/mechanic-config`;
  }

  private proposalPath(proposalId: string): string {
    return `/v1/admin/roleplay/mechanic-proposals/${encodeURIComponent(proposalId)}`;
  }

  private sessionPath(mechanicSessionId: string): string {
    return `/v1/admin/roleplay/mechanic-sessions/${encodeURIComponent(mechanicSessionId)}`;
  }

  private queryPath(
    path: string,
    values: Readonly<Record<string, string | undefined>>,
  ): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined && value !== '') query.set(key, value);
    }
    const encoded = query.toString();
    return encoded === '' ? path : `${path}?${encoded}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.config.rustyCrewBaseUrl}${path}`, {
      ...init,
      headers: this.headers(init.headers),
    });
    const envelope = (await response.json()) as ApiEnvelope<T>;
    if (!response.ok || !envelope.ok) {
      throw new Error(
        envelope.error?.message ??
          envelope.error?.reason_code ??
          `Mechanic request failed with ${response.status}`,
      );
    }
    if (envelope.data === undefined) {
      throw new Error('Mechanic response did not include data.');
    }
    return envelope.data;
  }

  private headers(headers: HeadersInit | undefined): Headers {
    const result = new Headers(headers);
    result.set('content-type', 'application/json');
    if (this.config.bearerToken !== undefined) {
      result.set('authorization', `Bearer ${this.config.bearerToken}`);
    }
    return result;
  }
}

export function mapMechanicProfileConfig(
  record: ApiRecord,
): MechanicProfileConfig {
  const config = readRecord(record['config']);
  const autoMonitor = readRecord(
    config['autoMonitor'] ?? config['auto_monitor'],
  );
  const providerAlias = readString(config, 'providerAlias', 'provider_alias');
  return {
    profileId: readString(record, 'profileId', 'profile_id') ?? '',
    configured: readBoolean(record['configured']),
    name: readString(config, 'name') ?? '',
    ...(providerAlias !== undefined ? { providerAlias } : {}),
    autoMonitor: {
      enabled: readBoolean(autoMonitor['enabled']),
      available: readBoolean(autoMonitor['available']),
      status: readString(autoMonitor, 'status') ?? 'inactive_future',
    },
    localToolProfileId:
      readString(record, 'localToolProfileId', 'local_tool_profile_id') ?? '',
    toolPolicyIsolated: readBoolean(
      record['toolPolicyIsolated'] ?? record['tool_policy_isolated'],
    ),
    applies: readString(record, 'applies') ?? 'next_wake',
  };
}

export function mapMechanicProposal(record: ApiRecord): MechanicProposal {
  const kind = readProposalKind(record['kind']);
  const status = readProposalStatus(record['status']);
  if (kind === undefined || status === undefined) {
    throw new Error(
      'Mechanic proposal response contained an unsupported kind or status.',
    );
  }
  const targetId = readString(record, 'targetId', 'target_id');
  const targetRevision = readNumber(
    record['targetRevision'] ?? record['target_revision'],
  );
  const reviewerId = readString(record, 'reviewerId', 'reviewer_id');
  const reviewNote = readString(record, 'reviewNote', 'review_note');
  const reviewedAt = readString(record, 'reviewedAt', 'reviewed_at');
  const appliedAt = readString(record, 'appliedAt', 'applied_at');
  return {
    proposalId: readString(record, 'proposalId', 'proposal_id') ?? '',
    mechanicSessionId:
      readString(record, 'mechanicSessionId', 'mechanic_session_id') ?? '',
    roleplaySessionId:
      readString(record, 'roleplaySessionId', 'roleplay_session_id') ?? '',
    profileId: readString(record, 'profileId', 'profile_id') ?? '',
    kind,
    ...(targetId !== undefined ? { targetId } : {}),
    ...(targetRevision !== undefined ? { targetRevision } : {}),
    beforeValue: record['beforeValue'] ?? record['before_value'],
    proposedValue: record['proposedValue'] ?? record['proposed_value'],
    rationale: readString(record, 'rationale') ?? '',
    diagnosticContext:
      record['diagnosticContext'] ?? record['diagnostic_context'] ?? {},
    status,
    ...(reviewerId !== undefined ? { reviewerId } : {}),
    ...(reviewNote !== undefined ? { reviewNote } : {}),
    ...(reviewedAt !== undefined ? { reviewedAt } : {}),
    ...(appliedAt !== undefined ? { appliedAt } : {}),
    ...(record['outcome'] !== undefined ? { outcome: record['outcome'] } : {}),
    revision: readNumber(record['revision']) ?? 0,
    history: readArray(record['history']).map((item) => {
      const event = readRecord(item);
      const note = readString(event, 'note');
      const eventTargetRevision = readNumber(
        event['targetRevision'] ?? event['target_revision'],
      );
      return {
        eventId: readString(event, 'eventId', 'event_id') ?? '',
        kind: readString(event, 'kind') ?? '',
        actorId: readString(event, 'actorId', 'actor_id') ?? '',
        ...(note !== undefined ? { note } : {}),
        ...(eventTargetRevision !== undefined
          ? { targetRevision: eventTargetRevision }
          : {}),
        details: event['details'] ?? {},
        createdAt: readString(event, 'createdAt', 'created_at') ?? '',
      };
    }),
    createdAt: readString(record, 'createdAt', 'created_at') ?? '',
    updatedAt: readString(record, 'updatedAt', 'updated_at') ?? '',
  };
}

export function mapMechanicSessionSummary(
  record: ApiRecord,
): MechanicSessionSummary {
  const associationRecord = readRecord(record['association'] ?? record);
  const session = readRecord(record['session']);
  const title = readString(session, 'title');
  const status = readString(session, 'status') ?? 'idle';
  return {
    association: mapMechanicSessionAssociation(associationRecord),
    status,
    ...(title !== undefined ? { title } : {}),
    archived: readBoolean(session['archived']) || status === 'archived',
  };
}

export function mapMechanicSessionAssociation(
  record: ApiRecord,
): MechanicSessionAssociation {
  const roleplaySessionId = readString(
    record,
    'roleplaySessionId',
    'roleplay_session_id',
  );
  const roleplayProfileId = readString(
    record,
    'roleplayProfileId',
    'roleplay_profile_id',
  );
  return {
    mechanicSessionId:
      readString(record, 'mechanicSessionId', 'mechanic_session_id') ?? '',
    mechanicProfileId:
      readString(record, 'mechanicProfileId', 'mechanic_profile_id') ?? '',
    ...(roleplaySessionId !== undefined ? { roleplaySessionId } : {}),
    ...(roleplayProfileId !== undefined ? { roleplayProfileId } : {}),
    revision: readNumber(record['revision']) ?? 0,
    createdAt: readString(record, 'createdAt', 'created_at') ?? '',
    updatedAt: readString(record, 'updatedAt', 'updated_at') ?? '',
  };
}

export function mapMechanicDiagnostic(record: ApiRecord): MechanicDiagnostic {
  const outcome = readDiagnosticOutcome(record['outcome']);
  if (outcome === undefined) {
    throw new Error(
      'Mechanic diagnostic response contained an unsupported outcome.',
    );
  }
  const notes = readString(record, 'notes');
  return {
    diagnosticId: readString(record, 'diagnosticId', 'diagnostic_id') ?? '',
    mechanicSessionId:
      readString(record, 'mechanicSessionId', 'mechanic_session_id') ?? '',
    mechanicProfileId:
      readString(record, 'mechanicProfileId', 'mechanic_profile_id') ?? '',
    roleplaySessionId:
      readString(record, 'roleplaySessionId', 'roleplay_session_id') ?? '',
    roleplayProfileId:
      readString(record, 'roleplayProfileId', 'roleplay_profile_id') ?? '',
    symptom: readString(record, 'symptom') ?? '',
    hypothesis: readString(record, 'hypothesis') ?? '',
    proposalIds: readStringArray(
      record['proposalIds'] ?? record['proposal_ids'],
    ),
    appliedProposalIds: readStringArray(
      record['appliedProposalIds'] ?? record['applied_proposal_ids'],
    ),
    outcome,
    ...(notes !== undefined ? { notes } : {}),
    revision: readNumber(record['revision']) ?? 0,
    createdAt: readString(record, 'createdAt', 'created_at') ?? '',
    updatedAt: readString(record, 'updatedAt', 'updated_at') ?? '',
  };
}

function requiredRecord(value: unknown, label: string): ApiRecord {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as ApiRecord;
  }
  throw new Error(`Mechanic response ${label} was not an object.`);
}

function readRecord(value: unknown): ApiRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as ApiRecord)
    : {};
}

function readArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(
  record: ApiRecord,
  ...keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function readStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function readProposalKind(value: unknown): MechanicProposalKind | undefined {
  return value === 'narrator_config' ||
    value === 'exemplar' ||
    value === 'lore_add' ||
    value === 'lore_edit' ||
    value === 'lore_tags' ||
    value === 'layer_retrieval_config'
    ? value
    : undefined;
}

function readProposalStatus(
  value: unknown,
): MechanicProposalStatus | undefined {
  return value === 'proposed' ||
    value === 'approved' ||
    value === 'rejected' ||
    value === 'applied'
    ? value
    : undefined;
}

function readDiagnosticOutcome(
  value: unknown,
): MechanicDiagnosticOutcome | undefined {
  return value === 'pending' ||
    value === 'improved' ||
    value === 'no_change' ||
    value === 'worse'
    ? value
    : undefined;
}

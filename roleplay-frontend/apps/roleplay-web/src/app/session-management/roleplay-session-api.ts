import { inject, Injectable } from '@angular/core';

import { BACKEND_CONFIG } from '../backend-config';
import type {
  CreateRoleplaySessionRequest,
  RoleplaySessionSummary,
  UpdateRoleplaySessionRequest,
} from './roleplay-session.model';

interface ApiEnvelope<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: {
    readonly message?: string;
    readonly reason_code?: string;
  };
}

type ApiRecord = Record<string, unknown>;

@Injectable()
export class RoleplaySessionApi {
  private readonly config = inject(BACKEND_CONFIG);

  async listSessions(
    profileId: string,
  ): Promise<readonly RoleplaySessionSummary[]> {
    const data = await this.request<{ readonly items?: readonly ApiRecord[] }>(
      `/v1/admin/roleplay/sessions?profile_id=${encodeURIComponent(profileId)}`,
    );
    return (data.items ?? []).map(mapRoleplaySession);
  }

  async createSession(
    profileId: string,
    request: CreateRoleplaySessionRequest,
  ): Promise<RoleplaySessionSummary> {
    const data = await this.request<{ readonly session?: ApiRecord }>(
      '/v1/admin/roleplay/sessions',
      {
        method: 'POST',
        body: JSON.stringify({
          profileId,
          displayName: request.displayName,
          characterId: request.characterId,
          playerPersonaId: request.playerPersonaId,
          activeLayerIds: request.activeLayerIds,
        }),
      },
    );
    return mapRoleplaySession(requiredRecord(data.session, 'session'));
  }

  async updateSession(
    request: UpdateRoleplaySessionRequest,
  ): Promise<RoleplaySessionSummary> {
    const body: Record<string, unknown> = {};
    if (request.displayName !== undefined) {
      body['displayName'] = request.displayName;
    }
    if (request.characterId !== undefined) {
      body['characterId'] = request.characterId;
    }
    if (request.playerPersonaId !== undefined) {
      body['playerPersonaId'] = request.playerPersonaId;
    }
    if (request.activeLayerIds !== undefined) {
      body['activeLayerIds'] = request.activeLayerIds;
    }
    const data = await this.request<{ readonly session?: ApiRecord }>(
      `/v1/admin/roleplay/sessions/${encodeURIComponent(request.sessionId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    );
    return mapRoleplaySession(requiredRecord(data.session, 'session'));
  }

  async archiveSession(sessionId: string): Promise<RoleplaySessionSummary> {
    return this.postSessionAction(sessionId, 'archive');
  }

  async restoreSession(sessionId: string): Promise<RoleplaySessionSummary> {
    return this.postSessionAction(sessionId, 'restore');
  }

  private async postSessionAction(
    sessionId: string,
    action: 'archive' | 'restore',
  ): Promise<RoleplaySessionSummary> {
    const data = await this.request<{ readonly session?: ApiRecord }>(
      `/v1/admin/roleplay/sessions/${encodeURIComponent(sessionId)}/${action}`,
      { method: 'POST' },
    );
    return mapRoleplaySession(requiredRecord(data.session, 'session'));
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
          `Roleplay session request failed with ${response.status}`,
      );
    }
    if (envelope.data === undefined) {
      throw new Error('Roleplay session response did not include data.');
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

export function mapRoleplaySession(record: ApiRecord): RoleplaySessionSummary {
  return {
    sessionId:
      readString(record, 'session_id') ?? readString(record, 'sessionId') ?? '',
    profileId:
      readString(record, 'profile_id') ?? readString(record, 'profileId') ?? '',
    agentId: readString(record, 'agent_id') ?? readString(record, 'agentId'),
    status: readString(record, 'status') ?? 'idle',
    displayName:
      readString(record, 'display_name') ?? readString(record, 'displayName'),
    characterId:
      readString(record, 'character_id') ?? readString(record, 'characterId'),
    characterName:
      readString(record, 'character_name') ??
      readString(record, 'characterName'),
    playerPersonaId:
      readString(record, 'player_persona_id') ??
      readString(record, 'playerPersonaId'),
    playerPersonaName:
      readString(record, 'player_persona_name') ??
      readString(record, 'playerPersonaName'),
    playerPersonaAvatarUrl:
      readString(record, 'player_persona_avatar_url') ??
      readString(record, 'playerPersonaAvatarUrl'),
    activeLayerIds: readStringArray(
      record['active_layer_ids'] ?? record['activeLayerIds'],
    ),
    activeLayerCount:
      readNumber(record, 'active_layer_count') ??
      readNumber(record, 'activeLayerCount') ??
      readStringArray(record['active_layer_ids'] ?? record['activeLayerIds'])
        .length,
    lastMessagePreview:
      readString(record, 'last_message_preview') ??
      readString(record, 'lastMessagePreview'),
    archived:
      readBoolean(record, 'archived') ||
      readString(record, 'status') === 'archived',
    createdAt:
      readString(record, 'created_at') ?? readString(record, 'createdAt'),
    updatedAt:
      readString(record, 'updated_at') ?? readString(record, 'updatedAt'),
  };
}

function requiredRecord(value: unknown, label: string): ApiRecord {
  if (typeof value === 'object' && value !== null) {
    return value as ApiRecord;
  }
  throw new Error(`Roleplay session response ${label} was not an object.`);
}

function readString(record: ApiRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(record: ApiRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

function readBoolean(record: ApiRecord, key: string): boolean {
  return record[key] === true;
}

function readStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

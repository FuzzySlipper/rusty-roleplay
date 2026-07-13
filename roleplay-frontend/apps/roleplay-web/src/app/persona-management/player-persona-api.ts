import { inject, Injectable } from '@angular/core';

import { BACKEND_CONFIG } from '../backend-config';
import type {
  PlayerPersona,
  PlayerPersonaUpdateRequest,
  PlayerPersonaWriteRequest,
} from './player-persona.model';

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
export class PlayerPersonaApi {
  private readonly config = inject(BACKEND_CONFIG);

  async listPersonas(
    profileId: string,
    includeArchived = false,
  ): Promise<readonly PlayerPersona[]> {
    const query = includeArchived ? '?include_archived=true' : '';
    const data = await this.request<{
      readonly items?: readonly ApiRecord[];
      readonly personas?: readonly ApiRecord[];
    }>(`${this.profilePersonasPath(profileId)}${query}`);
    return (data.items ?? data.personas ?? []).map(mapPlayerPersona);
  }

  async createPersona(
    profileId: string,
    request: PlayerPersonaWriteRequest,
  ): Promise<PlayerPersona> {
    const data = await this.request<{ readonly persona?: ApiRecord }>(
      this.profilePersonasPath(profileId),
      {
        method: 'POST',
        body: JSON.stringify(personaBody(request)),
      },
    );
    return mapPlayerPersona(requiredRecord(data.persona, 'persona'));
  }

  async updatePersona(
    profileId: string,
    request: PlayerPersonaUpdateRequest,
  ): Promise<PlayerPersona> {
    const data = await this.request<{ readonly persona?: ApiRecord }>(
      `${this.profilePersonasPath(profileId)}/${encodeURIComponent(request.id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(personaBody(request.patch)),
      },
    );
    return mapPlayerPersona(requiredRecord(data.persona, 'persona'));
  }

  async archivePersona(profileId: string, personaId: string): Promise<void> {
    await this.request(
      `${this.profilePersonasPath(profileId)}/${encodeURIComponent(personaId)}`,
      { method: 'DELETE' },
    );
  }

  private profilePersonasPath(profileId: string): string {
    return `/v1/admin/roleplay/profiles/${encodeURIComponent(profileId)}/personas`;
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
          `Roleplay persona request failed with ${response.status}`,
      );
    }
    if (envelope.data === undefined) {
      throw new Error('Roleplay persona response did not include data.');
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

export function mapPlayerPersona(record: ApiRecord): PlayerPersona {
  return {
    id:
      readString(record, 'id') ??
      readString(record, 'persona_id') ??
      readString(record, 'personaId') ??
      '',
    profileId:
      readString(record, 'profile_id') ?? readString(record, 'profileId') ?? '',
    name:
      readString(record, 'name') ??
      readString(record, 'display_name') ??
      readString(record, 'displayName') ??
      'Untitled persona',
    avatarUrl:
      readString(record, 'avatar_url') ?? readString(record, 'avatarUrl'),
    avatarAssetRef:
      readString(record, 'avatar_asset_ref') ??
      readString(record, 'avatarAssetRef'),
    description: readString(record, 'description') ?? '',
    notes: readString(record, 'notes') ?? '',
    tags: readStringArray(record['tags']),
    status: readString(record, 'status') === 'archived' ? 'archived' : 'active',
    createdAt:
      readString(record, 'created_at') ?? readString(record, 'createdAt'),
    updatedAt:
      readString(record, 'updated_at') ?? readString(record, 'updatedAt'),
  };
}

function personaBody(
  request: PlayerPersonaWriteRequest,
): Record<string, unknown> {
  return {
    ...(request.id === undefined ? {} : { id: request.id }),
    name: request.name,
    displayName: request.name,
    description: request.description,
    notes: request.notes,
    tags: request.tags,
    ...(request.avatarUrl === undefined
      ? {}
      : { avatarUrl: request.avatarUrl }),
    ...(request.avatarAssetRef === undefined
      ? {}
      : { avatarAssetRef: request.avatarAssetRef }),
  };
}

function requiredRecord(value: unknown, label: string): ApiRecord {
  if (typeof value === 'object' && value !== null) {
    return value as ApiRecord;
  }
  throw new Error(`Roleplay persona response ${label} was not an object.`);
}

function readString(record: ApiRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function readStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

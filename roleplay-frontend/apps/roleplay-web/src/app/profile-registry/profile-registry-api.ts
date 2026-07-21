import { inject, Injectable } from '@angular/core';
import type { Profile } from '@rusty-roleplay/rp-profile';

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

export interface RegistryProfile extends Profile {
  readonly roleplayNarratorCapable: boolean;
}

export interface FirstNarratorSetupRequest {
  readonly profileId: string;
  readonly displayName: string;
  readonly providerAlias: string;
  readonly providerDisplayName: string;
  readonly providerBaseUrl: string;
  readonly modelId: string;
  readonly contextWindowTokens: number;
  readonly maxOutputTokens: number;
  readonly apiKey: string | undefined;
}

@Injectable()
export class ProfileRegistryApi {
  private readonly config = inject(BACKEND_CONFIG);

  async listProfiles(): Promise<readonly RegistryProfile[]> {
    const data = await this.request<{ readonly items?: readonly ApiRecord[] }>(
      '/v1/admin/profiles/registry',
    );
    return (data.items ?? []).map(mapProfile).filter((profile) => profile.id);
  }

  async createFirstNarrator(request: FirstNarratorSetupRequest): Promise<void> {
    const providerPath = `/v1/admin/model-providers/${encodeURIComponent(request.providerAlias)}`;
    if (!(await this.resourceExists(providerPath))) {
      await this.request<unknown>('/v1/admin/model-providers', {
        method: 'POST',
        body: JSON.stringify({
          alias: request.providerAlias,
          status: 'active',
          protocol: 'chat_completions',
          providerKind: 'custom',
          displayName: request.providerDisplayName,
          description: 'Roleplay narrator provider created during first setup.',
          baseUrl: request.providerBaseUrl,
          modelId: request.modelId,
          contextWindowTokens: request.contextWindowTokens,
          maxOutputTokens: request.maxOutputTokens,
          ...(request.apiKey === undefined ? {} : { apiKey: request.apiKey }),
          metadataJson: { purpose: 'rusty_roleplay_narrator' },
        }),
      });
    }

    await this.request<unknown>('/v1/admin/control/profiles', {
      method: 'POST',
      body: JSON.stringify({
        profileId: request.profileId,
        displayName: request.displayName,
        kind: 'full',
        providerAlias: request.providerAlias,
        brain: {
          module: 'chat-completions',
          strategy: 'roleplay_narrator',
        },
        localToolProfileId: 'roleplay_lore',
        reason: 'first narrator setup from rusty-roleplay',
      }),
    });
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.config.rustyCrewBaseUrl}${path}`, {
      ...init,
      headers: this.headers(),
    });
    const envelope = (await response.json()) as ApiEnvelope<T>;
    if (!response.ok || !envelope.ok) {
      throw new Error(
        envelope.error?.message ??
          envelope.error?.reason_code ??
          `Profile registry request failed with ${response.status}`,
      );
    }
    if (envelope.data === undefined) {
      throw new Error('Profile registry response did not include data.');
    }
    return envelope.data;
  }

  private async resourceExists(path: string): Promise<boolean> {
    const response = await fetch(`${this.config.rustyCrewBaseUrl}${path}`, {
      headers: this.headers(),
    });
    if (response.status === 404) {
      return false;
    }
    const envelope = (await response.json()) as ApiEnvelope<unknown>;
    if (!response.ok || !envelope.ok) {
      throw new Error(
        envelope.error?.message ??
          envelope.error?.reason_code ??
          `Profile registry request failed with ${response.status}`,
      );
    }
    return true;
  }

  private headers(): Headers {
    const result = new Headers();
    result.set('content-type', 'application/json');
    if (this.config.bearerToken !== undefined) {
      result.set('authorization', `Bearer ${this.config.bearerToken}`);
    }
    return result;
  }
}

export function mapProfile(record: ApiRecord): RegistryProfile {
  const id =
    readString(record, 'profileId') ?? readString(record, 'profile_id');
  const localToolProfileId =
    readString(record, 'localToolProfileId') ??
    readString(record, 'local_tool_profile_id');
  return {
    id: id ?? '',
    name:
      readString(record, 'displayName') ??
      readString(record, 'display_name') ??
      id ??
      'Untitled profile',
    hasPassword: false,
    roleplayNarratorCapable: localToolProfileId === 'roleplay_lore',
  };
}

export function initialRoleplayProfile(
  profiles: readonly RegistryProfile[],
  configuredProfileId: string | undefined,
): RegistryProfile | undefined {
  if (configuredProfileId !== undefined) {
    return profiles.find((profile) => profile.id === configuredProfileId);
  }
  return profiles.find((profile) => profile.roleplayNarratorCapable);
}

function readString(record: ApiRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

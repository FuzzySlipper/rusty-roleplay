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

@Injectable()
export class ProfileRegistryApi {
  private readonly config = inject(BACKEND_CONFIG);

  async listProfiles(): Promise<readonly Profile[]> {
    const data = await this.request<{ readonly items?: readonly ApiRecord[] }>(
      '/v1/admin/profiles/registry',
    );
    return (data.items ?? []).map(mapProfile).filter((profile) => profile.id);
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.config.rustyCrewBaseUrl}${path}`, {
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

  private headers(): Headers {
    const result = new Headers();
    result.set('content-type', 'application/json');
    if (this.config.bearerToken !== undefined) {
      result.set('authorization', `Bearer ${this.config.bearerToken}`);
    }
    return result;
  }
}

export function mapProfile(record: ApiRecord): Profile {
  const id =
    readString(record, 'profileId') ?? readString(record, 'profile_id');
  return {
    id: id ?? '',
    name:
      readString(record, 'displayName') ??
      readString(record, 'display_name') ??
      id ??
      'Untitled profile',
    hasPassword: false,
  };
}

function readString(record: ApiRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

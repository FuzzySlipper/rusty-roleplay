import { inject, Injectable } from '@angular/core';

import { BACKEND_CONFIG } from '../backend-config';
import type { StImportPlan } from './st-import-planner';

export interface StPacketImportResult {
  readonly importId: string;
  readonly profileId: string;
  readonly counts: {
    readonly characters: number;
    readonly personas: number;
    readonly loreEntries: number;
    readonly messages: number;
    readonly assistantVariantRows: number;
    readonly assistantMultiSwipeRows: number;
    readonly variants: number;
  };
  readonly characterId: string | undefined;
  readonly personaId: string | undefined;
  readonly loreLayerId: string | undefined;
  readonly sessionId: string | undefined;
}

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
export class StPacketImportApi {
  private readonly config = inject(BACKEND_CONFIG);

  async importPlan(plan: StImportPlan): Promise<StPacketImportResult> {
    const data = await this.request<ApiRecord>(
      '/v1/admin/roleplay/imports/st-packet',
      {
        method: 'POST',
        body: JSON.stringify(plan),
      },
    );
    return mapStPacketImportResult(data);
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
          `ST packet import failed with ${response.status}`,
      );
    }
    if (envelope.data === undefined) {
      throw new Error('ST packet import response did not include data.');
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

export function mapStPacketImportResult(
  record: ApiRecord,
): StPacketImportResult {
  const counts = optionalRecord(record['counts']);
  const character = optionalRecord(record['character']);
  const persona = optionalRecord(record['persona']);
  const lore = optionalRecord(record['lore']);
  const session = optionalRecord(record['session']);
  return {
    importId:
      readString(record, 'importId') ?? readString(record, 'import_id') ?? '',
    profileId:
      readString(record, 'profileId') ?? readString(record, 'profile_id') ?? '',
    counts: {
      characters: readNumber(counts, 'characters') ?? 0,
      personas: readNumber(counts, 'personas') ?? 0,
      loreEntries:
        readNumber(counts, 'loreEntries') ??
        readNumber(counts, 'lore_entries') ??
        0,
      messages: readNumber(counts, 'messages') ?? 0,
      assistantVariantRows:
        readNumber(counts, 'assistantVariantRows') ??
        readNumber(counts, 'assistant_variant_rows') ??
        0,
      assistantMultiSwipeRows:
        readNumber(counts, 'assistantMultiSwipeRows') ??
        readNumber(counts, 'assistant_multi_swipe_rows') ??
        0,
      variants: readNumber(counts, 'variants') ?? 0,
    },
    characterId: readString(character, 'id'),
    personaId: readString(persona, 'id'),
    loreLayerId:
      readString(lore, 'layerId') ?? readString(lore, 'layer_id'),
    sessionId:
      readString(session, 'sessionId') ?? readString(session, 'session_id'),
  };
}

function optionalRecord(value: unknown): ApiRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as ApiRecord)
    : undefined;
}

function readString(
  record: ApiRecord | undefined,
  key: string,
): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(
  record: ApiRecord | undefined,
  key: string,
): number | undefined {
  const value = record?.[key];
  return typeof value === 'number' ? value : undefined;
}

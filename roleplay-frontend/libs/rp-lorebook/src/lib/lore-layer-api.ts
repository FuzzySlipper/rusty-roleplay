import {
  inject,
  Injectable,
  InjectionToken,
  type Provider,
} from '@angular/core';

import type {
  ChatLoreLayer,
  CreateLoreLayerRequest,
  LoreLayer,
  LoreLayerPurpose,
  LoreLayerWritePolicy,
} from './lore-layer.model';

export interface LoreLayerApiConfig {
  readonly baseUrl: string;
  readonly bearerToken: string | undefined;
}

export const LORE_LAYER_API_CONFIG = new InjectionToken<LoreLayerApiConfig>(
  'LORE_LAYER_API_CONFIG',
);

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
export class LoreLayerApi {
  private readonly config = inject(LORE_LAYER_API_CONFIG);

  async listProfileLayers(profileId: string): Promise<readonly LoreLayer[]> {
    const data = await this.request<{ readonly layers?: readonly ApiRecord[] }>(
      `/v1/admin/roleplay/lore/layers?profile_id=${encodeURIComponent(profileId)}`,
    );
    return (data.layers ?? []).map(mapLoreLayer);
  }

  async createLayer(
    profileId: string,
    request: CreateLoreLayerRequest,
  ): Promise<LoreLayer> {
    const data = await this.request<{ readonly layer?: ApiRecord }>(
      '/v1/admin/roleplay/lore/layers',
      {
        method: 'POST',
        body: JSON.stringify({
          profileId,
          name: request.name,
          description: request.description,
          purpose: request.purpose,
          writePolicy: request.writePolicy,
        }),
      },
    );
    return mapLoreLayer(requiredRecord(data.layer, 'layer'));
  }

  async getChatLayers(chatId: string): Promise<readonly ChatLoreLayer[]> {
    const data = await this.request<{
      readonly layers?: readonly ApiRecord[];
    }>(
      `/v1/admin/roleplay/lore/chat-layers?chat_id=${encodeURIComponent(chatId)}`,
    );
    return (data.layers ?? []).map(mapChatLoreLayer);
  }

  async setChatLayers(
    chatId: string,
    layerIds: readonly string[],
  ): Promise<void> {
    await this.request('/v1/admin/roleplay/lore/chat-layers', {
      method: 'POST',
      body: JSON.stringify({ chatId, layerIds }),
    });
  }

  async toggleChatLayer(
    chatId: string,
    layerId: string,
    enabled: boolean,
  ): Promise<void> {
    await this.request('/v1/admin/roleplay/lore/chat-layers/toggle', {
      method: 'POST',
      body: JSON.stringify({ chatId, layerId, enabled }),
    });
  }

  async reorderChatLayers(
    chatId: string,
    layerIds: readonly string[],
  ): Promise<void> {
    await this.request('/v1/admin/roleplay/lore/chat-layers/reorder', {
      method: 'POST',
      body: JSON.stringify({ chatId, layerIds }),
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: this.headers(init.headers),
    });
    const envelope = (await response.json()) as ApiEnvelope<T>;
    if (!response.ok || !envelope.ok) {
      throw new Error(
        envelope.error?.message ??
          envelope.error?.reason_code ??
          `Roleplay lore request failed with ${response.status}`,
      );
    }
    if (envelope.data === undefined) {
      throw new Error('Roleplay lore response did not include data.');
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

export function provideLoreLayerApi(config: LoreLayerApiConfig): Provider[] {
  return [{ provide: LORE_LAYER_API_CONFIG, useValue: config }, LoreLayerApi];
}

export function mapLoreLayer(record: ApiRecord): LoreLayer {
  return {
    layerId:
      readString(record, 'layer_id') ?? readString(record, 'layerId') ?? '',
    profileId:
      readString(record, 'profile_id') ?? readString(record, 'profileId') ?? '',
    name: readString(record, 'name') ?? 'Untitled layer',
    description: readString(record, 'description') ?? '',
    purpose: readPurpose(readString(record, 'purpose')),
    writePolicy: readWritePolicy(
      readString(record, 'write_policy') ?? readString(record, 'writePolicy'),
    ),
    archived:
      readBoolean(record, 'is_archived') ??
      readBoolean(record, 'archived') ??
      false,
    entryCount:
      readNumber(record, 'entry_count') ??
      readNumber(record, 'entryCount') ??
      0,
    createdAt:
      readString(record, 'created_at') ?? readString(record, 'createdAt'),
    updatedAt:
      readString(record, 'updated_at') ?? readString(record, 'updatedAt'),
  };
}

export function mapChatLoreLayer(record: ApiRecord): ChatLoreLayer {
  const layer = optionalRecord(record['layer']);
  const layerRecord = layer === undefined ? record : { ...record, ...layer };
  return {
    ...mapLoreLayer(layerRecord),
    enabled: readBoolean(record, 'enabled') ?? true,
    priority: readNumber(record, 'priority') ?? 0,
  };
}

function requiredRecord(value: unknown, label: string): ApiRecord {
  if (typeof value === 'object' && value !== null) {
    return value as ApiRecord;
  }
  throw new Error(`Roleplay lore response ${label} was not an object.`);
}

function optionalRecord(value: unknown): ApiRecord | undefined {
  return typeof value === 'object' && value !== null
    ? (value as ApiRecord)
    : undefined;
}

function readString(record: ApiRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(record: ApiRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

function readBoolean(record: ApiRecord, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
}

function readPurpose(value: string | undefined): LoreLayerPurpose {
  switch (value) {
    case 'world':
    case 'story':
    case 'characters':
    case 'factions':
    case 'mixed':
      return value;
    default:
      return 'mixed';
  }
}

function readWritePolicy(value: string | undefined): LoreLayerWritePolicy {
  switch (value) {
    case 'manual':
    case 'auto_capture':
    case 'readonly':
      return value;
    default:
      return 'manual';
  }
}

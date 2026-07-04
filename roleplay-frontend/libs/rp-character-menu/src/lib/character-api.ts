import {
  inject,
  Injectable,
  InjectionToken,
  type Provider,
} from '@angular/core';

import type {
  CharacterUpdateRequest,
  CharacterWriteRequest,
  RpCharacter,
} from './character.model';

export interface CharacterApiConfig {
  readonly baseUrl: string;
  readonly bearerToken: string | undefined;
}

export const CHARACTER_API_CONFIG = new InjectionToken<CharacterApiConfig>(
  'CHARACTER_API_CONFIG',
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
export class CharacterApi {
  private readonly config = inject(CHARACTER_API_CONFIG);

  async listCharacters(profileId: string): Promise<readonly RpCharacter[]> {
    const data = await this.request<{
      readonly items?: readonly ApiRecord[];
      readonly characters?: readonly ApiRecord[];
    }>(this.profileCharactersPath(profileId));
    return (data.items ?? data.characters ?? []).map(mapCharacter);
  }

  async createCharacter(
    profileId: string,
    request: CharacterWriteRequest,
  ): Promise<RpCharacter> {
    const data = await this.request<{ readonly character?: ApiRecord }>(
      this.profileCharactersPath(profileId),
      {
        method: 'POST',
        body: JSON.stringify(characterBody(request)),
      },
    );
    return mapCharacter(requiredRecord(data.character, 'character'));
  }

  async updateCharacter(
    profileId: string,
    request: CharacterUpdateRequest,
  ): Promise<RpCharacter> {
    const data = await this.request<{ readonly character?: ApiRecord }>(
      `${this.profileCharactersPath(profileId)}/${encodeURIComponent(request.id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(characterBody(request.patch)),
      },
    );
    return mapCharacter(requiredRecord(data.character, 'character'));
  }

  async archiveCharacter(
    profileId: string,
    characterId: string,
  ): Promise<void> {
    await this.request(
      `${this.profileCharactersPath(profileId)}/${encodeURIComponent(characterId)}`,
      { method: 'DELETE' },
    );
  }

  async setSessionCharacter(
    sessionId: string,
    characterId: string,
  ): Promise<void> {
    await this.request(
      `/v1/admin/roleplay/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ characterId }),
      },
    );
  }

  private profileCharactersPath(profileId: string): string {
    return `/v1/admin/roleplay/profiles/${encodeURIComponent(profileId)}/characters`;
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
          `Roleplay character request failed with ${response.status}`,
      );
    }
    if (envelope.data === undefined) {
      throw new Error('Roleplay character response did not include data.');
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

export function provideCharacterApi(config: CharacterApiConfig): Provider[] {
  return [{ provide: CHARACTER_API_CONFIG, useValue: config }, CharacterApi];
}

export function mapCharacter(record: ApiRecord): RpCharacter {
  const description = readString(record, 'description') ?? '';
  return {
    id:
      readString(record, 'id') ??
      readString(record, 'character_id') ??
      readString(record, 'characterId') ??
      '',
    name: readString(record, 'name') ?? 'Untitled character',
    description,
    personality: readString(record, 'personality') ?? '',
    scenario: readString(record, 'scenario') ?? '',
    firstMessage:
      readString(record, 'firstMessage') ??
      readString(record, 'first_message') ??
      '',
    alternateGreetings: readStringArray(
      record['alternateGreetings'] ?? record['alternate_greetings'],
    ),
    exampleMessages: readStringArray(
      record['exampleMessages'] ?? record['example_messages'],
    ),
    tags: readStringArray(record['tags']),
    avatarUrl:
      readString(record, 'avatarUrl') ?? readString(record, 'avatar_url'),
    status: readString(record, 'status') === 'archived' ? 'archived' : 'active',
    createdAt:
      readString(record, 'createdAt') ?? readString(record, 'created_at'),
    updatedAt:
      readString(record, 'updatedAt') ?? readString(record, 'updated_at'),
    tagline: readString(record, 'tagline') ?? description,
  };
}

function characterBody(
  request: CharacterWriteRequest,
): Record<string, unknown> {
  return {
    ...(request.id === undefined ? {} : { id: request.id }),
    name: request.name,
    description: request.description,
    personality: request.personality,
    scenario: request.scenario,
    firstMessage: request.firstMessage,
    alternateGreetings: request.alternateGreetings,
    exampleMessages: request.exampleMessages,
    tags: request.tags,
    ...(request.avatarUrl === undefined
      ? {}
      : { avatarUrl: request.avatarUrl }),
  };
}

function requiredRecord(value: unknown, label: string): ApiRecord {
  if (typeof value === 'object' && value !== null) {
    return value as ApiRecord;
  }
  throw new Error(`Roleplay character response ${label} was not an object.`);
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

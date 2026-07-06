import { inject, Injectable } from '@angular/core';

import { BACKEND_CONFIG } from '../backend-config';
import {
  DEFAULT_NARRATOR_CONFIG,
  type NarratorConfig,
  type NarratorExplicitness,
  type NarratorMemoryDepth,
  type NarratorPacing,
  type NarratorTone,
} from './narrator-config.model';

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
export class NarratorConfigApi {
  private readonly config = inject(BACKEND_CONFIG);

  async readConfig(profileId: string): Promise<NarratorConfig> {
    const data = await this.request<{ readonly config?: ApiRecord }>(
      this.profileConfigPath(profileId),
    );
    return mapNarratorConfig(requiredRecord(data.config, 'config'));
  }

  async saveConfig(
    profileId: string,
    config: NarratorConfig,
  ): Promise<NarratorConfig> {
    const data = await this.request<{ readonly config?: ApiRecord }>(
      this.profileConfigPath(profileId),
      {
        method: 'PATCH',
        body: JSON.stringify(configBody(config)),
      },
    );
    return mapNarratorConfig(requiredRecord(data.config, 'config'));
  }

  private profileConfigPath(profileId: string): string {
    return `/v1/admin/roleplay/profiles/${encodeURIComponent(profileId)}/narrator-config`;
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
          `Narrator config request failed with ${response.status}`,
      );
    }
    if (envelope.data === undefined) {
      throw new Error('Narrator config response did not include data.');
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

export function mapNarratorConfig(record: ApiRecord): NarratorConfig {
  const review = readRecord(record['review']);
  return {
    tone: readTone(record['tone']) ?? DEFAULT_NARRATOR_CONFIG.tone,
    pacing: readPacing(record['pacing']) ?? DEFAULT_NARRATOR_CONFIG.pacing,
    explicitness:
      readExplicitness(record['explicitness']) ??
      DEFAULT_NARRATOR_CONFIG.explicitness,
    memoryDepth:
      readMemoryDepth(record['memoryDepth'] ?? record['memory_depth']) ??
      DEFAULT_NARRATOR_CONFIG.memoryDepth,
    exemplar: readString(record['exemplar']) ?? '',
    review: {
      enabled: readBoolean(review['enabled']),
      maxReviewCycles:
        readNumber(review['maxReviewCycles'] ?? review['max_review_cycles']) ??
        DEFAULT_NARRATOR_CONFIG.review.maxReviewCycles,
      checkGravityDrift:
        readOptionalBoolean(
          review['checkGravityDrift'] ?? review['check_gravity_drift'],
        ) ?? DEFAULT_NARRATOR_CONFIG.review.checkGravityDrift,
      checkCharacterVoice:
        readOptionalBoolean(
          review['checkCharacterVoice'] ?? review['check_character_voice'],
        ) ?? DEFAULT_NARRATOR_CONFIG.review.checkCharacterVoice,
      checkContinuity:
        readOptionalBoolean(
          review['checkContinuity'] ?? review['check_continuity'],
        ) ?? DEFAULT_NARRATOR_CONFIG.review.checkContinuity,
    },
  };
}

function configBody(config: NarratorConfig): Record<string, unknown> {
  return {
    tone: config.tone,
    pacing: config.pacing,
    explicitness: config.explicitness,
    memoryDepth: config.memoryDepth,
    exemplar: config.exemplar,
    review: {
      enabled: config.review.enabled,
      maxReviewCycles: config.review.maxReviewCycles,
      checkGravityDrift: config.review.checkGravityDrift,
      checkCharacterVoice: config.review.checkCharacterVoice,
      checkContinuity: config.review.checkContinuity,
    },
  };
}

function requiredRecord(value: unknown, label: string): ApiRecord {
  if (typeof value === 'object' && value !== null) {
    return value as ApiRecord;
  }
  throw new Error(`Narrator config response ${label} was not an object.`);
}

function readRecord(value: unknown): ApiRecord {
  return typeof value === 'object' && value !== null
    ? (value as ApiRecord)
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readTone(value: unknown): NarratorTone | undefined {
  return value === 'whimsical' ||
    value === 'dramatic' ||
    value === 'matter_of_fact' ||
    value === 'lush' ||
    value === 'wry'
    ? value
    : undefined;
}

function readPacing(value: unknown): NarratorPacing | undefined {
  return value === 'leisurely' ||
    value === 'balanced' ||
    value === 'rapid' ||
    value === 'breathless'
    ? value
    : undefined;
}

function readExplicitness(value: unknown): NarratorExplicitness | undefined {
  return value === 'implied' ||
    value === 'suggestive' ||
    value === 'romantic' ||
    value === 'steamy'
    ? value
    : undefined;
}

function readMemoryDepth(value: unknown): NarratorMemoryDepth | undefined {
  return value === 'shallow' || value === 'medium' || value === 'deep'
    ? value
    : undefined;
}

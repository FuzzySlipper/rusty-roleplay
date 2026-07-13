import { inject, Injectable } from '@angular/core';

import { BACKEND_CONFIG } from '../backend-config';

export interface PromptStackSection {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly sourceKind: string;
  readonly sourceId: string;
  readonly inclusionReason: string;
  readonly tokenEstimate: number;
  readonly editable: boolean;
  readonly derived: boolean;
}

export interface PromptStackTraceEntry {
  readonly sectionId: string;
  readonly sourceKind: string;
  readonly sourceId: string;
  readonly inclusionReason: string;
  readonly tokenEstimate: number;
  readonly editable: boolean;
  readonly derived: boolean;
}

export interface PromptStackMacroResolution {
  readonly macroName: string;
  readonly replacement: string;
  readonly occurrences: number;
}

export interface PromptStackPreview {
  readonly sessionId: string;
  readonly profileId: string;
  readonly promptContext: string;
  readonly compiledText: string;
  readonly sections: readonly PromptStackSection[];
  readonly trace: readonly PromptStackTraceEntry[];
  readonly macroResolutions: readonly PromptStackMacroResolution[];
  readonly importedPromptBlockCount: number;
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
export class PromptStackApi {
  private readonly backend = inject(BACKEND_CONFIG);

  async readPromptStack(sessionId: string): Promise<PromptStackPreview> {
    const response = await fetch(
      `${this.backend.rustyCrewBaseUrl}/v1/admin/roleplay/sessions/${encodeURIComponent(sessionId)}/prompt-stack`,
      { headers: this.headers() },
    );
    const envelope = (await response.json()) as ApiEnvelope<ApiRecord>;
    if (!response.ok || !envelope.ok) {
      throw new Error(
        envelope.error?.message ??
          envelope.error?.reason_code ??
          `Prompt stack request failed with ${response.status}`,
      );
    }
    if (envelope.data === undefined) {
      throw new Error('Prompt stack response did not include data.');
    }
    return mapPromptStackPreview(envelope.data);
  }

  private headers(): Headers {
    const headers = new Headers();
    if (this.backend.bearerToken !== undefined) {
      headers.set('authorization', `Bearer ${this.backend.bearerToken}`);
    }
    return headers;
  }
}

export function mapPromptStackPreview(record: ApiRecord): PromptStackPreview {
  const stack = optionalRecord(record['stack']);
  return {
    sessionId:
      readString(record, 'sessionId') ?? readString(record, 'session_id') ?? '',
    profileId:
      readString(record, 'profileId') ?? readString(record, 'profile_id') ?? '',
    promptContext:
      readString(record, 'promptContext') ??
      readString(record, 'prompt_context') ??
      '',
    compiledText:
      readString(stack, 'compiled_text') ??
      readString(stack, 'compiledText') ??
      '',
    sections: recordArray(stack?.['sections']).map(mapSection),
    trace: recordArray(stack?.['trace']).map(mapTrace),
    macroResolutions: recordArray(
      stack?.['macro_resolutions'] ?? stack?.['macroResolutions'],
    ).map(mapMacroResolution),
    importedPromptBlockCount: recordArray(
      stack?.['imported_prompt_blocks'] ?? stack?.['importedPromptBlocks'],
    ).length,
  };
}

function mapSection(record: ApiRecord): PromptStackSection {
  return {
    id: readString(record, 'id') ?? '',
    title: readString(record, 'title') ?? 'Untitled section',
    body: readString(record, 'body') ?? '',
    sourceKind:
      readString(record, 'source_kind') ?? readString(record, 'sourceKind') ?? '',
    sourceId:
      readString(record, 'source_id') ?? readString(record, 'sourceId') ?? '',
    inclusionReason:
      readString(record, 'inclusion_reason') ??
      readString(record, 'inclusionReason') ??
      '',
    tokenEstimate:
      readNumber(record, 'token_estimate') ??
      readNumber(record, 'tokenEstimate') ??
      0,
    editable: readBoolean(record, 'editable'),
    derived: readBoolean(record, 'derived'),
  };
}

function mapTrace(record: ApiRecord): PromptStackTraceEntry {
  return {
    sectionId:
      readString(record, 'section_id') ?? readString(record, 'sectionId') ?? '',
    sourceKind:
      readString(record, 'source_kind') ?? readString(record, 'sourceKind') ?? '',
    sourceId:
      readString(record, 'source_id') ?? readString(record, 'sourceId') ?? '',
    inclusionReason:
      readString(record, 'inclusion_reason') ??
      readString(record, 'inclusionReason') ??
      '',
    tokenEstimate:
      readNumber(record, 'token_estimate') ??
      readNumber(record, 'tokenEstimate') ??
      0,
    editable: readBoolean(record, 'editable'),
    derived: readBoolean(record, 'derived'),
  };
}

function mapMacroResolution(record: ApiRecord): PromptStackMacroResolution {
  return {
    macroName:
      readString(record, 'macro_name') ?? readString(record, 'macroName') ?? '',
    replacement: readString(record, 'replacement') ?? '',
    occurrences:
      readNumber(record, 'occurrences') ??
      readNumber(record, 'occurrenceCount') ??
      0,
  };
}

function optionalRecord(value: unknown): ApiRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as ApiRecord)
    : undefined;
}

function recordArray(value: unknown): readonly ApiRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is ApiRecord =>
          item !== null && typeof item === 'object' && !Array.isArray(item),
      )
    : [];
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
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : undefined;
}

function readBoolean(record: ApiRecord, key: string): boolean {
  return record[key] === true;
}

import { inject, Injectable } from '@angular/core';

import { BACKEND_CONFIG } from '../backend-config';

type JsonRecord = Record<string, unknown>;

export interface ContextProviderSummary {
  readonly displayName?: string | undefined;
  readonly modelId?: string | undefined;
  readonly contextWindowTokens?: number | undefined;
  readonly maxOutputTokens?: number | undefined;
}

export interface ContextUsageEstimate {
  readonly estimateQuality?: string | undefined;
  readonly estimateMethod?: string | undefined;
  readonly contextWindowTokens?: number | undefined;
  readonly estimatedPromptTokens?: number | undefined;
  readonly estimatedRemainingTokens?: number | undefined;
  readonly maxOutputTokens?: number | undefined;
  readonly reservedResponseTokens?: number | undefined;
  readonly safetyMarginTokens?: number | undefined;
  readonly usableInputTokens?: number | undefined;
  readonly sampledEventCount?: number | undefined;
  readonly sampledMessageCount?: number | undefined;
  readonly loreTokens?: number | undefined;
  readonly systemTokens?: number | undefined;
  readonly historyTokens?: number | undefined;
}

export interface ContextUsageResponse {
  readonly sessionId: string;
  readonly provider?: ContextProviderSummary | undefined;
  readonly context: ContextUsageEstimate;
}

@Injectable()
export class ContextApi {
  private readonly backend = inject(BACKEND_CONFIG);

  async readContext(sessionId: string): Promise<ContextUsageResponse> {
    const response = await fetch(this.url(`/v1/chat/sessions/${encodeURIComponent(sessionId)}/context`), {
      headers: this.headers(),
    });
    if (!response.ok) {
      throw new Error(`Context request failed (${response.status})`);
    }

    return mapContextUsageResponse(await response.json());
  }

  private url(path: string): string {
    return new URL(path, this.backend.rustyCrewBaseUrl).toString();
  }

  private headers(): Headers {
    const headers = new Headers();
    if (this.backend.bearerToken !== undefined) {
      headers.set('authorization', `Bearer ${this.backend.bearerToken}`);
    }
    return headers;
  }
}

export function mapContextUsageResponse(value: unknown): ContextUsageResponse {
  const record = asRecord(value) ?? {};
  const context = asRecord(record['context']);
  const provider = asRecord(record['provider']);

  return {
    sessionId: readString(record, 'session_id', 'sessionId') ?? '',
    provider:
      provider === undefined
        ? undefined
        : {
            displayName: readString(provider, 'display_name', 'displayName'),
            modelId: readString(provider, 'model_id', 'modelId'),
            contextWindowTokens: readNumber(provider, 'context_window_tokens', 'contextWindowTokens'),
            maxOutputTokens: readNumber(provider, 'max_output_tokens', 'maxOutputTokens'),
          },
    context: {
      estimateQuality: readString(context, 'estimate_quality', 'estimateQuality'),
      estimateMethod: readString(context, 'estimate_method', 'estimateMethod'),
      contextWindowTokens: readNumber(context, 'context_window_tokens', 'contextWindowTokens'),
      estimatedPromptTokens: readNumber(context, 'estimated_prompt_tokens', 'estimatedPromptTokens'),
      estimatedRemainingTokens: readNumber(context, 'estimated_remaining_tokens', 'estimatedRemainingTokens'),
      maxOutputTokens: readNumber(context, 'max_output_tokens', 'maxOutputTokens'),
      reservedResponseTokens: readNumber(context, 'reserved_response_tokens', 'reservedResponseTokens'),
      safetyMarginTokens: readNumber(context, 'safety_margin_tokens', 'safetyMarginTokens'),
      usableInputTokens: readNumber(context, 'usable_input_tokens', 'usableInputTokens'),
      sampledEventCount: readNumber(context, 'sampled_event_count', 'sampledEventCount'),
      sampledMessageCount: readNumber(context, 'sampled_message_count', 'sampledMessageCount'),
      loreTokens: readNumber(context, 'lore_tokens', 'loreTokens', 'recalled_lore_tokens', 'recalledLoreTokens'),
      systemTokens: readNumber(context, 'system_tokens', 'systemTokens', 'system_prompt_tokens', 'systemPromptTokens'),
      historyTokens: readNumber(context, 'history_tokens', 'historyTokens', 'conversation_history_tokens', 'conversationHistoryTokens'),
    },
  };
}

function asRecord(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : undefined;
}

function readString(record: JsonRecord | undefined, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function readNumber(record: JsonRecord | undefined, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.round(value));
    }
  }
  return undefined;
}

import { inject, Injectable } from '@angular/core';
import type {
  ChatMessage,
  MessageAlternateSlot,
  MessageRole,
  MessageVariant,
} from '@rusty-view/chat-domain';

import { BACKEND_CONFIG } from '../backend-config';
import { mapRoleplaySession } from './roleplay-session-api';
import type { RoleplaySessionSummary } from './roleplay-session.model';

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
export class RoleplayBranchingApi {
  private readonly config = inject(BACKEND_CONFIG);

  async readTerminalAlternatives(
    sessionId: string,
  ): Promise<MessageAlternateSlot | null> {
    const data = await this.request<{ readonly slot?: ApiRecord }>(
      `/v1/admin/roleplay/sessions/${encodeURIComponent(sessionId)}/alternatives`,
    );
    return isRecord(data.slot) ? mapAlternateSlot(data.slot, sessionId) : null;
  }

  async selectAlternative(
    sessionId: string,
    slotId: string,
    variantId: string | undefined,
  ): Promise<MessageAlternateSlot> {
    const data = await this.request<{ readonly slot?: ApiRecord }>(
      `/v1/admin/roleplay/sessions/${encodeURIComponent(sessionId)}/alternatives/${encodeURIComponent(slotId)}/select`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...(variantId === undefined ? {} : { activeVariantId: variantId }),
        }),
      },
    );
    return mapAlternateSlot(requiredRecord(data.slot, 'slot'), sessionId);
  }

  async generateAlternative(
    sessionId: string,
    slotId: string | undefined,
    instructions: string | undefined,
  ): Promise<MessageAlternateSlot> {
    const data = await this.request<{ readonly slot?: ApiRecord }>(
      `/v1/admin/roleplay/sessions/${encodeURIComponent(sessionId)}/alternatives/generate`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...(slotId === undefined ? {} : { slotId }),
          ...(instructions === undefined ? {} : { instructions }),
        }),
      },
    );
    return mapAlternateSlot(requiredRecord(data.slot, 'slot'), sessionId);
  }

  async forkSession(
    sessionId: string,
    messageId: string,
    displayName: string | undefined,
  ): Promise<RoleplaySessionSummary> {
    const data = await this.request<{ readonly session?: ApiRecord }>(
      `/v1/admin/roleplay/sessions/${encodeURIComponent(sessionId)}/fork`,
      {
        method: 'POST',
        body: JSON.stringify({
          messageId,
          ...(displayName === undefined ? {} : { displayName }),
        }),
      },
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
          `Roleplay branching request failed with ${response.status}`,
      );
    }
    if (envelope.data === undefined) {
      throw new Error('Roleplay branching response did not include data.');
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

export function mapAlternateSlot(
  record: ApiRecord,
  fallbackSessionId = '',
): MessageAlternateSlot {
  const id = readString(record, 'id') ?? readString(record, 'slot_id') ?? '';
  const sessionId =
    readString(record, 'session_id') ??
    readString(record, 'sessionId') ??
    fallbackSessionId;
  const primary = mapVariant(
    requiredRecord(record['primary'], 'primary'),
    id,
    sessionId,
    'primary',
  );
  return {
    id,
    sessionId,
    primary,
    alternates: readRecords(record['alternates']).map((variant, index) =>
      mapVariant(variant, id, sessionId, 'alternate', index + 1),
    ),
    activeVariantId:
      readString(record, 'active_variant_id') ??
      readString(record, 'activeVariantId'),
    ...optional('metadata', metadataRecord(record)),
  };
}

function mapVariant(
  record: ApiRecord,
  slotId: string,
  sessionId: string,
  fallbackSource: MessageVariant['source'],
  fallbackOrdinal = 0,
): MessageVariant {
  const messageRecord = isRecord(record['message']) ? record['message'] : record;
  const source = readString(record, 'source');
  return {
    id: readString(record, 'id') ?? readString(record, 'variant_id') ?? '',
    slotId:
      readString(record, 'slot_id') ?? readString(record, 'slotId') ?? slotId,
    source: source === 'primary' || source === 'alternate' ? source : fallbackSource,
    ordinal:
      readNumber(record, 'ordinal') ??
      (fallbackSource === 'primary' ? 0 : fallbackOrdinal),
    message: mapMessage(messageRecord, sessionId),
    ...optional('metadata', metadataRecord(record)),
  };
}

function mapMessage(record: ApiRecord, sessionId: string): ChatMessage {
  const messageId =
    readString(record, 'id') ??
    readString(record, 'message_id') ??
    readString(record, 'messageId') ??
    '';
  const body = readString(record, 'body') ?? readString(record, 'content') ?? '';
  return {
    id: messageId,
    sessionId:
      readString(record, 'session_id') ?? readString(record, 'sessionId') ?? sessionId,
    author: {
      role: readRole(record) ?? 'assistant',
      displayName:
        readString(record, 'display_name') ?? readString(record, 'displayName'),
    },
    createdAt:
      readString(record, 'created_at') ??
      readString(record, 'createdAt') ??
      new Date().toISOString(),
    status: readString(record, 'status') === 'streaming' ? 'streaming' : 'completed',
    blocks: blocksFor(record, messageId, body),
    tree: {
      branchId:
        readString(record, 'branch_id') ?? readString(record, 'branchId'),
      parentMessageId:
        readString(record, 'parent_message_id') ??
        readString(record, 'parentMessageId'),
      previousMessageId:
        readString(record, 'previous_message_id') ??
        readString(record, 'previousMessageId'),
      snapshotIds: [],
    },
    ...optional('metadata', metadataRecord(record)),
  };
}

function mapBlock(
  record: ApiRecord,
  messageId: string,
  index: number,
): ChatMessage['blocks'][number] {
  return {
    id: readString(record, 'id') ?? `${messageId}-block-${index}`,
    messageId,
    kind: readString(record, 'kind') ?? 'text',
    content: readString(record, 'content') ?? readString(record, 'body') ?? '',
    estimatedHeight: undefined,
    renderPolicy: 'full',
    ...optional('metadata', metadataRecord(record)),
  };
}

function blocksFor(
  record: ApiRecord,
  messageId: string,
  body: string,
): ChatMessage['blocks'] {
  const blocks = readRecords(record['blocks']).map((block, index) =>
    mapBlock(block, messageId, index),
  );
  return blocks.length > 0 ? blocks : [textBlock(messageId, body)];
}

function textBlock(messageId: string, content: string): ChatMessage['blocks'][number] {
  return {
    id: `${messageId}-body`,
    messageId,
    kind: 'text',
    content,
    estimatedHeight: undefined,
    renderPolicy: 'full',
  };
}

function readRole(record: ApiRecord): MessageRole | undefined {
  const role =
    readString(record, 'author_role') ??
    readString(record, 'authorRole') ??
    readString(record, 'role');
  return role === 'user' || role === 'assistant' || role === 'system' || role === 'tool'
    ? role
    : undefined;
}

function requiredRecord(value: unknown, label: string): ApiRecord {
  if (isRecord(value)) {
    return value;
  }
  throw new Error(`Roleplay branching response ${label} was not an object.`);
}

function readRecords(value: unknown): readonly ApiRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function readString(record: ApiRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(record: ApiRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

function isRecord(value: unknown): value is ApiRecord {
  return typeof value === 'object' && value !== null;
}

function metadataRecord(record: ApiRecord): ApiRecord | undefined {
  if (isRecord(record['metadata_json'])) {
    return record['metadata_json'];
  }
  return isRecord(record['metadata']) ? record['metadata'] : undefined;
}

function optional<K extends string, V>(
  key: K,
  value: V | undefined,
): { readonly [P in K]: V } | Record<string, never> {
  return value === undefined ? {} : ({ [key]: value } as { readonly [P in K]: V });
}

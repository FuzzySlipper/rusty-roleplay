import {
  inject,
  Injectable,
  InjectionToken,
  type Provider,
} from '@angular/core';

import { LoreEntry } from './lore.model';
import { LORE_SOURCE, LoreCampaignSummary, LoreSource } from './lore-source';

export interface LoreEntryApiConfig {
  readonly baseUrl: string;
  readonly bearerToken: string | undefined;
}

export interface LoreEntrySearchOptions {
  readonly profileId?: string;
  readonly chatId?: string;
  readonly layerIds?: readonly string[];
  readonly limit?: number;
  readonly offset?: number;
}

export interface LoreEntrySearchResult {
  readonly entries: readonly LoreEntry[];
  readonly total: number;
  readonly totalExact: boolean;
  readonly hasMore: boolean;
  readonly limit: number;
  readonly offset: number;
}

export interface LoreEntryDetailOptions {
  readonly profileId?: string;
  readonly chatId?: string;
  readonly layerIds?: readonly string[];
}

export interface LoreEntryWriteRequest {
  readonly title: string;
  readonly body: string;
  readonly tags: readonly string[];
  readonly canonLevel: string;
}

export interface LoreEntryCreateRequest extends LoreEntryWriteRequest {
  readonly layerId: string;
  readonly worldId: string;
  readonly entityId?: string;
}

export interface LoreEntryUpdateRequest extends LoreEntryWriteRequest {
  readonly recordId: string;
  readonly expectedRevision: number;
  readonly scope?: LoreEntryDetailOptions;
}

export interface PromoteLoreEntryRequest {
  readonly entryId: string;
  readonly sourceLayerId: string;
  readonly targetLayerId: string;
}

export const LORE_ENTRY_API_CONFIG = new InjectionToken<LoreEntryApiConfig>(
  'LORE_ENTRY_API_CONFIG',
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
export class LoreEntryApi implements LoreSource {
  private readonly config = inject(LORE_ENTRY_API_CONFIG);

  async searchEntries(
    _campaignId: string,
    query: string,
    options: LoreEntrySearchOptions = {},
  ): Promise<readonly LoreEntry[]> {
    return (await this.searchEntryPage(query, options)).entries;
  }

  async searchEntryPage(
    query: string,
    options: LoreEntrySearchOptions = {},
  ): Promise<LoreEntrySearchResult> {
    const params = new URLSearchParams();
    const trimmed = query.trim();
    if (trimmed.length > 0) {
      params.set('q', trimmed);
    }
    if (options.profileId !== undefined) {
      params.set('profile_id', options.profileId);
    }
    if (options.chatId !== undefined) {
      params.set('chat_id', options.chatId);
    }
    for (const layerId of options.layerIds ?? []) {
      params.append('layer_id', layerId);
    }
    params.set('limit', String(options.limit ?? 50));
    params.set('offset', String(options.offset ?? 0));

    const data = await this.request<{
      readonly entries?: readonly ApiRecord[];
      readonly total?: number;
      readonly totalExact?: boolean;
      readonly hasMore?: boolean;
      readonly limit?: number;
      readonly offset?: number;
    }>(`/v1/admin/roleplay/lore/entries/search?${params.toString()}`);

    return {
      entries: (data.entries ?? []).map(mapLoreEntry),
      total: typeof data.total === 'number' ? data.total : 0,
      totalExact: data.totalExact === true,
      hasMore: data.hasMore === true,
      limit:
        typeof data.limit === 'number' ? data.limit : (options.limit ?? 50),
      offset:
        typeof data.offset === 'number' ? data.offset : (options.offset ?? 0),
    };
  }

  async getEntry(campaignId: string, slug: string): Promise<LoreEntry | null> {
    void campaignId;
    return this.readEntry(slug);
  }

  async readEntry(
    recordId: string,
    options: LoreEntryDetailOptions = {},
  ): Promise<LoreEntry | null> {
    const params = detailParams(options);
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    const data = await this.request<{
      readonly entry?: ApiRecord;
      readonly provenance?: readonly ApiRecord[];
      readonly supersession?: ApiRecord;
    }>(
      `/v1/admin/roleplay/lore/entries/${encodeURIComponent(recordId)}${suffix}`,
    );
    if (data.entry === undefined) {
      return null;
    }
    return mapLoreEntryDetail(data);
  }

  async createEntry(request: LoreEntryCreateRequest): Promise<LoreEntry> {
    const data = await this.request<{
      readonly entry?: ApiRecord;
      readonly provenance?: readonly ApiRecord[];
      readonly supersession?: ApiRecord;
    }>('/v1/admin/roleplay/lore/entries', {
      method: 'POST',
      body: JSON.stringify({
        layer_id: request.layerId,
        write: loreWriteFromRequest(request),
      }),
    });
    return mapRequiredLoreEntryDetail(data);
  }

  async listLayerEntries(layerId: string): Promise<readonly LoreEntry[]> {
    const data = await this.request<{
      readonly entries?: readonly ApiRecord[];
    }>(`/v1/admin/roleplay/lore/layers/${encodeURIComponent(layerId)}/entries`);
    return (data.entries ?? []).map((entry) =>
      annotateLoreEntryLayer(mapLoreEntry(entry), layerId),
    );
  }

  async updateEntry(request: LoreEntryUpdateRequest): Promise<LoreEntry> {
    const params = detailParams(request.scope ?? {});
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    const data = await this.request<{
      readonly entry?: ApiRecord;
      readonly provenance?: readonly ApiRecord[];
      readonly supersession?: ApiRecord;
    }>(
      `/v1/admin/roleplay/lore/entries/${encodeURIComponent(request.recordId)}${suffix}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          expected_revision: request.expectedRevision,
          ...loreWriteFromRequest(request),
        }),
      },
    );
    return mapRequiredLoreEntryDetail(data);
  }

  async promoteEntry(request: PromoteLoreEntryRequest): Promise<LoreEntry> {
    const data = await this.request<{
      readonly entry?: ApiRecord;
      readonly provenance?: readonly ApiRecord[];
      readonly supersession?: ApiRecord;
      readonly layerEntries?: readonly ApiRecord[];
      readonly layers?: readonly ApiRecord[];
    }>(
      `/v1/admin/roleplay/lore/entries/${encodeURIComponent(request.entryId)}/promote`,
      {
        method: 'POST',
        body: JSON.stringify({
          sourceLayerId: request.sourceLayerId,
          targetLayerId: request.targetLayerId,
        }),
      },
    );
    return mapRequiredLoreEntryDetail(data);
  }

  async listCampaigns(
    profileId: string,
  ): Promise<readonly LoreCampaignSummary[]> {
    return [{ id: profileId, name: profileId }];
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
          `Roleplay lore entry request failed with ${response.status}`,
      );
    }
    if (envelope.data === undefined) {
      throw new Error('Roleplay lore entry response did not include data.');
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

export function provideLoreEntryApi(config: LoreEntryApiConfig): Provider[] {
  return [
    { provide: LORE_ENTRY_API_CONFIG, useValue: config },
    LoreEntryApi,
    { provide: LORE_SOURCE, useExisting: LoreEntryApi },
  ];
}

export function mapLoreEntry(record: ApiRecord): LoreEntry {
  const content = readRecord(record['content']);
  const metadata = readRecord(content['metadata_json']);
  const evidenceRefs = readRecordArray(record['evidence_refs']);
  const firstEvidence = evidenceRefs[0] ?? {};
  const recordId =
    readString(record, 'record_id') ??
    readString(record, 'recordId') ??
    readString(content, 'record_id') ??
    '';
  const title =
    readString(record, 'title') ??
    readString(content, 'title') ??
    'Untitled lore entry';
  const body =
    readString(record, 'body') ??
    readString(content, 'body') ??
    readString(record, 'summary') ??
    '';
  return {
    recordId,
    revision:
      readNumber(record, 'revision') ?? readNumber(content, 'revision') ?? 0,
    layerIds: [],
    sourceLayerId: undefined,
    sourceLayerWritePolicy: undefined,
    slug: recordId,
    title,
    summary: summaryFrom(body, title),
    body,
    canonLevel: canonLevelFrom(
      readString(record, 'status'),
      readString(record, 'canon_status') ?? readString(content, 'canon_status'),
    ),
    tags: readStringArray(
      content['tags'] ?? metadata['tags'] ?? record['tags'],
    ),
    capturedBy:
      readString(record, 'source') ?? readString(content, 'source') ?? '',
    captureReason:
      readString(record, 'durability_rationale') ??
      readString(record, 'capture_reason') ??
      readString(firstEvidence, 'label') ??
      '',
    capturedAt:
      readString(record, 'created_at') ?? readString(record, 'createdAt') ?? '',
    supersedesRecordId:
      readString(record, 'supersedes_record_id') ??
      readString(record, 'supersedesRecordId') ??
      '',
    supersededByRecordId:
      readString(record, 'superseded_by_record_id') ??
      readString(record, 'supersededByRecordId') ??
      '',
  };
}

export function mapLoreEntryDetail(data: {
  readonly entry?: ApiRecord;
  readonly provenance?: readonly ApiRecord[];
  readonly supersession?: ApiRecord;
  readonly layerEntries?: readonly ApiRecord[];
  readonly layers?: readonly ApiRecord[];
}): LoreEntry | null {
  if (data.entry === undefined) {
    return null;
  }
  const entry = mapLoreEntry(data.entry);
  const provenance = data.provenance ?? [];
  const firstProvenance = provenance[0] ?? {};
  const supersession = readRecord(data.supersession);
  const layerEntries = data.layerEntries ?? [];
  const layers = data.layers ?? [];
  const layerIds = layerEntries
    .map((layerEntry) => readString(layerEntry, 'layer_id'))
    .filter((layerId): layerId is string => layerId !== undefined);
  const sourceLayerId = layerIds[0];
  const sourceLayer = layers.find(
    (layer) =>
      readString(layer, 'layer_id') === sourceLayerId ||
      readString(layer, 'layerId') === sourceLayerId,
  );
  return {
    ...entry,
    layerIds,
    sourceLayerId,
    sourceLayerWritePolicy:
      readString(sourceLayer ?? {}, 'write_policy') ??
      readString(sourceLayer ?? {}, 'writePolicy') ??
      entry.sourceLayerWritePolicy,
    capturedBy:
      readString(firstProvenance, 'actor') ??
      readString(firstProvenance, 'source') ??
      entry.capturedBy,
    captureReason: readString(firstProvenance, 'note') ?? entry.captureReason,
    capturedAt:
      readString(firstProvenance, 'created_at') ??
      readString(firstProvenance, 'createdAt') ??
      entry.capturedAt,
    supersedesRecordId:
      readString(supersession, 'supersedesRecordId') ??
      readString(supersession, 'supersedes_record_id') ??
      entry.supersedesRecordId,
    supersededByRecordId:
      readString(supersession, 'supersededByRecordId') ??
      readString(supersession, 'superseded_by_record_id') ??
      entry.supersededByRecordId,
  };
}

function mapRequiredLoreEntryDetail(data: {
  readonly entry?: ApiRecord;
  readonly provenance?: readonly ApiRecord[];
  readonly supersession?: ApiRecord;
  readonly layerEntries?: readonly ApiRecord[];
  readonly layers?: readonly ApiRecord[];
}): LoreEntry {
  const entry = mapLoreEntryDetail(data);
  if (entry === null) {
    throw new Error('Roleplay lore entry response did not include an entry.');
  }
  return entry;
}

export function annotateLoreEntryLayer(
  entry: LoreEntry,
  layerId: string,
  writePolicy?: string,
): LoreEntry {
  return {
    ...entry,
    layerIds: entry.layerIds.includes(layerId)
      ? entry.layerIds
      : [...entry.layerIds, layerId],
    sourceLayerId: entry.sourceLayerId ?? layerId,
    sourceLayerWritePolicy: entry.sourceLayerWritePolicy ?? writePolicy,
  };
}

function detailParams(options: LoreEntryDetailOptions): URLSearchParams {
  const params = new URLSearchParams();
  if (options.profileId !== undefined) {
    params.set('profile_id', options.profileId);
  }
  if (options.chatId !== undefined) {
    params.set('chat_id', options.chatId);
  }
  for (const layerId of options.layerIds ?? []) {
    params.append('layer_id', layerId);
  }
  return params;
}

function loreWriteFromRequest(
  request: LoreEntryWriteRequest & {
    readonly worldId?: string;
    readonly entityId?: string;
  },
): ApiRecord {
  const content = {
    title: request.title,
    body: request.body,
    canon_status: canonStatusFromLevel(request.canonLevel),
    tags: request.tags,
    metadata_json: { tags: request.tags },
  };
  return {
    ...(request.worldId !== undefined ? { world_id: request.worldId } : {}),
    ...(request.entityId !== undefined ? { entity_id: request.entityId } : {}),
    title: request.title,
    body: request.body,
    canon_status: canonStatusFromLevel(request.canonLevel),
    visibility: 'public',
    content,
  };
}

function summaryFrom(body: string, fallback: string): string {
  const text = body.trim() || fallback;
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function canonLevelFrom(
  status: string | undefined,
  canonStatus: string | undefined,
): string {
  if (status === 'superseded') {
    return 'superseded';
  }
  if (status === 'tombstoned') {
    return 'retired';
  }
  if (canonStatus === 'draft' || canonStatus === 'contested') {
    return 'speculative';
  }
  if (canonStatus === 'deprecated') {
    return 'retired';
  }
  return 'established';
}

function canonStatusFromLevel(canonLevel: string): string {
  switch (canonLevel) {
    case 'speculative':
      return 'draft';
    case 'retired':
    case 'superseded':
      return 'deprecated';
    case 'established':
    default:
      return 'canon';
  }
}

function readRecord(value: unknown): ApiRecord {
  return typeof value === 'object' && value !== null
    ? (value as ApiRecord)
    : {};
}

function readRecordArray(value: unknown): readonly ApiRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is ApiRecord => typeof item === 'object' && item !== null,
  );
}

function readString(record: ApiRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(record: ApiRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

function readStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

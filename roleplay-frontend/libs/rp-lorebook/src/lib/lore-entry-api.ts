import {
  inject,
  Injectable,
  InjectionToken,
  type Provider,
} from '@angular/core';

import {
  DEFAULT_LORE_CONTROLS,
  DEFAULT_LORE_CONTROL_SUPPORT,
  LoreControls,
  LoreEntry,
  type LoreInsertionPosition,
  type LoreRetrievalRole,
} from './lore.model';
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
  readonly loreControls?: LoreControls;
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
    const entry = mapRequiredLoreEntryDetail(data);
    const layerId = request.scope?.layerIds?.[0] ?? entry.sourceLayerId;
    if (request.loreControls !== undefined && layerId !== undefined) {
      return this.updateLayerEntryControls(
        layerId,
        request.recordId,
        request.loreControls,
        request.scope,
      );
    }
    return entry;
  }

  async updateLayerEntryControls(
    layerId: string,
    recordId: string,
    controls: Pick<LoreControls, 'constant' | 'insertionOrder'>,
    scope: LoreEntryDetailOptions = {},
  ): Promise<LoreEntry> {
    await this.request<{
      readonly layerEntry?: ApiRecord;
    }>(
      `/v1/admin/roleplay/lore/layers/${encodeURIComponent(layerId)}/entries/${encodeURIComponent(recordId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          constant: controls.constant,
          insertion_order: controls.insertionOrder,
        }),
      },
    );
    const refreshed = await this.readEntry(recordId, {
      ...scope,
      layerIds: scope.layerIds ?? [layerId],
    });
    if (refreshed === null) {
      throw new Error('Roleplay lore entry was not readable after save.');
    }
    return refreshed;
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
  const nestedRecord = readRecord(record['record']);
  const source =
    Object.keys(nestedRecord).length > 0 ? nestedRecord : record;
  const content = readRecord(source['content']);
  const metadata = readRecord(content['metadata_json']);
  const evidenceRefs = readRecordArray(source['evidence_refs']);
  const firstEvidence = evidenceRefs[0] ?? {};
  const recordId =
    readString(source, 'record_id') ??
    readString(source, 'recordId') ??
    readString(content, 'record_id') ??
    readString(record, 'record_id') ??
    readString(record, 'recordId') ??
    '';
  const title =
    readString(source, 'title') ??
    readString(content, 'title') ??
    'Untitled lore entry';
  const body =
    readString(source, 'body') ??
    readString(content, 'body') ??
    readString(source, 'summary') ??
    '';
  return {
    recordId,
    revision:
      readNumber(source, 'revision') ?? readNumber(content, 'revision') ?? 0,
    layerIds:
      readString(record, 'layer_id') === undefined
        ? []
        : [readString(record, 'layer_id') ?? ''],
    sourceLayerId: readString(record, 'layer_id'),
    sourceLayerWritePolicy: undefined,
    slug: recordId,
    title,
    summary: summaryFrom(body, title),
    body,
    canonLevel: canonLevelFrom(
      readString(source, 'status'),
      readString(source, 'canon_status') ?? readString(content, 'canon_status'),
    ),
    tags: readStringArray(
      content['tags'] ?? metadata['tags'] ?? source['tags'],
    ),
    loreControls: mapLoreControls(source, record),
    capturedBy:
      readString(source, 'source') ?? readString(content, 'source') ?? '',
    captureReason:
      readString(source, 'durability_rationale') ??
      readString(source, 'capture_reason') ??
      readString(firstEvidence, 'label') ??
      '',
    capturedAt:
      readString(source, 'created_at') ??
      readString(source, 'createdAt') ??
      '',
    supersedesRecordId:
      readString(source, 'supersedes_record_id') ??
      readString(source, 'supersedesRecordId') ??
      '',
    supersededByRecordId:
      readString(source, 'superseded_by_record_id') ??
      readString(source, 'supersededByRecordId') ??
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
    loreControls:
      layerEntries.length === 0
        ? entry.loreControls
        : mapLoreControls(data.entry, layerEntries[0]),
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
    ...(request.loreControls !== undefined
      ? { lore_controls: loreControlsToApi(request.loreControls) }
      : {}),
  };
  return {
    ...(request.worldId !== undefined ? { world_id: request.worldId } : {}),
    ...(request.entityId !== undefined ? { entity_id: request.entityId } : {}),
    title: request.title,
    body: request.body,
    canon_status: canonStatusFromLevel(request.canonLevel),
    visibility: 'public',
    ...(request.loreControls !== undefined
      ? {
          ...loreControlsToApi(request.loreControls),
          lore_controls: loreControlsToApi(request.loreControls),
        }
      : {}),
    content,
  };
}

function mapLoreControls(
  entry: ApiRecord,
  layerEntry: ApiRecord = {},
): LoreControls {
  const content = readRecord(entry['content']);
  const directControls = readRecord(entry['lore_controls']);
  const contentControls = readRecord(content['lore_controls']);
  const layerControls = readRecord(layerEntry['lore_controls']);
  const raw = {
    ...contentControls,
    ...directControls,
    ...layerControls,
    ...controlFieldsFromRecord(entry),
    ...controlFieldsFromRecord(layerEntry),
  };
  const support = {
    ...DEFAULT_LORE_CONTROL_SUPPORT,
    ...mapControlSupport(
      readRecord(entry['lore_control_support']),
      readRecord(layerEntry['lore_control_support']),
    ),
  };
  return {
    primaryKeys: readStringArray(raw['primary_keys'] ?? raw['primaryKeys']),
    secondaryKeys: readStringArray(
      raw['secondary_keys'] ?? raw['secondaryKeys'],
    ),
    enabled: readBoolean(raw, 'enabled') ?? DEFAULT_LORE_CONTROLS.enabled,
    constant: readBoolean(raw, 'constant') ?? DEFAULT_LORE_CONTROLS.constant,
    scanDepth: clampInteger(
      readNumber(raw, 'scan_depth') ?? readNumber(raw, 'scanDepth'),
      DEFAULT_LORE_CONTROLS.scanDepth,
      0,
      200,
    ),
    insertionPosition: insertionPositionFrom(
      readString(raw, 'insertion_position') ??
        readString(raw, 'insertionPosition'),
    ),
    insertionOrder: clampInteger(
      readNumber(raw, 'insertion_order') ?? readNumber(raw, 'insertionOrder'),
      DEFAULT_LORE_CONTROLS.insertionOrder,
      -1_000_000,
      1_000_000,
    ),
    probability: clampNumber(
      readNumber(raw, 'probability'),
      DEFAULT_LORE_CONTROLS.probability,
      0,
      1,
    ),
    retrievalRole: retrievalRoleFrom(
      readString(raw, 'retrieval_role') ?? readString(raw, 'retrievalRole'),
    ),
    support,
  };
}

function controlFieldsFromRecord(record: ApiRecord): ApiRecord {
  return {
    ...(record['primary_keys'] !== undefined
      ? { primary_keys: record['primary_keys'] }
      : {}),
    ...(record['secondary_keys'] !== undefined
      ? { secondary_keys: record['secondary_keys'] }
      : {}),
    ...(record['enabled'] !== undefined ? { enabled: record['enabled'] } : {}),
    ...(record['constant'] !== undefined
      ? { constant: record['constant'] }
      : {}),
    ...(record['scan_depth'] !== undefined
      ? { scan_depth: record['scan_depth'] }
      : {}),
    ...(record['insertion_position'] !== undefined
      ? { insertion_position: record['insertion_position'] }
      : {}),
    ...(record['insertion_order'] !== undefined
      ? { insertion_order: record['insertion_order'] }
      : {}),
    ...(record['probability'] !== undefined
      ? { probability: record['probability'] }
      : {}),
    ...(record['retrieval_role'] !== undefined
      ? { retrieval_role: record['retrieval_role'] }
      : {}),
  };
}

function mapControlSupport(
  entrySupport: ApiRecord,
  layerSupport: ApiRecord,
): Partial<LoreControls['support']> {
  const support = { ...entrySupport, ...layerSupport };
  const mapped: Partial<Record<keyof LoreControls['support'], string>> = {};
  copySupport(support, mapped, 'primary_keys', 'primaryKeys');
  copySupport(support, mapped, 'secondary_keys', 'secondaryKeys');
  copySupport(support, mapped, 'enabled', 'enabled');
  copySupport(support, mapped, 'constant', 'constant');
  copySupport(support, mapped, 'scan_depth', 'scanDepth');
  copySupport(support, mapped, 'insertion_position', 'insertionPosition');
  copySupport(support, mapped, 'insertion_order', 'insertionOrder');
  copySupport(support, mapped, 'probability', 'probability');
  copySupport(support, mapped, 'retrieval_role', 'retrievalRole');
  return mapped;
}

function copySupport(
  source: ApiRecord,
  target: Partial<Record<keyof LoreControls['support'], string>>,
  sourceKey: string,
  targetKey: keyof LoreControls['support'],
): void {
  const value = readString(source, sourceKey);
  if (value !== undefined) {
    target[targetKey] = value;
  }
}

function loreControlsToApi(controls: LoreControls): ApiRecord {
  return {
    primary_keys: controls.primaryKeys,
    secondary_keys: controls.secondaryKeys,
    enabled: controls.enabled,
    constant: controls.constant,
    scan_depth: controls.scanDepth,
    insertion_position: controls.insertionPosition,
    insertion_order: controls.insertionOrder,
    probability: controls.probability,
    retrieval_role: controls.retrievalRole,
  };
}

function insertionPositionFrom(
  value: string | undefined,
): LoreInsertionPosition {
  switch (value) {
    case 'before_history':
    case 'after_history':
    case 'before_author_note':
    case 'after_author_note':
    case 'system':
    case 'lore_block':
      return value;
    default:
      return DEFAULT_LORE_CONTROLS.insertionPosition;
  }
}

function retrievalRoleFrom(value: string | undefined): LoreRetrievalRole {
  switch (value) {
    case 'system':
    case 'user':
    case 'assistant':
    case 'narrator':
      return value;
    default:
      return DEFAULT_LORE_CONTROLS.retrievalRole;
  }
}

function clampInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || !Number.isSafeInteger(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function clampNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
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

function readBoolean(record: ApiRecord, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
}

function readStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

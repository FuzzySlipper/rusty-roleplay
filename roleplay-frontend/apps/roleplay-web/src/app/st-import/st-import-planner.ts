export type StImportArtifactKind =
  | 'manifest'
  | 'character_card'
  | 'persona'
  | 'lorebook'
  | 'preset'
  | 'transcript'
  | 'rendered_prompt'
  | 'unknown';

export interface StImportArtifact {
  readonly kind: StImportArtifactKind;
  readonly fileName: string;
  readonly size: number;
  readonly sha256: string;
  readonly parsed?: unknown;
  readonly text?: string;
}

export interface StImportPlanOptions {
  readonly profileId: string;
  readonly importId?: string;
  readonly sessionId?: string;
}

export interface StImportPlanSummary {
  readonly artifacts: readonly {
    readonly fileName: string;
    readonly kind: StImportArtifactKind;
  }[];
  readonly firstClassFields: readonly string[];
  readonly preservedMetadata: readonly string[];
  readonly notDuplicatedRuntimeCeremony: readonly string[];
  readonly counts: {
    readonly characters: number;
    readonly personas: number;
    readonly loreEntries: number;
    readonly transcriptRows: number;
    readonly assistantRows: number;
    readonly assistantVariantRows: number;
  };
  readonly warnings: readonly string[];
}

export interface StImportPlan {
  readonly profileId: string;
  readonly importId: string;
  readonly provenance: Record<string, unknown>;
  readonly rawSource: Record<string, unknown>;
  readonly character?: Record<string, unknown>;
  readonly persona?: Record<string, unknown>;
  readonly loreLayer?: Record<string, unknown>;
  readonly loreEntries: readonly Record<string, unknown>[];
  readonly session?: Record<string, unknown>;
  readonly transcriptMetadata?: Record<string, unknown>;
  readonly transcriptRows: readonly Record<string, unknown>[];
  readonly importSummary: StImportPlanSummary;
}

type JsonRecord = Record<string, unknown>;

export async function buildStImportPlanFromFiles(
  files: readonly File[],
  options: StImportPlanOptions,
): Promise<StImportPlan> {
  return buildStImportPlan(await Promise.all(files.map(readArtifact)), options);
}

export function buildStImportPlan(
  artifacts: readonly StImportArtifact[],
  options: StImportPlanOptions,
): StImportPlan {
  const manifest = firstParsedRecord(artifacts, 'manifest');
  const characterCard = firstParsedRecord(artifacts, 'character_card');
  const personaCard = firstParsedRecord(artifacts, 'persona');
  const lorebook = firstParsedRecord(artifacts, 'lorebook');
  const preset = firstParsedRecord(artifacts, 'preset');
  const renderedPrompt = artifacts.find(
    (artifact) => artifact.kind === 'rendered_prompt',
  );
  const transcript = artifacts.find((artifact) => artifact.kind === 'transcript');
  const importId =
    options.importId ??
    stableId('st-import', [
      options.profileId,
      readString(manifest, 'package') ??
        readString(characterData(characterCard), 'name') ??
        'packet',
    ]);
  const sessionId = options.sessionId ?? stableId('session', importId);
  const transcriptMetadata = transcriptMetadataFromArtifact(transcript);
  const transcriptRows = transcriptRowsFromArtifact(transcript);
  const character = characterCard
    ? characterFromCard(characterCard, options.profileId)
    : undefined;
  const persona = personaCard
    ? personaFromCard(personaCard, options.profileId)
    : undefined;
  const loreEntries = lorebook
    ? loreEntriesFromBook(lorebook, options.profileId)
    : [];
  const loreLayer =
    lorebook === undefined
      ? undefined
      : {
          layerId: stableId(
            'st-lore-layer',
            readString(lorebook, 'name') ?? readString(manifest, 'package') ?? importId,
          ),
          name:
            readString(lorebook, 'name') ??
            readString(manifest, 'package') ??
            'Imported ST lorebook',
          description:
            readString(lorebook, 'description') ??
            'Imported SillyTavern lorebook. Legacy trigger controls are preserved as metadata.',
          purpose: 'mixed',
          writePolicy: 'readonly',
        };
  const summaryInput: {
    artifacts: readonly StImportArtifact[];
    character?: Record<string, unknown>;
    persona?: Record<string, unknown>;
    loreEntries: readonly Record<string, unknown>[];
    transcriptRows: readonly Record<string, unknown>[];
    preset?: JsonRecord;
    renderedPrompt?: StImportArtifact;
  } = {
    artifacts,
    loreEntries,
    transcriptRows,
  };
  if (character !== undefined) summaryInput.character = character;
  if (persona !== undefined) summaryInput.persona = persona;
  if (preset !== undefined) summaryInput.preset = preset;
  if (renderedPrompt !== undefined) {
    summaryInput.renderedPrompt = renderedPrompt;
  }
  const summary = summarizeImportPlan(summaryInput);

  return {
    profileId: options.profileId,
    importId,
    provenance: {
      source: 'sillytavern_import',
      package: readString(manifest, 'package'),
      generated: readString(manifest, 'generated'),
      files: artifacts.map((artifact) => ({
        fileName: artifact.fileName,
        kind: artifact.kind,
        size: artifact.size,
        sha256: artifact.sha256,
      })),
    },
    rawSource: {
      manifest,
      preset,
      renderedPrompt: renderedPrompt?.text,
      transcriptMetadata,
      artifacts: artifacts.map((artifact) => ({
        fileName: artifact.fileName,
        kind: artifact.kind,
        size: artifact.size,
        sha256: artifact.sha256,
      })),
    },
    ...(character === undefined ? {} : { character }),
    ...(persona === undefined ? {} : { persona }),
    ...(loreLayer === undefined ? {} : { loreLayer }),
    loreEntries,
    session: {
      sessionId,
      displayName:
        readString(manifest, 'chat') ??
        readString(characterData(characterCard), 'name') ??
        'Imported ST session',
    },
    ...(transcriptMetadata === undefined ? {} : { transcriptMetadata }),
    transcriptRows,
    importSummary: summary,
  };
}

export async function readArtifact(file: File): Promise<StImportArtifact> {
  const bytes = new Uint8Array(await readFileArrayBuffer(file));
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.png') || file.type === 'image/png') {
    const parsed = characterCardFromPng(bytes);
    return {
      kind: parsed === undefined ? 'unknown' : 'character_card',
      fileName: file.name,
      size: file.size,
      sha256: await sha256(bytes),
      parsed,
    };
  }

  const text = new TextDecoder().decode(bytes);
  const parsed = parseJsonLike(text, lowerName);
  return {
    kind: classifyTextArtifact(file.name, text, parsed),
    fileName: file.name,
    size: file.size,
    sha256: await sha256(bytes),
    ...(parsed === undefined ? {} : { parsed }),
    text,
  };
}

function readFileArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('ST import file did not produce binary data.'));
      }
    });
    reader.addEventListener('error', () =>
      reject(new Error('Could not read ST import file.')),
    );
    reader.readAsArrayBuffer(file);
  });
}

function classifyTextArtifact(
  fileName: string,
  text: string,
  parsed: unknown,
): StImportArtifactKind {
  const lowerName = fileName.toLowerCase();
  const record = asRecord(parsed);
  if (record !== undefined) {
    if (isManifest(record)) return 'manifest';
    if (isLorebook(record)) return 'lorebook';
    if (isPreset(record)) return 'preset';
    if (isCharacterCard(record)) return 'character_card';
    if (isPersona(record, lowerName)) return 'persona';
  }
  if (lowerName.endsWith('.jsonl') && parseJsonl(text).length > 0) {
    return 'transcript';
  }
  if (lowerName.includes('transcript')) return 'transcript';
  if (lowerName.includes('rendered prompt')) return 'rendered_prompt';
  return 'unknown';
}

function characterFromCard(
  card: JsonRecord,
  profileId: string,
): Record<string, unknown> {
  const data = characterData(card);
  const name = readRequiredString(data, 'name', 'Imported character');
  const characterBook = asRecord(data['character_book']);
  return compactRecord({
    id: stableId('st-character', [profileId, name]),
    name,
    description: readString(data, 'description') ?? '',
    personality: readString(data, 'personality') ?? '',
    scenario: readString(data, 'scenario') ?? '',
    firstMessage: readString(data, 'first_mes') ?? '',
    alternateGreetings: stringArray(data['alternate_greetings']),
    exampleMessages: examplesArray(data['mes_example']),
    tags: stringArray(data['tags']),
    avatarUrl: readString(data, 'avatar') ?? readString(card, 'avatar'),
    rawMetadata: compactRecord({
      spec: readString(card, 'spec'),
      spec_version: readString(card, 'spec_version'),
      creator: readString(data, 'creator'),
      creator_notes:
        readString(data, 'creator_notes') ?? readString(card, 'creatorcomment'),
      system_prompt: readString(data, 'system_prompt'),
      depth_prompt: readString(data, 'depth_prompt'),
      post_history_instructions: readString(
        data,
        'post_history_instructions',
      ),
      extensions: asRecord(data['extensions']),
      character_book:
        characterBook === undefined
          ? undefined
          : {
              name: readString(characterBook, 'name'),
              description: readString(characterBook, 'description'),
              entryCount: Object.keys(asRecord(characterBook['entries']) ?? {})
                .length,
              raw: characterBook,
            },
    }),
  });
}

function personaFromCard(
  persona: JsonRecord,
  profileId: string,
): Record<string, unknown> {
  const name =
    readString(persona, 'name') ??
    readString(persona, 'display_name') ??
    'Imported persona';
  return compactRecord({
    id: stableId('st-persona', [profileId, name]),
    displayName: name,
    description: readString(persona, 'description') ?? '',
    notes: readString(persona, 'comment') ?? readString(persona, 'notes') ?? '',
    rawMetadata: compactRecord({
      spec: readString(persona, 'spec'),
      spec_version: readString(persona, 'spec_version'),
      extensions: asRecord(persona['extensions']),
    }),
  });
}

function loreEntriesFromBook(
  lorebook: JsonRecord,
  profileId: string,
): readonly Record<string, unknown>[] {
  return Object.values(asRecord(lorebook['entries']) ?? {}).flatMap(
    (value, index) => {
      const entry = asRecord(value);
      if (entry === undefined) return [];
      const title =
        readString(entry, 'comment') ??
        readString(entry, 'name') ??
        `Lore ${readString(entry, 'uid') ?? String(index + 1)}`;
      const body = readString(entry, 'content') ?? readString(entry, 'body') ?? '';
      return [
        compactRecord({
          recordId: stableId('st-lore', [
            readString(entry, 'uid') ?? readString(entry, 'id') ?? title,
          ]),
          title,
          body,
          worldId: profileId,
          entityId: title,
          canonStatus: 'draft',
          visibility: 'public',
          primaryKeys: stringArray(entry['key'] ?? entry['keys']),
          secondaryKeys: stringArray(
            entry['keysecondary'] ?? entry['secondary_keys'],
          ),
          constant:
            readBoolean(entry, 'constant') ??
            readBoolean(entry, 'is_constant') ??
            false,
          enabled: readBoolean(entry, 'disable') === true ? false : true,
          insertionOrder:
            readNumber(entry, 'insertion_order') ?? readNumber(entry, 'order'),
          scanDepth: readNumber(entry, 'scan_depth') ?? readNumber(entry, 'depth'),
          probability: probability(entry),
          rawMetadata: entry,
        }),
      ];
    },
  );
}

function transcriptRowsFromArtifact(
  artifact: StImportArtifact | undefined,
): readonly Record<string, unknown>[] {
  if (artifact?.text === undefined) return [];
  return parseJsonl(artifact.text)
    .map((row, sourceIndex) => ({ row, sourceIndex }))
    .filter(({ row }) => isTranscriptRow(row))
    .map(({ row, sourceIndex }) => {
      const role =
        readBoolean(row, 'is_system') === true
          ? 'system'
          : readBoolean(row, 'is_user') === true
            ? 'user'
            : readString(row, 'role') === 'user'
              ? 'user'
              : readString(row, 'role') === 'system'
                ? 'system'
                : 'assistant';
      return compactRecord({
        role,
        name: readString(row, 'name'),
        send_date:
          readString(row, 'send_date') ??
          readString(row, 'create_date') ??
          readString(row, 'created_at'),
        body:
          readString(row, 'mes') ??
          readString(row, 'content') ??
          readString(row, 'text') ??
          '',
        swipe_id: readNumber(row, 'swipe_id'),
        swipes: stringArray(row['swipes']),
        swipe_info: Array.isArray(row['swipe_info']) ? row['swipe_info'] : undefined,
        extra: asRecord(row['extra']),
        metadata: compactRecord({
          source_index: sourceIndex,
          is_user: readBoolean(row, 'is_user'),
          is_system: readBoolean(row, 'is_system'),
          raw_name: readString(row, 'name'),
        }),
      });
    });
}

function transcriptMetadataFromArtifact(
  artifact: StImportArtifact | undefined,
): Record<string, unknown> | undefined {
  if (artifact?.text === undefined) return undefined;
  const metadataRows = parseJsonl(artifact.text)
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !isTranscriptRow(row))
    .map(({ row, index }) =>
      compactRecord({
        ...row,
        source_index: index,
      }),
    );
  return metadataRows.length === 0
    ? undefined
    : {
        metadataRows,
      };
}

function summarizeImportPlan(input: {
  readonly artifacts: readonly StImportArtifact[];
  readonly character?: Record<string, unknown>;
  readonly persona?: Record<string, unknown>;
  readonly loreEntries: readonly Record<string, unknown>[];
  readonly transcriptRows: readonly Record<string, unknown>[];
  readonly preset?: JsonRecord;
  readonly renderedPrompt?: StImportArtifact;
}): StImportPlanSummary {
  const assistantRows = input.transcriptRows.filter(
    (row) => row['role'] === 'assistant',
  );
  const assistantVariantRows = assistantRows.filter(
    (row) => stringArray(row['swipes']).length > 1,
  );
  return {
    artifacts: input.artifacts.map((artifact) => ({
      fileName: artifact.fileName,
      kind: artifact.kind,
    })),
    firstClassFields: [
      'character identity',
      'character first message and example messages',
      'player persona description',
      'lore entry body and trigger keys',
      'transcript turns and selected swipes',
    ],
    preservedMetadata: [
      'character card creator notes, system prompt, depth prompt, and extensions',
      'ST preset prompt blocks and prompt order',
      'lorebook insertion controls, scan depth, probability, and raw entry metadata',
      'transcript header and message model/API/reasoning/timing metadata',
      'source file hashes and manifest provenance',
    ],
    notDuplicatedRuntimeCeremony: [
      'legacy prompt block order is preserved for audit, not used as the main runtime contract',
      'keyword trigger/injection settings become lore retrieval hints and metadata',
      'rendered prompt exports are copied for comparison, not replayed as the compiled prompt',
    ],
    counts: {
      characters: input.character === undefined ? 0 : 1,
      personas: input.persona === undefined ? 0 : 1,
      loreEntries: input.loreEntries.length,
      transcriptRows: input.transcriptRows.length,
      assistantRows: assistantRows.length,
      assistantVariantRows: assistantVariantRows.length,
    },
    warnings: input.artifacts
      .filter((artifact) => artifact.kind === 'unknown')
      .map((artifact) => `Unsupported or unrecognized file: ${artifact.fileName}`),
  };
}

function isManifest(record: JsonRecord): boolean {
  return (
    typeof record['package'] === 'string' &&
    (record['layout'] !== undefined || record['files'] !== undefined)
  );
}

function isCharacterCard(record: JsonRecord): boolean {
  const data = characterData(record);
  return (
    typeof data['name'] === 'string' &&
    (data['first_mes'] !== undefined ||
      data['personality'] !== undefined ||
      data['scenario'] !== undefined)
  );
}

function isPersona(record: JsonRecord, lowerName: string): boolean {
  return (
    lowerName.includes('persona') &&
    typeof record['name'] === 'string' &&
    typeof record['description'] === 'string'
  );
}

function isLorebook(record: JsonRecord): boolean {
  return asRecord(record['entries']) !== undefined;
}

function isPreset(record: JsonRecord): boolean {
  return Array.isArray(record['prompts']) || Array.isArray(record['prompt_order']);
}

function isTranscriptRow(row: JsonRecord): boolean {
  return (
    row['mes'] !== undefined ||
    row['content'] !== undefined ||
    row['is_user'] !== undefined ||
    row['swipes'] !== undefined
  );
}

function characterData(record: JsonRecord | undefined): JsonRecord {
  return asRecord(record?.['data']) ?? record ?? {};
}

function firstParsedRecord(
  artifacts: readonly StImportArtifact[],
  kind: StImportArtifactKind,
): JsonRecord | undefined {
  return artifacts
    .filter((artifact) => artifact.kind === kind)
    .map((artifact) => asRecord(artifact.parsed))
    .find((record): record is JsonRecord => record !== undefined);
}

function parseJsonLike(text: string, lowerName: string): unknown {
  if (lowerName.endsWith('.jsonl')) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function parseJsonl(text: string): JsonRecord[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as unknown;
        const record = asRecord(parsed);
        return record === undefined ? [] : [record];
      } catch {
        return [];
      }
    });
}

function characterCardFromPng(bytes: Uint8Array): JsonRecord | undefined {
  if (!isPng(bytes)) return undefined;
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = ascii(bytes.subarray(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) break;
    if (type === 'tEXt') {
      const chunk = parseTextChunk(bytes.subarray(dataStart, dataEnd));
      if (chunk.keyword === 'chara') {
        try {
          return asRecord(JSON.parse(decodeBase64Utf8(chunk.value)) as unknown);
        } catch {
          return undefined;
        }
      }
    }
    offset = dataEnd + 4;
  }
  return undefined;
}

function sha256(bytes: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return crypto.subtle
    .digest('SHA-256', buffer)
    .then((digest) =>
      Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join(''),
    );
}

function stableId(prefix: string, raw: string | readonly unknown[]): string {
  const joined = typeof raw === 'string' ? raw : raw.join(':');
  const slug =
    joined
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9._:-]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 120) || 'import';
  return `${prefix}:${slug}`;
}

function compactRecord<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  ) as T;
}

function probability(entry: JsonRecord): number | undefined {
  const value = readNumber(entry, 'probability');
  if (value === undefined) return undefined;
  return value > 1 ? value / 100 : value;
}

function examplesArray(value: unknown): readonly string[] {
  if (Array.isArray(value)) return stringArray(value);
  if (typeof value !== 'string') return [];
  return value
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function stringArray(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

function asRecord(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function readRequiredString(
  record: JsonRecord,
  key: string,
  fallback: string,
): string {
  return readString(record, key)?.trim() || fallback;
}

function readString(
  record: JsonRecord | undefined,
  key: string,
): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(record: JsonRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

function readBoolean(record: JsonRecord, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  );
}

function parseTextChunk(bytes: Uint8Array): {
  readonly keyword: string;
  readonly value: string;
} {
  const separator = bytes.indexOf(0);
  if (separator < 0) return { keyword: '', value: '' };
  return {
    keyword: new TextDecoder('latin1').decode(bytes.subarray(0, separator)),
    value: new TextDecoder('latin1').decode(bytes.subarray(separator + 1)),
  };
}

function decodeBase64Utf8(value: string): string {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function ascii(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

import type {
  ChatMessage,
  MessageBlock,
  TranscriptTextSpan,
} from '@rusty-view/chat-domain';

export interface RoleplaySpeakerIdentitySnapshot {
  readonly kind: 'player' | 'character' | 'narrator' | 'system' | 'unknown';
  readonly id: string | undefined;
  readonly displayName: string | undefined;
  readonly avatarUrl: string | undefined;
  readonly avatarAssetRef: string | undefined;
}

export interface RoleplayTextStyleSettings {
  readonly presetId: string;
  readonly dialogueColor: string;
  readonly narrationColor: string;
  readonly emphasisColor: string;
  readonly oocColor: string;
}

export interface RoleplayTextStylePreset {
  readonly id: string;
  readonly label: string;
  readonly settings: RoleplayTextStyleSettings;
}

export const ROLEPLAY_TEXT_STYLE_PRESETS: readonly RoleplayTextStylePreset[] = [
  {
    id: 'rp-night',
    label: 'RP Night',
    settings: {
      presetId: 'rp-night',
      dialogueColor: '#d9cb82',
      narrationColor: '#b7c0cc',
      emphasisColor: '#eaa6d8',
      oocColor: '#8ea0b5',
    },
  },
  {
    id: 'solarized',
    label: 'Solarized',
    settings: {
      presetId: 'solarized',
      dialogueColor: '#2aa198',
      narrationColor: '#93a1a1',
      emphasisColor: '#b58900',
      oocColor: '#657b83',
    },
  },
  {
    id: 'molokai',
    label: 'Molokai',
    settings: {
      presetId: 'molokai',
      dialogueColor: '#e6db74',
      narrationColor: '#f8f8f2',
      emphasisColor: '#f92672',
      oocColor: '#75715e',
    },
  },
];

export const DEFAULT_ROLEPLAY_TEXT_STYLE = ROLEPLAY_TEXT_STYLE_PRESETS[0]
  ?.settings ?? {
  presetId: 'rp-night',
  dialogueColor: '#d9cb82',
  narrationColor: '#b7c0cc',
  emphasisColor: '#eaa6d8',
  oocColor: '#8ea0b5',
};

export function decorateRoleplayMessages(
  messages: readonly ChatMessage[],
): readonly ChatMessage[] {
  return messages.map(decorateRoleplayMessage);
}

export function decorateRoleplayMessage(message: ChatMessage): ChatMessage {
  const speaker = readSpeakerIdentity(message);
  const displayName = speaker?.displayName ?? message.author.displayName;
  const author =
    speaker === undefined
      ? message.author
      : {
          ...message.author,
          displayName,
          speaker: {
            label: displayName,
            avatarUrl: speaker.avatarUrl,
            initials: initials(displayName ?? message.author.role),
            avatarAlt: `Avatar for ${displayName ?? message.author.role}`,
          },
        };
  return {
    ...message,
    author,
    blocks: message.blocks.map(decorateRoleplayBlock),
  } as ChatMessage;
}

export function decorateRoleplayBlock(block: MessageBlock): MessageBlock {
  if (block.kind !== 'text') {
    return block;
  }
  const textSpans = roleplayTextSpans(block.content);
  if (textSpans.length === 0) {
    return block;
  }
  return {
    ...block,
    textSpans,
  } as MessageBlock;
}

export function roleplayTextSpans(
  content: string,
): readonly TranscriptTextSpan[] {
  const spans: TranscriptTextSpan[] = [];
  for (const match of content.matchAll(/"[^"\n]+"/g)) {
    spans.push({
      start: match.index,
      end: match.index + match[0].length,
      scope: 'quote',
    });
  }
  for (const match of content.matchAll(/\*[^*\n]+\*/g)) {
    spans.push({
      start: match.index,
      end: match.index + match[0].length,
      scope: 'emphasis',
    });
  }
  const oocPattern = /(^|\n)(?:OOC:|\[OOC\]).*(?=\n|$)/g;
  for (const match of content.matchAll(oocPattern)) {
    const offset = match[1]?.length ?? 0;
    spans.push({
      start: match.index + offset,
      end: match.index + match[0].length,
      scope: 'muted',
    });
  }
  return spans.sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );
}

export function readSpeakerIdentity(
  message: ChatMessage,
): RoleplaySpeakerIdentitySnapshot | undefined {
  const metadata = message.metadata ?? {};
  const raw =
    metadata['speaker_identity'] ??
    metadata['speakerIdentity'] ??
    metadata['speaker'];
  if (isRecord(raw)) {
    return mapSpeakerIdentity(raw);
  }
  return undefined;
}

export function applyRoleplayTextStyle(
  settings: RoleplayTextStyleSettings,
): void {
  const root = document.documentElement;
  root.style.setProperty('--rv-text-scope-quote', settings.dialogueColor);
  root.style.setProperty('--rv-text-scope-plain', settings.narrationColor);
  root.style.setProperty('--rv-text-scope-emphasis', settings.emphasisColor);
  root.style.setProperty('--rv-text-scope-muted', settings.oocColor);
}

export function loadRoleplayTextStyle(
  profileId: string,
  storage: Pick<Storage, 'getItem'> = window.localStorage,
): RoleplayTextStyleSettings {
  const raw = storage.getItem(storageKey(profileId));
  if (raw === null) {
    return DEFAULT_ROLEPLAY_TEXT_STYLE;
  }
  try {
    const value = JSON.parse(raw) as Partial<RoleplayTextStyleSettings>;
    return normalizeTextStyle(value);
  } catch {
    return DEFAULT_ROLEPLAY_TEXT_STYLE;
  }
}

export function saveRoleplayTextStyle(
  profileId: string,
  settings: RoleplayTextStyleSettings,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): void {
  storage.setItem(
    storageKey(profileId),
    JSON.stringify(normalizeTextStyle(settings)),
  );
}

export function loadRoleplayModelActivityVisibility(
  profileId: string,
  storage: Pick<Storage, 'getItem'> = window.localStorage,
): boolean {
  return storage.getItem(modelActivityStorageKey(profileId)) === 'true';
}

export function saveRoleplayModelActivityVisibility(
  profileId: string,
  visible: boolean,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): void {
  storage.setItem(modelActivityStorageKey(profileId), String(visible));
}

export function presetById(presetId: string): RoleplayTextStyleSettings {
  return (
    ROLEPLAY_TEXT_STYLE_PRESETS.find((preset) => preset.id === presetId)
      ?.settings ?? DEFAULT_ROLEPLAY_TEXT_STYLE
  );
}

function normalizeTextStyle(
  value: Partial<RoleplayTextStyleSettings>,
): RoleplayTextStyleSettings {
  return {
    presetId: value.presetId ?? DEFAULT_ROLEPLAY_TEXT_STYLE.presetId,
    dialogueColor: colorOrDefault(
      value.dialogueColor,
      DEFAULT_ROLEPLAY_TEXT_STYLE.dialogueColor,
    ),
    narrationColor: colorOrDefault(
      value.narrationColor,
      DEFAULT_ROLEPLAY_TEXT_STYLE.narrationColor,
    ),
    emphasisColor: colorOrDefault(
      value.emphasisColor,
      DEFAULT_ROLEPLAY_TEXT_STYLE.emphasisColor,
    ),
    oocColor: colorOrDefault(
      value.oocColor,
      DEFAULT_ROLEPLAY_TEXT_STYLE.oocColor,
    ),
  };
}

function colorOrDefault(value: string | undefined, fallback: string): string {
  return value !== undefined && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : fallback;
}

function storageKey(profileId: string): string {
  return `rusty-roleplay:text-style:${profileId}`;
}

function modelActivityStorageKey(profileId: string): string {
  return `rusty-roleplay:model-activity:${profileId}`;
}

function mapSpeakerIdentity(
  record: Readonly<Record<string, unknown>>,
): RoleplaySpeakerIdentitySnapshot {
  const kind = readString(record, 'kind') ?? readString(record, 'speaker_kind');
  return {
    kind: isSpeakerKind(kind) ? kind : 'unknown',
    id:
      readString(record, 'id') ??
      readString(record, 'source_id') ??
      readString(record, 'sourceId'),
    displayName:
      readString(record, 'display_name') ??
      readString(record, 'displayName') ??
      readString(record, 'name'),
    avatarUrl:
      readString(record, 'avatar_url') ?? readString(record, 'avatarUrl'),
    avatarAssetRef:
      readString(record, 'avatar_asset_ref') ??
      readString(record, 'avatarAssetRef'),
  };
}

function isSpeakerKind(
  value: string | undefined,
): value is RoleplaySpeakerIdentitySnapshot['kind'] {
  return (
    value === 'player' ||
    value === 'character' ||
    value === 'narrator' ||
    value === 'system' ||
    value === 'unknown'
  );
}

function initials(value: string): string {
  const result = value
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return result || '?';
}

function readString(
  record: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

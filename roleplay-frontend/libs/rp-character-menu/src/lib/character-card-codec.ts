import type { CharacterWriteRequest, RpCharacter } from './character.model';

type CardRecord = Record<string, unknown>;

export async function importCharacterCardFile(
  file: File,
): Promise<CharacterWriteRequest> {
  const lowerName = file.name.toLowerCase();
  if (file.type === 'image/png' || lowerName.endsWith('.png')) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const request = parsePngCharacterCard(bytes);
    if (request.avatarUrl === undefined) {
      return { ...request, avatarUrl: await readAsDataUrl(file) };
    }
    return request;
  }

  if (
    file.type === 'application/json' ||
    file.type === '' ||
    lowerName.endsWith('.json')
  ) {
    return parseCharacterCardJson(await readAsText(file));
  }

  throw new Error('Unsupported character card file. Import JSON or PNG cards.');
}

export function parseCharacterCardJson(text: string): CharacterWriteRequest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error('Character card JSON could not be parsed.');
  }
  return characterRequestFromCard(parsed);
}

export function parsePngCharacterCard(
  bytes: Uint8Array,
): CharacterWriteRequest {
  if (!isPng(bytes)) {
    throw new Error('Character card PNG was not a valid PNG file.');
  }

  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = ascii(bytes.subarray(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) {
      break;
    }

    if (type === 'tEXt') {
      const text = parseTextChunk(bytes.subarray(dataStart, dataEnd));
      if (text.keyword === 'chara') {
        return parseCharacterCardJson(decodeBase64Utf8(text.value));
      }
    }

    offset = dataEnd + 4;
  }

  throw new Error('PNG did not contain a SillyTavern chara metadata chunk.');
}

export function characterToTavernCardJson(
  character: RpCharacter | CharacterWriteRequest,
): string {
  const card = {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: character.name,
      description: character.description,
      personality: character.personality,
      scenario: character.scenario,
      first_mes: character.firstMessage,
      alternate_greetings: [...character.alternateGreetings],
      mes_example: character.exampleMessages.join('\n'),
      tags: [...character.tags],
      avatar: character.avatarUrl ?? '',
    },
  };
  return `${JSON.stringify(card, null, 2)}\n`;
}

function characterRequestFromCard(value: unknown): CharacterWriteRequest {
  const root = readRecord(value);
  if (root === undefined) {
    throw new Error('Character card JSON was not an object.');
  }
  const data = readRecord(root['data']) ?? root;
  const name = readString(data, 'name');
  if (name === undefined || name.trim() === '') {
    throw new Error('Character card is missing a name.');
  }
  const avatarUrl = readString(data, 'avatar') ?? readString(data, 'avatarUrl');

  const request: CharacterWriteRequest = {
    name: name.trim(),
    description: readString(data, 'description') ?? '',
    personality: readString(data, 'personality') ?? '',
    scenario: readString(data, 'scenario') ?? '',
    firstMessage:
      readString(data, 'first_mes') ?? readString(data, 'firstMessage') ?? '',
    alternateGreetings: readStringList(
      data['alternate_greetings'] ?? data['alternateGreetings'],
    ),
    exampleMessages: readExamples(data['mes_example'] ?? data['exampleMessages']),
    tags: readStringList(data['tags']),
  };
  return avatarUrl === undefined || avatarUrl === ''
    ? request
    : { ...request, avatarUrl };
}

function readRecord(value: unknown): CardRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as CardRecord)
    : undefined;
}

function readString(
  record: CardRecord | undefined,
  key: string,
): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' ? value : undefined;
}

function readStringList(value: unknown): readonly string[] {
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

function readExamples(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return readStringList(value);
  }
  if (typeof value === 'string') {
    return value
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
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
  if (separator < 0) {
    return { keyword: '', value: '' };
  }
  return {
    keyword: latin1(bytes.subarray(0, separator)),
    value: latin1(bytes.subarray(separator + 1)),
  };
}

function decodeBase64Utf8(value: string): string {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function latin1(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

function ascii(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () =>
      reject(new Error('Could not read avatar image.')),
    );
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () =>
      reject(new Error('Could not read character card JSON.')),
    );
    reader.readAsText(file);
  });
}

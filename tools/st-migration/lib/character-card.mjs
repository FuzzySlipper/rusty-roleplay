import { shortHash, slugify } from './ids.mjs';

export function parseCharacterCardJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Character card JSON could not be parsed: ${error.message}`);
  }
  return normalizeCharacterCard(parsed);
}

export function parsePngCharacterCard(bytes, { includeAvatar = true } = {}) {
  if (!isPng(bytes)) throw new Error('Character card PNG was not a valid PNG file.');
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = ascii(bytes.subarray(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) break;
    if (type === 'tEXt') {
      const chunk = parseTextChunk(bytes.subarray(dataStart, dataEnd));
      if (chunk.keyword === 'chara' || chunk.keyword === 'ccv3') {
        const card = parseCharacterCardJson(Buffer.from(chunk.value, 'base64').toString('utf8'));
        return includeAvatar && !card.character.avatarUrl
          ? { ...card, character: { ...card.character, avatarUrl: `data:image/png;base64,${Buffer.from(bytes).toString('base64')}` } }
          : card;
      }
    }
    offset = dataEnd + 4;
  }
  throw new Error('PNG did not contain a SillyTavern chara or ccv3 metadata chunk.');
}

export function normalizeCharacterCard(value) {
  const root = record(value);
  if (!root) throw new Error('Character card JSON was not an object.');
  const data = record(root.data) ?? root;
  if (!isCharacterCard(root, data)) {
    const error = new Error('JSON file is not a SillyTavern character card.');
    error.code = 'not_character_card';
    throw error;
  }
  const name = string(data.name)?.trim();
  if (!name) throw new Error('Character card is missing a name.');
  const rawBook = record(data.character_book ?? data.characterBook);
  const character = {
    name,
    description: string(data.description) ?? '',
    personality: string(data.personality) ?? '',
    scenario: string(data.scenario) ?? '',
    firstMessage: string(data.first_mes ?? data.firstMessage) ?? '',
    alternateGreetings: strings(data.alternate_greetings ?? data.alternateGreetings),
    exampleMessages: examples(data.mes_example ?? data.exampleMessages),
    tags: strings(data.tags),
    ...(string(data.avatar ?? data.avatarUrl) ? { avatarUrl: string(data.avatar ?? data.avatarUrl) } : {}),
    rawMetadata: {
      spec: string(root.spec),
      specVersion: string(root.spec_version),
      creator: string(data.creator),
      creatorNotes: string(data.creator_notes ?? root.creatorcomment),
      systemPrompt: string(data.system_prompt),
      postHistoryInstructions: string(data.post_history_instructions),
      depthPrompt: data.depth_prompt,
      extensions: data.extensions,
    },
  };
  return { character, embeddedLorebook: rawBook };
}

function isCharacterCard(root, data) {
  const spec = string(root.spec)?.toLowerCase();
  if (spec?.includes('chara_card')) return true;
  if (spec?.includes('persona')) return false;
  if (record(root.entries) || Array.isArray(root.entries)) return false;
  return typeof data.name === 'string' && [
    'description', 'personality', 'scenario', 'first_mes', 'firstMessage', 'mes_example',
  ].some((key) => Object.hasOwn(data, key));
}

export function characterDetailEntries(card, { profileId, characterId }) {
  const character = card.character;
  const base = `${profileId}:${characterId}`;
  const entries = [];
  if (character.description.trim()) {
    entries.push(detailEntry(base, 'background', `${character.name} — background`, character.description, ['character', 'background']));
  }
  const traits = splitTraits(character.personality);
  traits.forEach((trait, index) => {
    entries.push(detailEntry(base, `personality-${index + 1}`, `${character.name} — personality ${index + 1}`, trait, ['character', 'personality']));
  });
  if (character.scenario.trim()) {
    entries.push(detailEntry(base, 'scenario', `${character.name} — relationship and scenario notes`, character.scenario, ['character', 'scenario', 'relationship']));
  }
  const creatorNotes = string(character.rawMetadata.creatorNotes)?.trim();
  if (creatorNotes) {
    entries.push(detailEntry(base, 'creator-notes', `${character.name} — creator notes`, creatorNotes, ['character', 'creator-notes']));
  }
  return entries;
}

export function characterId(profileId, name) {
  return `st-character-${slugify(name)}-${shortHash(`${profileId}:${name.toLowerCase()}`)}`;
}

function detailEntry(base, suffix, title, body, tags) {
  return {
    recordId: `st-character-lore-${shortHash(`${base}:${suffix}`)}`,
    title,
    body,
    tags,
    primaryKeys: tags,
    constant: false,
    enabled: true,
  };
}

function splitTraits(value) {
  return String(value ?? '').split(/(?:\r?\n|;)+/).map((part) => part.trim()).filter(Boolean);
}

function examples(value) {
  if (Array.isArray(value)) return strings(value);
  return typeof value === 'string'
    ? value.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean)
    : [];
}

function strings(value) {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(items.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean))];
}

function string(value) {
  return typeof value === 'string' ? value : undefined;
}

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
}

function isPng(bytes) {
  return bytes.length >= 8 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

function readUint32(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset);
}

function parseTextChunk(bytes) {
  const separator = bytes.indexOf(0);
  if (separator < 0) return { keyword: '', value: '' };
  return {
    keyword: Buffer.from(bytes.subarray(0, separator)).toString('latin1'),
    value: Buffer.from(bytes.subarray(separator + 1)).toString('latin1'),
  };
}

function ascii(bytes) {
  return Buffer.from(bytes).toString('ascii');
}

import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

import { characterDetailEntries, characterId, parseCharacterCardJson, parsePngCharacterCard } from './character-card.mjs';
import { normalizeWorldInfoBook } from './world-info.mjs';

export async function inventoryStSources(root, dependencies = {}) {
  const read = dependencies.readFile ?? readFile;
  const names = await (dependencies.readdir ?? readdir)(root);
  const characterByName = new Map();
  const lorebooks = [];
  const transcripts = [];
  const ignored = [];
  for (const name of names.sort()) {
    const path = join(root, name);
    const extension = extname(name).toLowerCase();
    if (extension === '.jsonl') {
      transcripts.push({ path, name });
      continue;
    }
    if (extension !== '.json' && extension !== '.png') continue;
    const bytes = new Uint8Array(await read(path));
    try {
      const card = extension === '.png'
        ? parsePngCharacterCard(bytes, { includeAvatar: false })
        : parseCharacterCardJson(Buffer.from(bytes).toString('utf8'));
      const key = card.character.name.toLowerCase();
      if (!characterByName.has(key) || extension === '.png') characterByName.set(key, { path, card });
      continue;
    } catch (error) {
      if (extension === '.png' || error?.code !== 'not_character_card') {
        ignored.push({ path, reason: error instanceof Error ? error.message : String(error) });
        continue;
      }
    }
    let parsed;
    try {
      parsed = JSON.parse(Buffer.from(bytes).toString('utf8'));
      if (parsed && typeof parsed === 'object' && (Array.isArray(parsed.entries) || isRecord(parsed.entries))) {
        lorebooks.push({ path, normalized: normalizeWorldInfoBook(parsed, { profileId: 'source-inventory', filePath: path }) });
      }
    } catch (error) {
      ignored.push({ path, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return { characters: [...characterByName.values()], lorebooks, transcripts, ignored };
}

export function expectedCharacterLayer(item, profileId) {
  const id = characterId(profileId, item.card.character.name);
  const details = characterDetailEntries(item.card, { profileId, characterId: id });
  const embeddedEntries = isRecord(item.card.embeddedLorebook?.entries) || Array.isArray(item.card.embeddedLorebook?.entries)
    ? normalizeWorldInfoBook(item.card.embeddedLorebook, { profileId, filePath: `${item.path}#character_book`, importId: `st-character-book-${id}` }).plan.loreEntries
    : [];
  return {
    characterId: id,
    layerName: `${item.card.character.name} — character details`,
    expectedEntryCount: details.length + embeddedEntries.length,
  };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

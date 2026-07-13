#!/usr/bin/env node
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

import { RustyCrewApiClient } from './lib/api-client.mjs';
import { characterDetailEntries, characterId, parseCharacterCardJson, parsePngCharacterCard } from './lib/character-card.mjs';
import { parseCliArgs, printJson, requiredOption, usageError } from './lib/cli.mjs';
import { normalizeWorldInfoBook } from './lib/world-info.mjs';
import { slugify } from './lib/ids.mjs';

const USAGE = `Usage: node tools/st-migration/import-characters.mjs <card-or-directory> --profile <profile-id> [options]

Options:
  --api <url>       rusty-crew base URL (default: http://127.0.0.1:9348)
  --token <token>   Admin bearer token (or RUSTY_CREW_ADMIN_TOKEN)
  --dry-run         Decode, deduplicate, and report without writing`;

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const { values, positionals } = parseCliArgs(argv, {
    profile: { type: 'string' }, api: { type: 'string' }, token: { type: 'string' },
    'dry-run': { type: 'boolean', name: 'dryRun' },
  });
  if (positionals.length !== 1) throw usageError('Provide one character card or directory.', USAGE);
  const profileId = requiredOption(values, 'profile');
  const paths = await discoverCardPaths(positionals[0], dependencies.fs);
  if (paths.length === 0) throw new Error(`No .json or .png character cards found at ${positionals[0]}.`);
  const decoded = [];
  const failed = [];
  const ignored = [];
  for (const path of paths) {
    try {
      decoded.push({ path, card: await decodeCard(path, dependencies.readFile) });
    } catch (error) {
      const destination = error?.code === 'not_character_card' ? ignored : failed;
      destination.push({ path, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  const unique = [];
  const skipped = [];
  const seen = new Set();
  for (const item of decoded) {
    const key = item.card.character.name.trim().toLowerCase();
    if (seen.has(key)) {
      skipped.push({ path: item.path, name: item.card.character.name, reason: 'duplicate character name in input' });
    } else {
      seen.add(key);
      unique.push(item);
    }
  }
  const client = dependencies.client ?? new RustyCrewApiClient({
    baseUrl: values.api,
    token: values.token ?? process.env.RUSTY_CREW_ADMIN_TOKEN,
  });
  let candidates = unique;
  if (!values.dryRun) {
    const existing = await client.get(`/v1/admin/roleplay/profiles/${encodeURIComponent(profileId)}/characters?include_archived=true`);
    const existingNames = new Set((existing.items ?? existing.characters ?? []).map((item) => String(item.name ?? '').toLowerCase()));
    candidates = unique.filter((item) => {
      if (!existingNames.has(item.card.character.name.toLowerCase())) return true;
      skipped.push({ path: item.path, name: item.card.character.name, reason: 'character name already exists in rusty-crew' });
      return false;
    });
  }
  const imported = [];
  if (!values.dryRun) {
    for (const item of candidates) {
      try {
        imported.push(await importCard(client, item, profileId));
      } catch (error) {
        failed.push({ path: item.path, name: item.card.character.name, reason: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  const report = {
    dryRun: Boolean(values.dryRun), profileId, discovered: paths.length, decoded: decoded.length,
    importable: candidates.map((item) => ({ path: item.path, name: item.card.character.name })),
    imported, skipped, ignored, failed,
  };
  printJson(report, dependencies.stdout);
  if (failed.length > 0 && decoded.length === 0) process.exitCode = 1;
  return report;
}

export async function discoverCardPaths(inputPath, fs = { stat, readdir }) {
  const info = await fs.stat(inputPath);
  if (info.isFile()) return [inputPath];
  if (!info.isDirectory()) return [];
  const names = await fs.readdir(inputPath);
  return names
    .filter((name) => ['.png', '.json'].includes(extname(name).toLowerCase()))
    .sort((left, right) => cardRank(left) - cardRank(right) || left.localeCompare(right))
    .map((name) => join(inputPath, name));
}

export async function decodeCard(path, read = readFile) {
  const bytes = new Uint8Array(await read(path));
  return extname(path).toLowerCase() === '.png'
    ? parsePngCharacterCard(bytes)
    : parseCharacterCardJson(Buffer.from(bytes).toString('utf8'));
}

async function importCard(client, item, profileId) {
  const id = characterId(profileId, item.card.character.name);
  const characterResponse = await client.post(
    `/v1/admin/roleplay/profiles/${encodeURIComponent(profileId)}/characters`,
    { id, ...item.card.character },
  );
  const storedCharacter = characterResponse.character ?? characterResponse;
  const layerId = `st-character-${slugify(item.card.character.name)}-details`;
  await client.post('/v1/admin/roleplay/lore/layers', {
    layer_id: layerId, profile_id: profileId, name: `${item.card.character.name} — character details`,
    description: `Imported character facts for ${item.card.character.name}.`, purpose: 'characters', write_policy: 'manual',
  });
  const details = characterDetailEntries(item.card, { profileId, characterId: id });
  const embedded = normalizeEmbeddedLore(item.card.embeddedLorebook, { profileId, item, id });
  for (const entry of [...details, ...embedded]) {
    await client.post('/v1/admin/roleplay/lore/entries', loreEntryBody(layerId, profileId, id, entry));
  }
  return { path: item.path, name: item.card.character.name, characterId: storedCharacter.id ?? id, layerId, detailEntries: details.length, embeddedLoreEntries: embedded.length };
}

function normalizeEmbeddedLore(book, { profileId, item, id }) {
  if (!book || (!Array.isArray(book.entries) && (typeof book.entries !== 'object' || book.entries === null))) return [];
  const normalized = normalizeWorldInfoBook(book, {
    profileId, filePath: `${item.path}#character_book`, importId: `st-character-book-${id}`,
  });
  return normalized.plan.loreEntries.map((entry) => ({ ...entry, recordId: `${entry.recordId}-${slugify(id).slice(-16)}` }));
}

function loreEntryBody(layerId, profileId, characterIdValue, entry) {
  return {
    layer_id: layerId, record_id: entry.recordId, world_id: profileId, entity_id: characterIdValue,
    title: entry.title, body: entry.body, canon_status: 'draft', visibility: 'public', source: 'import',
    primary_keys: entry.primaryKeys ?? entry.tags ?? [], secondary_keys: entry.secondaryKeys ?? [],
    constant: entry.constant ?? false, enabled: entry.enabled ?? true,
    insertion_order: entry.insertionOrder ?? 0, scan_depth: entry.scanDepth ?? 4,
    probability: entry.probability ?? 1,
    content: { metadata_json: { tags: entry.tags ?? entry.primaryKeys ?? [], st_metadata: entry.rawMetadata } },
    durability_rationale: 'Imported from a SillyTavern character card.',
  };
}

function cardRank(name) {
  return extname(name).toLowerCase() === '.png' ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = error.exitCode ?? 1;
  });
}

import { basename, extname } from 'node:path';

import { shortHash, slugify, timestampId } from './ids.mjs';

const KNOWN_FIELDS = new Set([
  'uid', 'id', 'key', 'keys', 'keysecondary', 'secondary_keys', 'comment', 'name',
  'content', 'body', 'constant', 'is_constant', 'selective', 'insertion_order',
  'order', 'scan_depth', 'depth', 'prevent_recursion', 'exclude_recursion',
  'delay_until_recursion', 'enabled', 'disable', 'probability', 'useProbability',
  'use_regex', 'useRegex', 'extensions', 'position', 'role', 'selectiveLogic',
  'insertionOrder', 'scanDepth', 'preventRecursion', 'excludeRecursion',
  'delayUntilRecursion', 'priority', 'case_sensitive', 'caseSensitive',
  'vectorized', 'addMemo', 'ignoreBudget', 'matchPersonaDescription',
  'matchCharacterDescription', 'matchCharacterPersonality',
  'matchCharacterDepthPrompt', 'matchScenario', 'matchCreatorNotes',
  'outletName', 'group', 'groupOverride', 'groupWeight', 'matchWholeWords',
  'useGroupScoring', 'automationId', 'sticky', 'cooldown', 'delay', 'triggers',
  'displayIndex', 'characterFilter',
]);

export function normalizeWorldInfoBook(source, options) {
  if (!isRecord(source)) throw new Error('World-info export must be a JSON object.');
  const rawEntries = source.entries;
  if (!Array.isArray(rawEntries) && !isRecord(rawEntries)) {
    throw new Error('World-info export must contain an entries object or array.');
  }
  const now = options.now ?? new Date();
  const sourceName = source.name ?? source.title ?? fileStem(options.filePath);
  const runId = options.importId ?? `st-world-${slugify(sourceName)}-${timestampId(now)}`;
  const layerId = `st-world-${slugify(sourceName)}-${timestampId(now)}`;
  const entries = [];
  const skipped = [];
  const manualReview = [];
  const values = Array.isArray(rawEntries) ? rawEntries : Object.values(rawEntries);

  values.forEach((rawEntry, index) => {
    if (!isRecord(rawEntry)) {
      skipped.push({ index, reason: 'entry is not an object' });
      return;
    }
    const body = firstString(rawEntry.content, rawEntry.body);
    if (body === undefined) {
      skipped.push({ index, uid: rawEntry.uid ?? rawEntry.id, reason: 'entry content/body is missing' });
      return;
    }
    const uid = String(rawEntry.uid ?? rawEntry.id ?? index + 1);
    const title = firstString(rawEntry.comment, rawEntry.name) ?? `Lore ${uid}`;
    const primaryKeys = strings(rawEntry.key ?? rawEntry.keys);
    const secondaryKeys = strings(rawEntry.keysecondary ?? rawEntry.secondary_keys);
    const recursionControls = {
      prevent_recursion: booleanOrUndefined(rawEntry.prevent_recursion ?? rawEntry.preventRecursion),
      exclude_recursion: booleanOrUndefined(rawEntry.exclude_recursion ?? rawEntry.excludeRecursion),
      delay_until_recursion: numberOrUndefined(rawEntry.delay_until_recursion ?? rawEntry.delayUntilRecursion),
    };
    const unsupportedFields = [];
    if (rawEntry.use_regex === true || rawEntry.useRegex === true) unsupportedFields.push('use_regex');
    if (isRecord(rawEntry.extensions) && Object.keys(rawEntry.extensions).length > 0) {
      unsupportedFields.push('extensions');
    }
    const unknownFields = Object.keys(rawEntry).filter((key) => !KNOWN_FIELDS.has(key));
    if (unsupportedFields.length > 0 || unknownFields.length > 0) {
      manualReview.push({ uid, title, unsupportedFields, unknownFields });
    }
    const insertionOrder = numberOrUndefined(rawEntry.insertion_order ?? rawEntry.insertionOrder ?? rawEntry.order ?? rawEntry.priority) ?? index;
    entries.push({
      recordId: `st-lore-${shortHash(`${runId}:${uid}`)}`,
      title,
      body,
      worldId: options.profileId,
      entityId: title,
      canonStatus: 'draft',
      visibility: 'public',
      primaryKeys,
      secondaryKeys,
      constant: Boolean(rawEntry.constant ?? rawEntry.is_constant ?? false),
      enabled: rawEntry.disable === true ? false : rawEntry.enabled !== false,
      insertionOrder,
      scanDepth: numberOrUndefined(rawEntry.scan_depth ?? rawEntry.scanDepth ?? rawEntry.depth) ?? 4,
      probability: normalizeProbability(rawEntry),
      rawMetadata: {
        sillyTavernUid: uid,
        selective: Boolean(rawEntry.selective ?? rawEntry.selectiveLogic),
        recursionControls,
        unsupportedFields,
        unknownFields,
        source: rawEntry,
      },
    });
  });

  if (entries.length === 0) {
    throw new Error(`World-info export contains no importable entries (${skipped.length} skipped).`);
  }

  return {
    plan: {
      profileId: options.profileId,
      importId: runId,
      provenance: {
        source: 'sillytavern_world_info',
        sourceFile: options.filePath,
        importedAt: now.toISOString(),
      },
      rawSource: { filePath: options.filePath, bookName: sourceName },
      loreLayer: {
        layerId,
        name: `${sourceName} (import ${now.toISOString()})`,
        description: 'Readonly SillyTavern world-info snapshot. Legacy controls are preserved in entry provenance.',
        purpose: 'mixed',
        writePolicy: 'readonly',
      },
      loreEntries: entries,
      transcriptRows: [],
    },
    report: {
      sourceFile: options.filePath,
      sourceName,
      importId: runId,
      layerId,
      sourceEntryCount: values.length,
      importableEntryCount: entries.length,
      skipped,
      manualReview,
      constants: entries.filter((entry) => entry.constant).length,
      disabled: entries.filter((entry) => !entry.enabled).length,
    },
  };
}

function fileStem(filePath) {
  const name = basename(filePath ?? 'Imported ST lorebook');
  return name.slice(0, Math.max(0, name.length - extname(name).length)) || 'Imported ST lorebook';
}

function normalizeProbability(entry) {
  if (entry.useProbability === false) return 1;
  const value = numberOrUndefined(entry.probability);
  if (value === undefined) return 1;
  return value > 1 ? Math.min(1, Math.max(0, value / 100)) : Math.min(1, Math.max(0, value));
}

function strings(value) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
}

function firstString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim() !== '')?.trim();
}

function numberOrUndefined(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function booleanOrUndefined(value) {
  return typeof value === 'boolean' ? value : undefined;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

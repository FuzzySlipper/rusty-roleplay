import assert from 'node:assert/strict';
import test from 'node:test';

import { main } from '../validate-migration.mjs';
import { characterDetailEntries, characterId, parseCharacterCardJson } from '../lib/character-card.mjs';
import { normalizeWorldInfoBook } from '../lib/world-info.mjs';
import { readFile } from 'node:fs/promises';

test('validator compares character, layer, entry mapping, and recall readback', async () => {
  const profileId = 'profile-a';
  const characterCard = parseCharacterCardJson(await readFile('/home/stash/st-example/Character Card - Crown Prince Xavier.json', 'utf8'));
  const loreSource = JSON.parse(await readFile('/home/stash/st-example/Lorebook - LaDS_Philos.json', 'utf8'));
  const normalized = normalizeWorldInfoBook(loreSource, { profileId, filePath: 'Lorebook - LaDS_Philos.json' });
  const characterLayer = `${characterCard.character.name} — character details`;
  const expectedDetails = characterDetailEntries(characterCard, { profileId, characterId: characterId(profileId, characterCard.character.name) }).length + 24;
  const sample = normalized.plan.loreEntries[0];
  const loreEntry = { constant: sample.constant, record: { title: sample.title, body: sample.body, content: { lore_controls: { primary_keys: sample.primaryKeys, constant: sample.constant } } } };
  const client = {
    async get(path) {
      if (path.includes('/characters?')) return { items: [{ name: characterCard.character.name }] };
      if (path.includes('/lore/layers?')) return { layers: [
        { layer_id: 'character-layer', name: characterLayer, created_at: '2026-01-01' },
        { layer_id: 'world-layer', name: `${normalized.report.sourceName} (import 2026-01-01)`, created_at: '2026-01-01' },
      ] };
      if (path.includes('/character-layer/entries')) return { entries: Array.from({ length: expectedDetails }, (_, index) => ({ record: { title: `detail ${index}` } })) };
      if (path.includes('/world-layer/entries')) return { entries: [loreEntry, ...Array.from({ length: 23 }, (_, index) => ({ record: { title: `other ${index}` } }))] };
      if (path.includes('/entries/search?')) return { entries: [loreEntry] };
      throw new Error(`unexpected path ${path}`);
    },
  };
  const chunks = [];
  const report = await main(['/home/stash/st-example', '--profile', profileId], { client, stdout: { write: (chunk) => chunks.push(chunk) } });
  assert.equal(report.migrationComplete, true);
  assert.ok(report.manualReview.length > 0);
  assert.equal(report.shutdownEligible, false);
  assert.match(chunks.join(''), /Migration checks passed/);
});

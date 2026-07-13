import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { characterDetailEntries, parseCharacterCardJson, parsePngCharacterCard } from '../lib/character-card.mjs';

const fixtureRoot = '/home/stash/st-example';

test('decodes the real V3 JSON card and embedded lorebook', async () => {
  const card = parseCharacterCardJson(await readFile(`${fixtureRoot}/Character Card - Crown Prince Xavier.json`, 'utf8'));
  assert.equal(card.character.name, 'Crown Prince Xavier');
  assert.ok(card.character.alternateGreetings.length > 0);
  assert.equal(Object.keys(card.embeddedLorebook.entries).length, 24);
  const details = characterDetailEntries(card, { profileId: 'profile-a', characterId: 'xavier' });
  assert.ok(details.some((entry) => entry.title.includes('background')));
  assert.ok(details.some((entry) => entry.title.includes('personality')));
  assert.ok(details.some((entry) => entry.title.includes('relationship')));
});

test('decodes the real PNG chara chunk and supplies its avatar data URL', async () => {
  const card = parsePngCharacterCard(new Uint8Array(await readFile(`${fixtureRoot}/Character Card - Crown Prince Xavier.png`)));
  assert.equal(card.character.name, 'Crown Prince Xavier');
  assert.match(card.character.avatarUrl, /^data:image\/png;base64,/);
});

test('rejects invalid cards with a specific message', () => {
  assert.throws(() => parseCharacterCardJson('{"spec":"chara_card_v3","data":{}}'), /missing a name/);
  assert.throws(() => parseCharacterCardJson('{"name":"World","entries":{}}'), /not a SillyTavern character card/);
  assert.throws(() => parsePngCharacterCard(new Uint8Array([1, 2, 3])), /not a valid PNG/);
});

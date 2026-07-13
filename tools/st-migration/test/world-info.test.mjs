import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeWorldInfoBook } from '../lib/world-info.mjs';

test('normalizes ST world-info fields into a readonly packet snapshot', () => {
  const result = normalizeWorldInfoBook({
    name: 'Aether',
    entries: {
      7: {
        uid: 7,
        comment: 'Silver Orchard',
        key: ['orchard', 'silver gate'],
        keysecondary: ['clockmaker'],
        content: 'The three-note song opens the gate.',
        constant: true,
        insertion_order: 12,
        scan_depth: 6,
        probability: 75,
        prevent_recursion: true,
        use_regex: true,
        extensions: { selectiveLogic: 1 },
      },
    },
  }, {
    profileId: 'profile-a',
    filePath: '/tmp/aether.json',
    now: new Date('2026-07-12T10:30:00.000Z'),
  });

  assert.equal(result.plan.loreLayer.writePolicy, 'readonly');
  assert.match(result.plan.loreLayer.name, /Aether \(import 2026-07-12/);
  assert.deepEqual(result.plan.loreEntries[0].primaryKeys, ['orchard', 'silver gate']);
  assert.deepEqual(result.plan.loreEntries[0].secondaryKeys, ['clockmaker']);
  assert.equal(result.plan.loreEntries[0].constant, true);
  assert.equal(result.plan.loreEntries[0].probability, 0.75);
  assert.equal(result.report.constants, 1);
  assert.deepEqual(result.report.manualReview[0].unsupportedFields, ['use_regex', 'extensions']);
});

test('skips malformed entries and rejects a book with none importable', () => {
  assert.throws(() => normalizeWorldInfoBook({ entries: [null, { uid: 2 }] }, {
    profileId: 'profile-a',
    filePath: '/tmp/bad.json',
  }), /no importable entries/);
});

test('each default run gets a timestamped layer and entry identity', () => {
  const source = { name: 'Book', entries: [{ uid: 1, content: 'Fact' }] };
  const first = normalizeWorldInfoBook(source, {
    profileId: 'p', filePath: 'book.json', now: new Date('2026-01-01T00:00:00Z'),
  });
  const second = normalizeWorldInfoBook(source, {
    profileId: 'p', filePath: 'book.json', now: new Date('2026-01-02T00:00:00Z'),
  });
  assert.notEqual(first.plan.loreLayer.layerId, second.plan.loreLayer.layerId);
  assert.notEqual(first.plan.loreEntries[0].recordId, second.plan.loreEntries[0].recordId);
});

test('preserves current ST camelCase recursion and ordering controls', () => {
  const result = normalizeWorldInfoBook({ entries: [{
    uid: 9, content: 'Fact', scanDepth: 8, priority: 14,
    preventRecursion: true, excludeRecursion: false, delayUntilRecursion: 2,
    selectiveLogic: 1,
  }] }, { profileId: 'p', filePath: 'book.json' });
  const entry = result.plan.loreEntries[0];
  assert.equal(entry.scanDepth, 8);
  assert.equal(entry.insertionOrder, 14);
  assert.deepEqual(entry.rawMetadata.recursionControls, {
    prevent_recursion: true, exclude_recursion: false, delay_until_recursion: 2,
  });
  assert.equal(entry.rawMetadata.selective, true);
});

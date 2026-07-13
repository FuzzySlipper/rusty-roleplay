import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { main } from '../import-characters.mjs';

test('bulk importer writes character, detail layer, and embedded lore through current API routes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'st-character-import-'));
  try {
    await writeFile(join(root, 'xavier.json'), await readFile('/home/stash/st-example/Character Card - Crown Prince Xavier.json'));
    const calls = [];
    const client = {
      async get(path) {
        calls.push({ method: 'GET', path });
        return { items: [] };
      },
      async post(path, body) {
        calls.push({ method: 'POST', path, body });
        return path.includes('/characters') ? { character: { id: body.id } } : {};
      },
    };
    const chunks = [];
    const report = await main([root, '--profile', 'profile-a'], {
      client,
      stdout: { write: (chunk) => chunks.push(chunk) },
    });
    assert.equal(report.imported.length, 1);
    assert.equal(report.failed.length, 0);
    assert.equal(calls.filter((call) => call.path === '/v1/admin/roleplay/lore/layers').length, 1);
    assert.equal(calls.filter((call) => call.path === '/v1/admin/roleplay/lore/entries').length, report.imported[0].detailEntries + 24);
    assert.match(chunks.join(''), /"embeddedLoreEntries": 24/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

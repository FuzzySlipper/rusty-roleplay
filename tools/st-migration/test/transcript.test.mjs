import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { main } from '../import-chat-history.mjs';
import { parseStTranscript } from '../lib/transcript.mjs';

const fixture = '/home/stash/st-example/Transcript - Crown Prince Xavier.jsonl';

test('parses the real transcript with metadata, provenance, timestamps, and swipes', async () => {
  const transcript = parseStTranscript(await readFile(fixture, 'utf8'), { filePath: fixture, profileId: 'profile-a' });
  assert.equal(transcript.rows.length, 71);
  assert.equal(transcript.metadataRows.length, 1);
  assert.equal(transcript.assistantRows, 36);
  assert.equal(transcript.swipeRows, 36);
  assert.equal(transcript.assistantName, 'Crown Prince Xavier');
  assert.ok(transcript.timestampRange.first);
  assert.ok(transcript.timestampRange.last);
  assert.equal(transcript.errors.length, 0);
});

test('imports, associates, archives, and reads back the transcript through current routes', async () => {
  const calls = [];
  const client = {
    async get(path) {
      calls.push({ method: 'GET', path });
      if (path.includes('/characters?')) return { items: [{ id: 'xavier', name: 'Crown Prince Xavier' }] };
      if (path.includes('/personas?')) return { items: [{ id: 'kopis', displayName: 'Kopis Valliren' }] };
      if (path.includes('/sessions?')) return { items: [] };
      if (path.includes('/slots?')) return { items: Array.from({ length: 71 }, () => ({})) };
      throw new Error(`unexpected GET ${path}`);
    },
    async post(path, body) {
      calls.push({ method: 'POST', path, body });
      if (path.endsWith('/archive')) return { session: { status: 'archived' } };
      return { counts: { variants: 82 } };
    },
    async patch(path, body) {
      calls.push({ method: 'PATCH', path, body });
      return { session: body };
    },
  };
  const chunks = [];
  const report = await main([fixture, '--profile', 'profile-a'], { client, stdout: { write: (chunk) => chunks.push(chunk) } });
  assert.equal(report.imported[0].messages, 71);
  assert.equal(report.imported[0].archived, true);
  assert.equal(report.imported[0].characterId, 'xavier');
  assert.ok(calls.some((call) => call.method === 'POST' && call.path === '/v1/admin/roleplay/imports/st-packet'));
  assert.ok(calls.some((call) => call.method === 'POST' && call.path.endsWith('/archive')));
  assert.match(chunks.join(''), /"messages": 71/);
});

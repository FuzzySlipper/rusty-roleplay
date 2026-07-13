#!/usr/bin/env node
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

import { RustyCrewApiClient } from './lib/api-client.mjs';
import { parseCliArgs, printJson, requiredOption, usageError } from './lib/cli.mjs';
import { parseStTranscript } from './lib/transcript.mjs';

const USAGE = `Usage: node tools/st-migration/import-chat-history.mjs <chat.jsonl-or-directory> --profile <profile-id> [options]

Options:
  --api <url>          rusty-crew base URL (default: http://127.0.0.1:9348)
  --token <token>      Admin bearer token (or RUSTY_CREW_ADMIN_TOKEN)
  --character <name>  Character name to associate (default: infer from transcript)
  --persona <name>    Player persona name to associate (default: infer from transcript)
  --dry-run           Parse and report without writing`;

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const { values, positionals } = parseCliArgs(argv, {
    profile: { type: 'string' }, api: { type: 'string' }, token: { type: 'string' },
    character: { type: 'string' }, persona: { type: 'string' },
    'dry-run': { type: 'boolean', name: 'dryRun' },
  });
  if (positionals.length !== 1) throw usageError('Provide one ST JSONL chat or directory.', USAGE);
  const profileId = requiredOption(values, 'profile');
  const paths = await discoverTranscriptPaths(positionals[0], dependencies.fs);
  if (paths.length === 0) throw new Error(`No .jsonl transcripts found at ${positionals[0]}.`);
  const parsed = [];
  const failed = [];
  for (const path of paths) {
    try {
      parsed.push({ path, transcript: parseStTranscript(await (dependencies.readFile ?? readFile)(path, 'utf8'), { filePath: path, profileId }) });
    } catch (error) {
      failed.push({ path, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  const client = dependencies.client ?? new RustyCrewApiClient({ baseUrl: values.api, token: values.token ?? process.env.RUSTY_CREW_ADMIN_TOKEN });
  let characters = [];
  let personas = [];
  let sessions = [];
  if (!values.dryRun) {
    const [characterData, personaData, sessionData] = await Promise.all([
      client.get(`/v1/admin/roleplay/profiles/${encodeURIComponent(profileId)}/characters?include_archived=true`),
      client.get(`/v1/admin/roleplay/profiles/${encodeURIComponent(profileId)}/personas?include_archived=true`),
      client.get(`/v1/admin/roleplay/sessions?profile_id=${encodeURIComponent(profileId)}`),
    ]);
    characters = characterData.items ?? characterData.characters ?? [];
    personas = personaData.items ?? personaData.personas ?? [];
    sessions = sessionData.items ?? [];
  }
  const imported = [];
  const skipped = [];
  if (!values.dryRun) {
    for (const item of parsed) {
      if (sessions.some((session) => (session.sessionId ?? session.session_id) === item.transcript.sessionId)) {
        skipped.push({ path: item.path, sessionId: item.transcript.sessionId, reason: 'session already exists' });
        continue;
      }
      try {
        imported.push(await importTranscript(client, item, profileId, {
          character: matchByName(characters, values.character ?? item.transcript.assistantName),
          persona: matchByName(personas, values.persona ?? item.transcript.userName),
        }));
      } catch (error) {
        failed.push({ path: item.path, sessionId: item.transcript.sessionId, reason: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  const report = {
    dryRun: Boolean(values.dryRun), profileId,
    transcripts: parsed.map(({ path, transcript }) => ({
      path, sessionId: transcript.sessionId, title: transcript.title, messages: transcript.rows.length,
      assistantName: transcript.assistantName, userName: transcript.userName,
      timestampRange: transcript.timestampRange, swipeRows: transcript.swipeRows,
      parseErrors: transcript.errors,
    })),
    imported, skipped, failed,
  };
  printJson(report, dependencies.stdout);
  if (failed.length > 0 && parsed.length === 0) process.exitCode = 1;
  return report;
}

export async function discoverTranscriptPaths(inputPath, fs = { stat, readdir }) {
  const info = await fs.stat(inputPath);
  if (info.isFile()) return extname(inputPath).toLowerCase() === '.jsonl' ? [inputPath] : [];
  if (!info.isDirectory()) return [];
  return (await fs.readdir(inputPath)).filter((name) => extname(name).toLowerCase() === '.jsonl').sort().map((name) => join(inputPath, name));
}

async function importTranscript(client, item, profileId, associations) {
  const transcript = item.transcript;
  const importId = `st-chat-${transcript.sessionId}`;
  const result = await client.post('/v1/admin/roleplay/imports/st-packet', {
    profileId, importId,
    provenance: {
      source: 'sillytavern_chat_history', sourceFile: item.path,
      timestampRange: transcript.timestampRange, metadataRows: transcript.metadataRows,
      readOnlyReference: true,
    },
    rawSource: { filePath: item.path, metadataRows: transcript.metadataRows },
    session: { sessionId: transcript.sessionId, displayName: transcript.title },
    transcriptRows: transcript.rows,
    loreEntries: [],
  });
  const patch = {};
  if (associations.character) patch.characterId = recordId(associations.character);
  if (associations.persona) patch.playerPersonaId = recordId(associations.persona);
  if (Object.keys(patch).length > 0) {
    await client.patch(`/v1/admin/roleplay/sessions/${encodeURIComponent(transcript.sessionId)}`, patch);
  }
  const archived = await client.post(`/v1/admin/roleplay/sessions/${encodeURIComponent(transcript.sessionId)}/archive`, {});
  const slots = await client.get(`/v1/chat/sessions/${encodeURIComponent(transcript.sessionId)}/slots?include_alternates=true`);
  const slotItems = slots.items ?? [];
  if (slotItems.length !== transcript.rows.length) {
    throw new Error(`message readback mismatch: imported ${transcript.rows.length}, read back ${slotItems.length}`);
  }
  const session = archived.session ?? archived;
  if ((session.status ?? (session.archived ? 'archived' : undefined)) !== 'archived') {
    throw new Error('session archive readback did not report archived status');
  }
  return {
    path: item.path, importId, sessionId: transcript.sessionId, messages: transcript.rows.length,
    variants: result.counts?.variants, characterId: patch.characterId, playerPersonaId: patch.playerPersonaId,
    timestampRange: transcript.timestampRange, archived: true,
  };
}

function matchByName(records, name) {
  if (!name) return undefined;
  return records.find((record) => String(record.name ?? record.displayName ?? record.display_name ?? '').toLowerCase() === name.toLowerCase());
}
function recordId(record) { return record.id ?? record.character_id ?? record.persona_id; }

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = error.exitCode ?? 1;
  });
}

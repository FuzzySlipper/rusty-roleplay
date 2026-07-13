#!/usr/bin/env node
import { RustyCrewApiClient } from './lib/api-client.mjs';
import { parseCliArgs, printJson, requiredOption, usageError } from './lib/cli.mjs';
import { expectedCharacterLayer, inventoryStSources } from './lib/source-inventory.mjs';

const USAGE = `Usage: node tools/st-migration/validate-migration.mjs <source-directory> --profile <profile-id> [options]

Options:
  --api <url>        rusty-crew base URL (default: http://127.0.0.1:9348)
  --token <token>    Admin bearer token (or RUSTY_CREW_ADMIN_TOKEN)
  --query <text>     Lore search probe (default: first imported trigger key/title)
  --session <id>     Also verify an imported archived session and message readback`;

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const { values, positionals } = parseCliArgs(argv, {
    profile: { type: 'string' }, api: { type: 'string' }, token: { type: 'string' },
    query: { type: 'string' }, session: { type: 'string' },
  });
  if (positionals.length !== 1) throw usageError('Provide one ST source directory.', USAGE);
  const profileId = requiredOption(values, 'profile');
  const inventory = await inventoryStSources(positionals[0], dependencies.fs);
  const client = dependencies.client ?? new RustyCrewApiClient({
    baseUrl: values.api, token: values.token ?? process.env.RUSTY_CREW_ADMIN_TOKEN,
  });
  const [charactersData, layersData] = await Promise.all([
    client.get(`/v1/admin/roleplay/profiles/${encodeURIComponent(profileId)}/characters?include_archived=true`),
    client.get(`/v1/admin/roleplay/lore/layers?profile_id=${encodeURIComponent(profileId)}`),
  ]);
  const characters = charactersData.items ?? charactersData.characters ?? [];
  const layers = layersData.layers ?? [];
  const checks = [];
  const manualReview = inventory.lorebooks.flatMap((book) => book.normalized.report.manualReview.map((entry) => ({ sourceFile: book.path, ...entry })));

  for (const source of inventory.characters) {
    const name = source.card.character.name;
    const stored = characters.find((character) => String(character.name).toLowerCase() === name.toLowerCase());
    checks.push(check(`character:${name}`, Boolean(stored), { expected: name, actual: stored?.name }));
    const expectedLayer = expectedCharacterLayer(source, profileId);
    const layer = latestLayer(layers.filter((candidate) => candidate.name === expectedLayer.layerName));
    checks.push(check(`character-layer:${name}`, Boolean(layer), { expected: expectedLayer.layerName, actual: layer?.name }));
    if (layer) {
      const entries = await layerEntries(client, layerId(layer));
      checks.push(check(`character-layer-count:${name}`, entries.length === expectedLayer.expectedEntryCount, {
        expected: expectedLayer.expectedEntryCount, actual: entries.length, layerId: layerId(layer),
      }));
    }
  }

  let recallProbe;
  for (const source of inventory.lorebooks) {
    const expected = source.normalized;
    const namePrefix = `${expected.report.sourceName} (import `;
    const layer = latestLayer(layers.filter((candidate) => String(candidate.name ?? '').startsWith(namePrefix)));
    checks.push(check(`lore-layer:${expected.report.sourceName}`, Boolean(layer), { expectedPrefix: namePrefix, actual: layer?.name }));
    if (!layer) continue;
    const entries = await layerEntries(client, layerId(layer));
    checks.push(check(`lore-layer-count:${expected.report.sourceName}`, entries.length === expected.report.importableEntryCount, {
      expected: expected.report.importableEntryCount, actual: entries.length, layerId: layerId(layer),
    }));
    const sample = expected.plan.loreEntries[0];
    const actual = entries.find((entry) => entryTitle(entry) === sample.title);
    checks.push(check(`lore-sample-body:${expected.report.sourceName}`, entryBody(actual) === sample.body, { expectedTitle: sample.title }));
    checks.push(check(`lore-sample-keys:${expected.report.sourceName}`, sameStrings(entryKeys(actual), sample.primaryKeys), {
      expected: sample.primaryKeys, actual: entryKeys(actual),
    }));
    checks.push(check(`lore-sample-constant:${expected.report.sourceName}`, entryConstant(actual) === sample.constant, {
      expected: sample.constant, actual: entryConstant(actual),
    }));
    if (!recallProbe) recallProbe = { layerId: layerId(layer), sample };
  }

  if (recallProbe) {
    const query = values.query ?? recallProbe.sample.primaryKeys?.[0] ?? recallProbe.sample.title;
    const params = new URLSearchParams({ profile_id: profileId, q: query, limit: '20' });
    params.append('layer_id', recallProbe.layerId);
    const search = await client.get(`/v1/admin/roleplay/lore/entries/search?${params}`);
    const found = (search.entries ?? []).some((entry) => entryTitle(entry) === recallProbe.sample.title || entryBody(entry) === recallProbe.sample.body);
    checks.push(check('lore-recall-probe', found, { query, layerId: recallProbe.layerId, resultCount: search.entries?.length ?? 0 }));
  }

  if (values.session) {
    const session = await client.get(`/v1/admin/roleplay/sessions/${encodeURIComponent(values.session)}`);
    const slots = await client.get(`/v1/chat/sessions/${encodeURIComponent(values.session)}/slots?include_alternates=true`);
    const status = session.session?.status ?? session.status;
    checks.push(check(`archived-session:${values.session}`, status === 'archived', { expected: 'archived', actual: status }));
    checks.push(check(`archived-session-messages:${values.session}`, (slots.items ?? []).length > 0, { actual: (slots.items ?? []).length }));
  }

  const failedChecks = checks.filter((item) => !item.passed);
  const report = {
    profileId, sourceDirectory: positionals[0], generatedAt: new Date().toISOString(),
    sourceCounts: { characters: inventory.characters.length, lorebooks: inventory.lorebooks.length, transcripts: inventory.transcripts.length },
    destinationCounts: { characters: characters.length, layers: layers.length },
    checks, manualReview, ignoredSources: inventory.ignored,
    migrationComplete: failedChecks.length === 0,
    shutdownEligible: failedChecks.length === 0 && manualReview.length === 0,
    summary: failedChecks.length === 0
      ? manualReview.length === 0 ? 'Migration checks passed. ST shutdown is eligible.' : `Migration checks passed with ${manualReview.length} entries requiring manual metadata review.`
      : `${failedChecks.length} migration check(s) failed. ST shutdown is not eligible.`,
  };
  printJson(report, dependencies.stdout);
  if (failedChecks.length > 0) process.exitCode = 1;
  return report;
}

async function layerEntries(client, id) {
  const data = await client.get(`/v1/admin/roleplay/lore/layers/${encodeURIComponent(id)}/entries`);
  return data.entries ?? [];
}

function latestLayer(layers) {
  return [...layers].sort((left, right) => String(right.created_at ?? right.createdAt ?? '').localeCompare(String(left.created_at ?? left.createdAt ?? '')))[0];
}

function layerId(layer) { return String(layer.layer_id ?? layer.layerId ?? ''); }
function entryRecord(entry) { return entry?.record ?? entry ?? {}; }
function entryTitle(entry) { return entryRecord(entry).title; }
function entryBody(entry) { return entryRecord(entry).body; }
function entryConstant(entry) { return entry?.constant ?? entry?.is_constant ?? entryRecord(entry).lore_controls?.constant ?? entryRecord(entry).content?.lore_controls?.constant; }
function entryKeys(entry) { return entryRecord(entry).lore_controls?.primary_keys ?? entryRecord(entry).content?.lore_controls?.primary_keys ?? []; }
function sameStrings(left, right) { return JSON.stringify([...left].sort()) === JSON.stringify([...(right ?? [])].sort()); }
function check(name, passed, evidence) { return { name, passed, evidence }; }

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = error.exitCode ?? 1;
  });
}

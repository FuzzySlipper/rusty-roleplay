#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

import { RustyCrewApiClient } from './lib/api-client.mjs';
import { parseCliArgs, printJson, requiredOption, usageError } from './lib/cli.mjs';
import { normalizeWorldInfoBook } from './lib/world-info.mjs';

const USAGE = `Usage: node tools/st-migration/import-world-info.mjs <world-info.json> --profile <profile-id> [options]

Options:
  --api <url>       rusty-crew base URL (default: http://127.0.0.1:9348)
  --token <token>   Admin bearer token (or RUSTY_CREW_ADMIN_TOKEN)
  --import-id <id>  Explicit import identifier
  --dry-run         Normalize and report without writing`;

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const { values, positionals } = parseCliArgs(argv, {
    profile: { type: 'string' },
    api: { type: 'string' },
    token: { type: 'string' },
    'import-id': { type: 'string', name: 'importId' },
    'dry-run': { type: 'boolean', name: 'dryRun' },
  });
  if (positionals.length !== 1) throw usageError('Provide exactly one world-info JSON file.', USAGE);
  const profileId = requiredOption(values, 'profile');
  const filePath = positionals[0];
  let source;
  try {
    source = JSON.parse(await (dependencies.readFile ?? readFile)(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const normalized = normalizeWorldInfoBook(source, {
    profileId,
    filePath,
    ...(values.importId ? { importId: values.importId } : {}),
    ...(dependencies.now ? { now: dependencies.now } : {}),
  });
  if (values.dryRun) {
    printJson({ dryRun: true, ...normalized.report }, dependencies.stdout);
    return normalized.report;
  }
  const client = dependencies.client ?? new RustyCrewApiClient({
    baseUrl: values.api,
    token: values.token ?? process.env.RUSTY_CREW_ADMIN_TOKEN,
  });
  const result = await client.post('/v1/admin/roleplay/imports/st-packet', normalized.plan);
  const report = { dryRun: false, ...normalized.report, backendCounts: result.counts };
  printJson(report, dependencies.stdout);
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = error.exitCode ?? 1;
  });
}

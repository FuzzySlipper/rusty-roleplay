import { describe, expect, it } from 'vitest';

import {
  buildStImportPlan,
  readArtifact,
  type StImportArtifact,
} from './st-import-planner';

describe('ST import planner', () => {
  it('maps a flat ST packet into the normalized bulk import shape', () => {
    const plan = buildStImportPlan(exampleArtifacts(), {
      profileId: 'profile-a',
      importId: 'fixture-import',
      sessionId: 'fixture-session',
    });

    expect(plan.importId).toBe('fixture-import');
    expect(plan.character?.['name']).toBe('Crown Prince Xavier');
    expect(plan.character?.['rawMetadata']).toMatchObject({
      system_prompt: 'Stay in character as {{char}}.',
      depth_prompt: 'Remember the court pressure.',
      post_history_instructions: 'Answer as prose.',
    });
    expect(plan.persona).toMatchObject({
      displayName: 'Kopis Valliren',
      description: '{{user}} is the bodyguard.',
    });
    expect(plan.loreLayer).toMatchObject({
      name: 'LaDS_Philos',
      writePolicy: 'readonly',
    });
    expect(plan.loreEntries).toHaveLength(2);
    expect(plan.loreEntries[0]).toMatchObject({
      title: 'House Veranthos',
      primaryKeys: ['Veranthos', 'minister'],
      constant: true,
      probability: 0.75,
    });
    expect(plan.transcriptMetadata).toMatchObject({
      metadataRows: [
        {
          source_index: 0,
          user_name: 'unused',
          character_name: 'unused',
          chat_metadata: {
            integrity: 'fixture-chat',
          },
        },
      ],
    });
    expect(plan.transcriptRows).toHaveLength(3);
    expect(plan.transcriptRows[0]?.['metadata']).toMatchObject({
      source_index: 1,
    });
    expect(plan.transcriptRows[2]).toMatchObject({
      role: 'assistant',
      swipe_id: 1,
      swipes: ['First option', 'Selected option'],
    });
    expect(plan.importSummary.counts).toEqual({
      characters: 1,
      personas: 1,
      loreEntries: 2,
      transcriptRows: 3,
      assistantRows: 2,
      assistantVariantRows: 1,
    });
    expect(plan.importSummary.notDuplicatedRuntimeCeremony.join(' ')).toContain(
      'keyword trigger/injection settings',
    );
  });

  it('detects artifact kinds from browser files', async () => {
    const files = [
      jsonFile('Character Card - Crown Prince Xavier.json', characterCard()),
      jsonFile('Persona - Kopis Valliren.json', persona()),
      jsonFile('Lorebook - LaDS_Philos.json', lorebook()),
      new File([transcriptJsonl()], 'Transcript - Crown Prince Xavier.jsonl', {
        type: 'application/x-ndjson',
      }),
      new File(['# compiled prompt'], 'Rendered Prompt Export.txt', {
        type: 'text/plain',
      }),
    ];
    const artifacts = await Promise.all(files.map(readArtifact));
    expect(artifacts.map((artifact) => artifact.kind)).toEqual([
      'character_card',
      'persona',
      'lorebook',
      'transcript',
      'rendered_prompt',
    ]);
    expect(artifacts.every((artifact) => artifact.sha256.length === 64)).toBe(
      true,
    );
  });
});

function exampleArtifacts(): readonly StImportArtifact[] {
  return [
    artifact('manifest', 'manifest.json', {
      package: 'st-example',
      generated: '2026-07-07T00:00:00Z',
      layout: {},
      files: {},
    }),
    artifact('character_card', 'Character Card - Crown Prince Xavier.json', characterCard()),
    artifact('persona', 'Persona - Kopis Valliren.json', persona()),
    artifact('lorebook', 'Lorebook - LaDS_Philos.json', lorebook()),
    artifact('preset', "Preset - Ava's Special.json", {
      prompts: [{ identifier: 'main', content: '{{char}} ceremony' }],
      prompt_order: [{ order: ['main'] }],
    }),
    {
      kind: 'transcript',
      fileName: 'Transcript - Crown Prince Xavier.jsonl',
      size: transcriptJsonl().length,
      sha256: 'd'.repeat(64),
      text: transcriptJsonl(),
    },
  ];
}

function artifact(
  kind: StImportArtifact['kind'],
  fileName: string,
  parsed: unknown,
): StImportArtifact {
  return {
    kind,
    fileName,
    size: JSON.stringify(parsed).length,
    sha256: 'a'.repeat(64),
    parsed,
    text: JSON.stringify(parsed),
  };
}

function characterCard(): Record<string, unknown> {
  return {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: 'Crown Prince Xavier',
      description: 'Heir under pressure.',
      personality: 'Controlled, sharp, tender only in private.',
      scenario: 'A court assignment turns dangerous.',
      first_mes: 'The prince glances up.',
      mes_example: 'Xavier: Be still.\n\nKopis: As you command.',
      alternate_greetings: ['A formal greeting'],
      tags: ['court', 'politics'],
      creator_notes: 'Imported from ST.',
      system_prompt: 'Stay in character as {{char}}.',
      depth_prompt: 'Remember the court pressure.',
      post_history_instructions: 'Answer as prose.',
      extensions: { favorite: true },
      character_book: {
        name: 'Xavier book',
        entries: { one: { content: 'Private lore' } },
      },
    },
  };
}

function persona(): Record<string, unknown> {
  return {
    spec: 'persona_v2',
    spec_version: '2.0',
    name: 'Kopis Valliren',
    description: '{{user}} is the bodyguard.',
    comment: 'Imported persona note.',
  };
}

function lorebook(): Record<string, unknown> {
  return {
    name: 'LaDS_Philos',
    description: 'Court lore.',
    entries: {
      '0': {
        uid: 1,
        comment: 'House Veranthos',
        content: 'A powerful ministerial house.',
        key: ['Veranthos', 'minister'],
        keysecondary: ['court'],
        constant: true,
        probability: 75,
        insertion_order: 10,
        scan_depth: 4,
      },
      '1': {
        uid: 2,
        comment: 'Bodyguard Cover',
        content: 'Kopis is assigned as a bodyguard under a cover story.',
        key: ['Kopis'],
      },
    },
  };
}

function transcriptJsonl(): string {
  return [
    JSON.stringify({
      chat_metadata: {
        integrity: 'fixture-chat',
      },
      user_name: 'unused',
      character_name: 'unused',
    }),
    JSON.stringify({
      name: 'Crown Prince Xavier',
      is_user: false,
      is_system: false,
      send_date: '2026-01-01T00:00:00Z',
      mes: 'Static opening.',
    }),
    JSON.stringify({
      name: 'Kopis',
      is_user: true,
      is_system: false,
      send_date: '2026-01-01T00:01:00Z',
      mes: 'I bring the tea tray.',
    }),
    JSON.stringify({
      name: 'Crown Prince Xavier',
      is_user: false,
      is_system: false,
      send_date: '2026-01-01T00:02:00Z',
      mes: 'First option',
      swipe_id: 1,
      swipes: ['First option', 'Selected option'],
      swipe_info: [{ model: 'a' }, { model: 'b', reasoning: 'private' }],
      extra: { api: 'openai', time_to_first_token: 123 },
    }),
  ].join('\n');
}

function jsonFile(fileName: string, value: unknown): File {
  return new File([JSON.stringify(value)], fileName, {
    type: 'application/json',
  });
}

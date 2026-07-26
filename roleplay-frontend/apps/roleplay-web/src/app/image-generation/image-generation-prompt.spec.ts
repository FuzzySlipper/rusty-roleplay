import type { ChatMessage } from '@rusty-view/chat-domain';
import type { RpCharacter } from '@rusty-roleplay/rp-character-menu';
import type { LoreEntry } from '@rusty-roleplay/rp-lorebook';
import { describe, expect, it } from 'vitest';

import type { PlayerPersona } from '../persona-management/player-persona.model';
import { buildRoleplayImagePrompt } from './image-generation-prompt';

describe('buildRoleplayImagePrompt', () => {
  it('assembles character, persona, scene, lore, and prose without tool details', () => {
    const prompt = buildRoleplayImagePrompt({
      mode: 'scene',
      customSubject: 'Moonlit framing',
      character: character(),
      persona: persona(),
      sceneLabel: 'The Dream Planet bridge',
      mood: 'tense',
      lore: [lore()],
      messages: [
        message('user', 'We enter the observatory.', 'hidden tool arguments'),
        message('assistant', 'Isaiah turns toward the broken window.'),
      ],
    });

    expect(prompt).toContain('Moonlit framing');
    expect(prompt).toContain('Prince Xavier');
    expect(prompt).toContain('Player persona');
    expect(prompt).toContain('The Dream Planet bridge');
    expect(prompt).toContain('Silver Observatory');
    expect(prompt).toContain('Isaiah turns toward the broken window.');
    expect(prompt).not.toContain('hidden tool arguments');
  });

  it('uses only the terminal prose for last-message mode', () => {
    const prompt = buildRoleplayImagePrompt({
      mode: 'last_message',
      customSubject: '',
      character: undefined,
      persona: undefined,
      sceneLabel: 'Bridge',
      mood: 'quiet',
      lore: [],
      messages: [
        message('user', 'Older prose.'),
        message('assistant', 'The newest visual moment.'),
      ],
    });

    expect(prompt).toContain('The newest visual moment.');
    expect(prompt).not.toContain('Older prose.');
  });

  it('keeps custom mode fully user controlled', () => {
    expect(
      buildRoleplayImagePrompt({
        mode: 'custom',
        customSubject: '  a brass compass on black velvet  ',
        character: character(),
        persona: persona(),
        sceneLabel: 'Ignored scene',
        mood: 'ignored',
        lore: [lore()],
        messages: [message('assistant', 'Ignored prose.')],
      }),
    ).toBe('a brass compass on black velvet');
  });
});

function message(
  role: 'user' | 'assistant',
  prose: string,
  toolDetail = '',
): ChatMessage {
  return {
    id: `${role}-${prose}`,
    sessionId: 'session-1',
    author: {
      role,
      displayName: role === 'user' ? 'Player' : 'Narrator',
    },
    createdAt: '2026-07-26T00:00:00Z',
    status: 'completed',
    blocks: [
      {
        id: `${role}-text`,
        messageId: `${role}-${prose}`,
        kind: 'text',
        content: prose,
        estimatedHeight: undefined,
        renderPolicy: 'full',
      },
      {
        id: `${role}-tool`,
        messageId: `${role}-${prose}`,
        kind: 'tool_call',
        content: toolDetail,
        estimatedHeight: undefined,
        renderPolicy: 'collapsed',
      },
    ],
  };
}

function character(): RpCharacter {
  return {
    id: 'xavier',
    name: 'Prince Xavier',
    description: 'Silver-haired swordsman',
    personality: 'Guarded and loyal',
    scenario: 'Searching the observatory',
    firstMessage: '',
    alternateGreetings: [],
    exampleMessages: [],
    tags: ['prince'],
    avatarUrl: undefined,
    status: 'active',
    createdAt: undefined,
    updatedAt: undefined,
  };
}

function persona(): PlayerPersona {
  return {
    id: 'player',
    profileId: 'lore',
    name: 'Ari',
    avatarUrl: undefined,
    avatarAssetRef: undefined,
    description: 'An astronomer in a blue coat',
    notes: '',
    tags: ['astronomer'],
    status: 'active',
    createdAt: undefined,
    updatedAt: undefined,
  };
}

function lore(): LoreEntry {
  return {
    recordId: 'lore-1',
    revision: 1,
    layerIds: ['world'],
    sourceLayerId: 'world',
    sourceLayerWritePolicy: 'manual',
    slug: 'silver-observatory',
    title: 'Silver Observatory',
    summary: 'A ruined tower with a clockwork telescope.',
    body: '',
    canonLevel: 'canon',
    tags: [],
    loreControls: {
      primaryKeys: [],
      secondaryKeys: [],
      enabled: true,
      constant: false,
      scanDepth: 4,
      insertionPosition: 'lore_block',
      insertionOrder: 0,
      probability: 1,
      retrievalRole: 'system',
      support: {
        primaryKeys: 'runtime',
        secondaryKeys: 'runtime',
        enabled: 'runtime',
        constant: 'runtime',
        scanDepth: 'runtime',
        insertionPosition: 'runtime',
        insertionOrder: 'runtime',
        probability: 'runtime',
        retrievalRole: 'runtime',
      },
    },
    capturedBy: '',
    captureReason: '',
    capturedAt: '',
    supersedesRecordId: '',
    supersededByRecordId: '',
  };
}

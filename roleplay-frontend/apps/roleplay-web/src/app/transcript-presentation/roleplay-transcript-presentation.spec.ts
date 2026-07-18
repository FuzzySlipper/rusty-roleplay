import type { ChatMessage } from '@rusty-view/chat-domain';
import { describe, expect, it, vi } from 'vitest';

import {
  decorateRoleplayMessages,
  decorateRoleplayMessage,
  loadRoleplayModelActivityVisibility,
  loadRoleplayTextStyle,
  roleplayTextSpans,
  saveRoleplayModelActivityVisibility,
  saveRoleplayTextStyle,
} from './roleplay-transcript-presentation';

describe('roleplay transcript presentation', () => {
  it('maps speaker identity snapshots into rusty-view speaker data', () => {
    const message = decorateRoleplayMessage(
      chatMessage({
        role: 'user',
        metadata: {
          speaker_identity: {
            speaker_kind: 'player',
            source_id: 'persona-a',
            display_name: 'Jorge',
            avatar_url: 'https://example.test/jorge.png',
          },
        },
      }),
    );

    expect(message.author.displayName).toBe('Jorge');
    expect(message.author.speaker).toEqual({
      label: 'Jorge',
      avatarUrl: 'https://example.test/jorge.png',
      initials: 'J',
      avatarAlt: 'Avatar for Jorge',
    });
  });

  it('keeps user and assistant speaker identities distinct', () => {
    const messages = decorateRoleplayMessages([
      chatMessage({
        role: 'user',
        metadata: {
          speaker_identity: {
            speaker_kind: 'player',
            display_name: 'Jorge',
            avatar_url: 'https://example.test/jorge.png',
          },
        },
      }),
      chatMessage({
        id: 'message-b',
        role: 'assistant',
        metadata: {
          speaker_identity: {
            speaker_kind: 'character',
            display_name: 'Seraphina',
            avatar_url: 'https://example.test/seraphina.png',
          },
        },
      }),
    ]);

    expect(messages.map((message) => message.author.speaker?.label)).toEqual([
      'Jorge',
      'Seraphina',
    ]);
    expect(
      messages.map((message) => message.author.speaker?.avatarUrl),
    ).toEqual([
      'https://example.test/jorge.png',
      'https://example.test/seraphina.png',
    ]);
  });

  it('leaves legacy messages on rusty-view role fallbacks', () => {
    const message = decorateRoleplayMessage(chatMessage({ role: 'assistant' }));

    expect(message.author.speaker).toBeUndefined();
  });

  it('creates text spans for dialogue, emphasis, and OOC text', () => {
    expect(roleplayTextSpans('"Hello." *Carefully.*\nOOC: note')).toEqual([
      { start: 0, end: 8, scope: 'quote' },
      { start: 9, end: 21, scope: 'emphasis' },
      { start: 22, end: 31, scope: 'muted' },
    ]);
  });

  it('persists text style settings per profile', () => {
    const storage = {
      getItem: vi.fn(() => null as string | null),
      setItem: vi.fn(),
    };

    saveRoleplayTextStyle(
      'profile-a',
      {
        presetId: 'custom',
        dialogueColor: '#111111',
        narrationColor: '#222222',
        emphasisColor: '#333333',
        oocColor: '#444444',
      },
      storage,
    );

    expect(storage.setItem).toHaveBeenCalledWith(
      'rusty-roleplay:text-style:profile-a',
      JSON.stringify({
        presetId: 'custom',
        dialogueColor: '#111111',
        narrationColor: '#222222',
        emphasisColor: '#333333',
        oocColor: '#444444',
      }),
    );

    storage.getItem.mockReturnValueOnce(
      JSON.stringify({ presetId: 'custom', dialogueColor: '#111111' }),
    );
    expect(loadRoleplayTextStyle('profile-a', storage).dialogueColor).toBe(
      '#111111',
    );
  });

  it('persists model activity visibility per profile and defaults to hidden', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    };

    expect(loadRoleplayModelActivityVisibility('profile-a', storage)).toBe(
      false,
    );

    saveRoleplayModelActivityVisibility('profile-a', true, storage);
    expect(storage.setItem).toHaveBeenCalledWith(
      'rusty-roleplay:model-activity:profile-a',
      'true',
    );
    expect(loadRoleplayModelActivityVisibility('profile-a', storage)).toBe(
      true,
    );
    expect(loadRoleplayModelActivityVisibility('profile-b', storage)).toBe(
      false,
    );
  });
});

function chatMessage(input: {
  readonly id?: string;
  readonly role: ChatMessage['author']['role'];
  readonly displayName?: string;
  readonly metadata?: ChatMessage['metadata'];
}): ChatMessage {
  return {
    id: input.id ?? 'message-a',
    sessionId: 'session-a',
    author: { role: input.role, displayName: input.displayName },
    createdAt: '2026-07-04T00:00:00Z',
    status: 'completed',
    blocks: [
      {
        id: 'block-a',
        messageId: input.id ?? 'message-a',
        kind: 'text',
        content: '"Hello."',
        estimatedHeight: undefined,
        renderPolicy: 'full',
      },
    ],
    ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
  };
}

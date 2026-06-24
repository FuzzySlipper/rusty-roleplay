import type { ChatMessage } from '@rusty-view/chat-domain';
import { describe, expect, it } from 'vitest';

import { NarratorCharacterDecorator } from './rp-message-decorators';

function message(role: ChatMessage['author']['role']): ChatMessage {
  return {
    id: 'm1',
    sessionId: 's1',
    author: { role, displayName: 'x' },
    createdAt: '2026-06-23T00:00:00Z',
    status: 'completed',
    blocks: [],
  };
}

describe('NarratorCharacterDecorator', () => {
  const decorator = new NarratorCharacterDecorator();

  it('decorates assistant turns as the narrator', () => {
    expect(decorator.canDecorate(message('assistant'))).toBe(true);
    expect(decorator.decorate(message('assistant')).className).toBe(
      'rp-narrator',
    );
  });

  it('decorates user turns as the character', () => {
    expect(decorator.canDecorate(message('user'))).toBe(true);
    expect(decorator.decorate(message('user')).className).toBe('rp-character');
  });

  it('ignores system and tool turns', () => {
    expect(decorator.canDecorate(message('system'))).toBe(false);
    expect(decorator.canDecorate(message('tool'))).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import type { ChatEvent } from '@rusty-view/protocol';

import { deriveNarratorPhase } from './narrator-phase';

function event(kind: string, payload: Record<string, unknown> = {}): ChatEvent {
  return {
    event_id: `evt-${kind}`,
    session_id: 'session-a',
    sequence_id: 1,
    created_at: '2026-07-04T00:00:00Z',
    kind: kind as ChatEvent['kind'],
    payload: payload as ChatEvent['payload'],
  };
}

describe('deriveNarratorPhase', () => {
  it('reads direct phase_change events from replay/open responses', () => {
    expect(
      deriveNarratorPhase([
        event('assistant_turn_started'),
        event('phase_change', { phase: 'reviewing' }),
      ]),
    ).toBe('reviewing');
  });

  it('reads unknown-wrapped phase_change events from older protocol parsers', () => {
    expect(
      deriveNarratorPhase([
        event('unknown', {
          raw: { kind: 'phase_change', payload: { phase: 'composing' } },
        }),
      ]),
    ).toBe('composing');
  });

  it('falls back to generic assistant lifecycle events', () => {
    expect(
      deriveNarratorPhase([
        event('assistant_turn_started'),
        event('assistant_text_delta'),
      ]),
    ).toBe('composing');
  });
});

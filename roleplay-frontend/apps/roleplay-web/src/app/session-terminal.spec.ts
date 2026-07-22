import { describe, expect, it } from 'vitest';

import { terminalAssistantMessageCompletedEventId } from './session-terminal';

describe('terminalAssistantMessageCompletedEventId', () => {
  it('returns a successful terminal assistant completion through trailing phase events', () => {
    expect(
      terminalAssistantMessageCompletedEventId([
        {
          kind: 'assistant_message_completed',
          event_id: 'session:2',
          payload: { status: 'completed' },
        },
        { kind: 'phase_change', event_id: 'session:3' },
      ]),
    ).toBe('session:2');
  });

  it('rejects a failed assistant completion that did not create an assistant slot', () => {
    expect(
      terminalAssistantMessageCompletedEventId([
        {
          kind: 'message_created',
          event_id: 'session:1',
          payload: { role: 'user' },
        },
        {
          kind: 'assistant_message_completed',
          event_id: 'session:2',
          payload: { status: 'failed' },
        },
      ]),
    ).toBeUndefined();
  });

  it('rejects an earlier assistant completion after a newer user message', () => {
    expect(
      terminalAssistantMessageCompletedEventId([
        {
          kind: 'assistant_message_completed',
          event_id: 'session:1',
          payload: { status: 'completed' },
        },
        {
          kind: 'message_created',
          event_id: 'session:2',
          payload: { role: 'user' },
        },
      ]),
    ).toBeUndefined();
  });
});

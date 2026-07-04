import type { ChatEvent } from '@rusty-view/protocol';
import type { NarratorPhase } from '@rusty-roleplay/rp-scene-controls';

export function deriveNarratorPhase(
  events: readonly ChatEvent[],
): NarratorPhase {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event === undefined) {
      continue;
    }
    if (event.kind === 'assistant_turn_finished') {
      return 'done';
    }
    if (event.kind === 'assistant_message_completed') {
      return 'reviewing';
    }
    if (event.kind === 'assistant_text_delta') {
      return 'composing';
    }
    if (event.kind === 'assistant_turn_started') {
      return 'exploring';
    }
    const phase = readPhaseChange(event);
    if (phase !== undefined) {
      return phase;
    }
  }
  return 'idle';
}

function readPhaseChange(event: ChatEvent): NarratorPhase | undefined {
  if (
    event.kind !== 'unknown' &&
    event.kind !== ('phase_change' as ChatEvent['kind'])
  ) {
    return undefined;
  }
  const payload = event.payload as Record<string, unknown>;
  if (!isRecord(payload)) {
    return undefined;
  }
  const raw = isRecord(payload['raw'])
    ? (payload['raw'] as Record<string, unknown>)
    : payload;
  const rawPayload = isRecord(raw['payload'])
    ? (raw['payload'] as Record<string, unknown>)
    : raw;
  const phase = rawPayload['phase'];
  return isNarratorPhase(phase) ? phase : undefined;
}

function isNarratorPhase(value: unknown): value is NarratorPhase {
  return (
    value === 'idle' ||
    value === 'exploring' ||
    value === 'composing' ||
    value === 'reviewing' ||
    value === 'done'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

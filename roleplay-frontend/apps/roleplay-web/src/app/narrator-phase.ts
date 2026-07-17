import type { ChatEvent } from '@rusty-view/protocol';
import type { NarratorPhase } from '@rusty-roleplay/rp-scene-controls';

export function deriveNarratorPhase(
  events: readonly ChatEvent[],
): NarratorPhase {
  let lifecycleFallback: NarratorPhase | undefined;
  let lifecycleWakeId: string | undefined;

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event === undefined) {
      continue;
    }
    const phase = readPhaseChange(event);
    if (
      phase !== undefined &&
      (lifecycleWakeId === undefined || readWakeId(event) === lifecycleWakeId)
    ) {
      return phase;
    }
    if (
      event.kind === 'assistant_turn_finished' ||
      event.kind === 'assistant_message_completed'
    ) {
      lifecycleFallback ??= 'done';
      lifecycleWakeId ??= readWakeId(event);
      continue;
    }
    if (event.kind === 'assistant_text_delta') {
      lifecycleFallback ??= 'composing';
      lifecycleWakeId ??= readWakeId(event);
      continue;
    }
    if (event.kind === 'assistant_turn_started') {
      lifecycleFallback ??= 'exploring';
      lifecycleWakeId ??= readWakeId(event);
    }
  }
  return lifecycleFallback ?? 'idle';
}

function readPhaseChange(event: ChatEvent): NarratorPhase | undefined {
  if (
    event.kind !== 'unknown' &&
    event.kind !== ('phase_change' as ChatEvent['kind'])
  ) {
    return undefined;
  }
  const payload = readEventPayload(event);
  if (payload === undefined) {
    return undefined;
  }
  const phase = payload['phase'];
  return isNarratorPhase(phase) ? phase : undefined;
}

function readWakeId(event: ChatEvent): string | undefined {
  const wakeId = readEventPayload(event)?.['wake_id'];
  return typeof wakeId === 'string' ? wakeId : undefined;
}

function readEventPayload(
  event: ChatEvent,
): Record<string, unknown> | undefined {
  const payload: unknown = event.payload;
  if (!isRecord(payload)) {
    return undefined;
  }
  const raw = isRecord(payload['raw']) ? payload['raw'] : payload;
  return isRecord(raw['payload']) ? raw['payload'] : raw;
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

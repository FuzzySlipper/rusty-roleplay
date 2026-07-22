/**
 * Returns the completed assistant event only when it is still the transcript's
 * terminal semantic message. Tool/phase events are ignored; a later user
 * message or a failed assistant completion makes alternatives unavailable.
 */
export function terminalAssistantMessageCompletedEventId(
  events: readonly {
    readonly kind?: string;
    readonly event_id?: string;
    readonly eventId?: string;
    readonly payload?: unknown;
  }[],
): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.kind === 'assistant_message_completed') {
      if (readEventPayloadString(event.payload, 'status') === 'failed') {
        return undefined;
      }
      return event.event_id ?? event.eventId ?? String(index);
    }
    if (
      event?.kind === 'message_created' &&
      readEventPayloadString(event.payload, 'role') === 'user'
    ) {
      return undefined;
    }
  }
  return undefined;
}

function readEventPayloadString(
  payload: unknown,
  key: string,
): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

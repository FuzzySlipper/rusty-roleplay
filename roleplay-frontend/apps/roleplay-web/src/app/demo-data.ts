import type { ChatMessage } from '@rusty-view/chat-domain';

const SESSION_ID = 'rp-session-a';

function textMessage(
  id: string,
  role: ChatMessage['author']['role'],
  displayName: string,
  text: string,
): ChatMessage {
  return {
    id,
    sessionId: SESSION_ID,
    author: { role, displayName },
    createdAt: new Date().toISOString(),
    status: 'completed',
    blocks: [
      {
        id: `${id}-b0`,
        messageId: id,
        kind: 'text',
        content: text,
        estimatedHeight: undefined,
        renderPolicy: 'full',
      },
    ],
  };
}

/**
 * A small hand-authored RP session used to prove the transcript renders through
 * the imported @rusty-view packages. Production demo content — deliberately not
 * sourced from @rusty-view/testing-fixtures (that package is test-only and the
 * module-boundary lint forbids production code from importing it).
 */
export const DEMO_MESSAGES: readonly ChatMessage[] = [
  textMessage(
    'm1',
    'assistant',
    'Narrator',
    'The northern road is quiet but for the wind. Snow gathers on the milestones marking the edge of Northmarch.',
  ),
  textMessage(
    'm2',
    'user',
    'Xavier',
    'I check the milestone for any recent tracks.',
  ),
  textMessage(
    'm3',
    'assistant',
    'Narrator',
    'Boot prints, half-filled with fresh snow — a small party passed within the hour, heading toward the baron’s hall.',
  ),
];

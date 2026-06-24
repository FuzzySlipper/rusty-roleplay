import type { ChatMessage } from '@rusty-view/chat-domain';
import type { RpCharacter } from '@rusty-roleplay/rp-character-menu';
import type {
  DiagnosticLine,
  MechanicProposal,
} from '@rusty-roleplay/rp-mechanic';

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

export const DEMO_CHARACTERS: readonly RpCharacter[] = [
  {
    id: 'xavier',
    name: 'Xavier Thorne',
    tagline: 'Duelist of the Silver Flame',
  },
  { id: 'caleb', name: 'Caleb Vance', tagline: 'Estranged rival' },
];

export const DEMO_PROPOSALS: readonly MechanicProposal[] = [
  {
    id: 'prop-1',
    summary: 'Boost "politics" tag weight for this campaign',
    reason: 'Political lore is under-retrieved in tense court scenes.',
  },
];

export const DEMO_LOGS: readonly DiagnosticLine[] = [
  {
    timestamp: '12:30:01',
    message: 'recall: northmarch-taxes included (score 0.92)',
  },
  {
    timestamp: '12:30:01',
    message: 'recall: caleb-arm skipped (excluded_subject)',
  },
];

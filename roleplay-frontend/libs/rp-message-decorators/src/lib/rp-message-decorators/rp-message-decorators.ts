import type { ChatMessage } from '@rusty-view/chat-domain';
import type {
  ChatMessageDecorator,
  ChatMessageDecoration,
} from '@rusty-view/transcript-renderer';

/**
 * Roleplay narrator/character decorator. This proves the boundary-proof
 * requirement: rusty-roleplay adds RP-specific message styling through
 * rusty-view's CHAT_MESSAGE_DECORATORS extension token without modifying the
 * base transcript renderer.
 *
 * Assistant turns are the narrator's voice; user turns are the player's
 * character. Each gets a className (for theming) and a small prefix marker.
 *
 * This module uses type-only imports from rusty-view so it stays a pure,
 * dependency-free unit (the DI token wiring lives in `providers.ts`).
 */
export class NarratorCharacterDecorator implements ChatMessageDecorator {
  readonly kind = 'rp-narrator-character';

  canDecorate(message: ChatMessage): boolean {
    return (
      message.author.role === 'assistant' || message.author.role === 'user'
    );
  }

  decorate(message: ChatMessage): ChatMessageDecoration {
    if (message.author.role === 'assistant') {
      return { className: 'rp-narrator', prefix: '📖 ', suffix: undefined };
    }
    return { className: 'rp-character', prefix: '🗨 ', suffix: undefined };
  }
}

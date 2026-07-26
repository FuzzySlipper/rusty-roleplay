import type { ChatMessage } from '@rusty-view/chat-domain';
import type { RpCharacter } from '@rusty-roleplay/rp-character-menu';
import type { LoreEntry } from '@rusty-roleplay/rp-lorebook';

import type { PlayerPersona } from '../persona-management/player-persona.model';
import type { RoleplayImageMode } from './image-generation.model';

export interface RoleplayImagePromptContext {
  readonly mode: RoleplayImageMode;
  readonly customSubject: string;
  readonly character: RpCharacter | undefined;
  readonly persona: PlayerPersona | undefined;
  readonly sceneLabel: string;
  readonly mood: string;
  readonly lore: readonly LoreEntry[];
  readonly messages: readonly ChatMessage[];
}

const MAX_PROMPT_LENGTH = 7_500;
const MAX_LORE_ENTRIES = 5;
const MAX_RECENT_MESSAGES = 4;

export function buildRoleplayImagePrompt(
  context: RoleplayImagePromptContext,
): string {
  if (context.mode === 'custom') {
    return context.customSubject.trim();
  }

  const sections = [
    modeInstruction(context.mode),
    context.customSubject.trim(),
    characterSection(context.character),
    personaSection(context.persona),
    sceneSection(context),
    loreSection(context.lore),
    recentChatSection(context.messages, context.mode),
  ].filter((section) => section.length > 0);

  return sections.join('\n\n').slice(0, MAX_PROMPT_LENGTH).trim();
}

function modeInstruction(mode: RoleplayImageMode): string {
  switch (mode) {
    case 'character':
      return 'Create a polished full-body character portrait. Preserve the character’s established appearance and personality. Use a simple scene-appropriate backdrop.';
    case 'face':
      return 'Create a close-up portrait centered on the active character’s face and expression. Preserve established features and mood.';
    case 'scene':
      return 'Illustrate the current roleplay scene as one coherent cinematic moment. Favor visible action, setting, lighting, and character continuity.';
    case 'last_message':
      return 'Illustrate the latest roleplay message faithfully. Do not introduce unrelated characters or events.';
    case 'background':
      return 'Create a wide environmental background for the current scene. Emphasize location, atmosphere, and lighting rather than a foreground portrait.';
    case 'custom':
      return '';
  }
}

function characterSection(character: RpCharacter | undefined): string {
  if (character === undefined) return '';
  return labelledSection('Active character', [
    character.name,
    character.description,
    character.personality,
    character.scenario,
    character.tags.length > 0 ? `Tags: ${character.tags.join(', ')}` : '',
  ]);
}

function personaSection(persona: PlayerPersona | undefined): string {
  if (persona === undefined) return '';
  return labelledSection('Player persona', [
    persona.name,
    persona.description,
    persona.tags.length > 0 ? `Tags: ${persona.tags.join(', ')}` : '',
  ]);
}

function sceneSection(context: RoleplayImagePromptContext): string {
  return labelledSection('Scene', [
    context.sceneLabel,
    context.mood ? `Mood: ${context.mood}` : '',
  ]);
}

function loreSection(lore: readonly LoreEntry[]): string {
  const entries = lore
    .slice(0, MAX_LORE_ENTRIES)
    .map((entry) =>
      [entry.title, entry.summary || entry.body]
        .filter((value) => value.trim().length > 0)
        .join(': '),
    );
  return labelledSection('Relevant lore', entries);
}

function recentChatSection(
  messages: readonly ChatMessage[],
  mode: RoleplayImageMode,
): string {
  const recentMessages =
    mode === 'last_message'
      ? messages.slice(-1)
      : messages.slice(-MAX_RECENT_MESSAGES);
  const lines = recentMessages
    .map((message) => {
      const prose = message.blocks
        .filter((block) => block.kind === 'text')
        .map((block) => block.content.trim())
        .filter((content) => content.length > 0)
        .join(' ');
      return prose.length > 0
        ? `${message.author.displayName || message.author.role}: ${prose}`
        : '';
    })
    .filter((line) => line.length > 0);
  return labelledSection(
    mode === 'last_message' ? 'Latest message' : 'Recent exchange',
    lines,
  );
}

function labelledSection(label: string, values: readonly string[]): string {
  const content = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join('\n');
  return content.length > 0 ? `${label}:\n${content}` : '';
}

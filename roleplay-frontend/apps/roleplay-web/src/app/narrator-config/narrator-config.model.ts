export type NarratorTone =
  | 'whimsical'
  | 'dramatic'
  | 'matter_of_fact'
  | 'lush'
  | 'wry';

export type NarratorPacing = 'leisurely' | 'balanced' | 'rapid' | 'breathless';

export type NarratorExplicitness =
  | 'implied'
  | 'suggestive'
  | 'romantic'
  | 'steamy';

export type NarratorMemoryDepth = 'shallow' | 'medium' | 'deep';

export interface NarratorReviewSettings {
  readonly enabled: boolean;
  readonly maxReviewCycles: number;
  readonly checkGravityDrift: boolean;
  readonly checkCharacterVoice: boolean;
  readonly checkContinuity: boolean;
}

export interface NarratorConfig {
  readonly tone: NarratorTone;
  readonly pacing: NarratorPacing;
  readonly explicitness: NarratorExplicitness;
  readonly memoryDepth: NarratorMemoryDepth;
  readonly exemplar: string;
  readonly review: NarratorReviewSettings;
}

export const DEFAULT_NARRATOR_CONFIG: NarratorConfig = {
  tone: 'lush',
  pacing: 'balanced',
  explicitness: 'romantic',
  memoryDepth: 'medium',
  exemplar: '',
  review: {
    enabled: false,
    maxReviewCycles: 1,
    checkGravityDrift: true,
    checkCharacterVoice: true,
    checkContinuity: true,
  },
};

export const NARRATOR_TONES: readonly NarratorTone[] = [
  'whimsical',
  'dramatic',
  'matter_of_fact',
  'lush',
  'wry',
];

export const NARRATOR_PACING: readonly NarratorPacing[] = [
  'leisurely',
  'balanced',
  'rapid',
  'breathless',
];

export const NARRATOR_EXPLICITNESS: readonly NarratorExplicitness[] = [
  'implied',
  'suggestive',
  'romantic',
  'steamy',
];

export const NARRATOR_MEMORY_DEPTHS: readonly NarratorMemoryDepth[] = [
  'shallow',
  'medium',
  'deep',
];

export function buildNarratorStylePrompt(config: NarratorConfig): string {
  return [
    'Narrator style prompt:',
    `- Tone: ${tonePrompt(config.tone)}`,
    `- Pacing: ${pacingPrompt(config.pacing)}`,
    `- Romantic explicitness: ${explicitnessPrompt(config.explicitness)}`,
    `- Memory depth: ${memoryDepthPrompt(config.memoryDepth)}`,
    reviewPrompt(config.review),
  ].join('\n');
}

function tonePrompt(tone: NarratorTone): string {
  switch (tone) {
    case 'whimsical':
      return 'keep the prose playful, curious, and lightly enchanted without breaking scene sincerity.';
    case 'dramatic':
      return 'heighten emotional stakes and vivid consequence while keeping character choices grounded.';
    case 'matter_of_fact':
      return 'write clean, direct narration with restrained imagery and practical scene clarity.';
    case 'lush':
      return 'use sensory, atmospheric prose with rich texture and emotional interiority.';
    case 'wry':
      return 'let dry humor and sharp observation color the narration without undercutting intimacy.';
  }
}

function pacingPrompt(pacing: NarratorPacing): string {
  switch (pacing) {
    case 'leisurely':
      return 'linger on sensory detail, reactions, and quiet beats before advancing the scene.';
    case 'balanced':
      return 'balance atmosphere, dialogue, action, and consequence in each turn.';
    case 'rapid':
      return 'move the scene forward briskly with compact description and clear momentum.';
    case 'breathless':
      return 'favor urgent, close-in narration with short beats and immediate consequences.';
  }
}

function explicitnessPrompt(explicitness: NarratorExplicitness): string {
  switch (explicitness) {
    case 'implied':
      return 'keep romance mostly subtextual, using implication, longing, and restraint.';
    case 'suggestive':
      return 'allow sensual tension and flirtation while avoiding graphic detail.';
    case 'romantic':
      return 'foreground emotional intimacy and desire in polished romantic prose.';
    case 'steamy':
      return 'allow more direct sensuality while preserving consent, character voice, and story stakes.';
  }
}

function memoryDepthPrompt(memoryDepth: NarratorMemoryDepth): string {
  switch (memoryDepth) {
    case 'shallow':
      return 'use only the most immediate scene facts unless continuity is directly relevant.';
    case 'medium':
      return 'recall important recent events, relationship context, and active lore.';
    case 'deep':
      return 'actively weave established continuity, long-running emotional threads, and durable lore into the turn.';
  }
}

function reviewPrompt(review: NarratorReviewSettings): string {
  if (!review.enabled || review.maxReviewCycles <= 0) {
    return '- Review: compose directly without a separate narrator review pass.';
  }

  const checks = [
    review.checkGravityDrift ? 'scene logic/stakes drift' : undefined,
    review.checkCharacterVoice ? 'character voice drift' : undefined,
    review.checkContinuity ? 'continuity drift' : undefined,
  ].filter((item): item is string => item !== undefined);

  const checklist =
    checks.length === 0 ? 'overall coherence' : checks.join(', ');
  const cycles =
    review.maxReviewCycles === 1
      ? 'one review pass'
      : `${review.maxReviewCycles} review passes`;

  return `- Review: before finalizing, run up to ${cycles} for ${checklist}; revise only when the pass finds a meaningful issue.`;
}

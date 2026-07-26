export type RoleplayImageMode =
  | 'character'
  | 'face'
  | 'scene'
  | 'last_message'
  | 'background'
  | 'custom';

export interface ImageGenerationPresetDefaults {
  readonly negativePrompt: string | undefined;
  readonly width: number;
  readonly height: number;
  readonly steps: number;
}

export interface ImageGenerationPresetLimits {
  readonly minWidth: number;
  readonly maxWidth: number;
  readonly minHeight: number;
  readonly maxHeight: number;
  readonly minSteps: number;
  readonly maxSteps: number;
  readonly maxPromptChars: number;
  readonly maxOutputs: number;
}

export interface ImageGenerationPresetSummary {
  readonly id: string;
  readonly version: string;
  readonly providerId: string;
  readonly defaults: ImageGenerationPresetDefaults;
  readonly limits: ImageGenerationPresetLimits;
  readonly styles: readonly string[];
}

export interface ImageGenerationRequest {
  readonly sessionId: string;
  readonly preset: string;
  readonly prompt: string;
  readonly negativePrompt?: string;
  readonly seed?: number;
  readonly width: number;
  readonly height: number;
  readonly steps: number;
  readonly style?: string;
  readonly mode: RoleplayImageMode;
  readonly includeInNarratorContext: boolean;
  readonly anchorMessageId?: string;
}

export interface GeneratedImageProvenance {
  readonly adapter: string | undefined;
  readonly providerId: string | undefined;
  readonly providerJobId: string | undefined;
  readonly presetId: string;
  readonly presetVersion: string | undefined;
  readonly prompt: string;
  readonly negativePrompt: string | undefined;
  readonly seed: number | undefined;
  readonly width: number | undefined;
  readonly height: number | undefined;
  readonly steps: number | undefined;
  readonly style: string | undefined;
}

export interface GeneratedImage {
  readonly id: string;
  readonly sessionId: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly url: string;
  readonly thumbnailUrl: string | undefined;
  readonly createdAt: string;
  readonly width: number | undefined;
  readonly height: number | undefined;
  readonly mode: RoleplayImageMode | undefined;
  readonly includeInNarratorContext: boolean;
  readonly linkedMessageId: string | undefined;
  readonly provenance: GeneratedImageProvenance;
}

export interface ImageGenerationModePreference {
  readonly includeInNarratorContext: boolean;
  readonly negativePrompt: string;
  readonly presetId: string | undefined;
  readonly style: string | undefined;
}

export const ROLEPLAY_IMAGE_MODES: readonly {
  readonly id: RoleplayImageMode;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    id: 'character',
    label: 'Character',
    description: 'Full character portrait using the active character.',
  },
  {
    id: 'face',
    label: 'Close-up',
    description: 'Close portrait focused on the active character’s face.',
  },
  {
    id: 'scene',
    label: 'Scene',
    description: 'Illustrate the current location and recent exchange.',
  },
  {
    id: 'last_message',
    label: 'Last message',
    description: 'Illustrate only the latest prose message.',
  },
  {
    id: 'background',
    label: 'Background',
    description: 'Wide environmental image without foreground UI.',
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Start from a freely editable prompt.',
  },
];

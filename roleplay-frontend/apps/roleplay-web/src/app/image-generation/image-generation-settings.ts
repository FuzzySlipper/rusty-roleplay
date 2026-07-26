import type {
  ImageGenerationModePreference,
  RoleplayImageMode,
} from './image-generation.model';

const STORAGE_PREFIX = 'rusty-roleplay:image-generation';

export const DEFAULT_IMAGE_MODE_PREFERENCE: ImageGenerationModePreference = {
  includeInNarratorContext: false,
  negativePrompt: '',
  presetId: undefined,
  style: undefined,
};

export function loadImageModePreference(
  profileId: string,
  mode: RoleplayImageMode,
  storage?: Pick<Storage, 'getItem'>,
): ImageGenerationModePreference {
  const selectedStorage = storage ?? browserStorage();
  if (selectedStorage === undefined) return DEFAULT_IMAGE_MODE_PREFERENCE;
  const stored = selectedStorage.getItem(storageKey(profileId, mode));
  if (stored === null) return DEFAULT_IMAGE_MODE_PREFERENCE;
  try {
    const value = JSON.parse(stored) as Record<string, unknown>;
    return {
      includeInNarratorContext: value['includeInNarratorContext'] === true,
      negativePrompt: readString(value['negativePrompt']) ?? '',
      presetId: readString(value['presetId']),
      style: readString(value['style']),
    };
  } catch {
    return DEFAULT_IMAGE_MODE_PREFERENCE;
  }
}

export function saveImageModePreference(
  profileId: string,
  mode: RoleplayImageMode,
  preference: ImageGenerationModePreference,
  storage?: Pick<Storage, 'setItem'>,
): void {
  const selectedStorage = storage ?? browserStorage();
  selectedStorage?.setItem(
    storageKey(profileId, mode),
    JSON.stringify(preference),
  );
}

function storageKey(profileId: string, mode: RoleplayImageMode): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(profileId)}:${mode}`;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function browserStorage(): Storage | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage;
}

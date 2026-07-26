import { describe, expect, it } from 'vitest';

import {
  loadImageModePreference,
  saveImageModePreference,
} from './image-generation-settings';

describe('image generation mode preferences', () => {
  it('defaults narrator context visibility off', () => {
    const storage = memoryStorage();

    expect(loadImageModePreference('profile', 'scene', storage)).toEqual({
      includeInNarratorContext: false,
      negativePrompt: '',
      presetId: undefined,
      style: undefined,
    });
  });

  it('persists controls independently for each generation mode', () => {
    const storage = memoryStorage();
    saveImageModePreference(
      'profile',
      'scene',
      {
        includeInNarratorContext: true,
        negativePrompt: 'watermark',
        presetId: 'scene-v1',
        style: 'cinematic',
      },
      storage,
    );

    expect(loadImageModePreference('profile', 'scene', storage)).toEqual({
      includeInNarratorContext: true,
      negativePrompt: 'watermark',
      presetId: 'scene-v1',
      style: 'cinematic',
    });
    expect(
      loadImageModePreference('profile', 'character', storage)
        .includeInNarratorContext,
    ).toBe(false);
  });
});

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

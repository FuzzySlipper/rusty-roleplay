import { describe, expect, it } from 'vitest';

import { requestFromDraft } from './first-narrator-setup';

describe('first narrator setup', () => {
  it('builds a trimmed narrator request from complete deployment settings', () => {
    expect(
      requestFromDraft({
        profileId: ' eva ',
        displayName: ' Eva ',
        providerAlias: ' eva-router ',
        providerDisplayName: ' Eva Router ',
        providerBaseUrl: 'http://router.test/v1/',
        modelId: ' model-a ',
        contextWindowTokens: '128000',
        maxOutputTokens: '4096',
        apiKey: ' ',
      }),
    ).toEqual({
      profileId: 'eva',
      displayName: 'Eva',
      providerAlias: 'eva-router',
      providerDisplayName: 'Eva Router',
      providerBaseUrl: 'http://router.test/v1',
      modelId: 'model-a',
      contextWindowTokens: 128000,
      maxOutputTokens: 4096,
      apiKey: undefined,
    });
  });

  it('rejects incomplete or invalid provider settings', () => {
    expect(
      requestFromDraft({
        profileId: 'roleplay',
        displayName: 'Roleplay',
        providerAlias: 'router',
        providerDisplayName: 'Router',
        providerBaseUrl: '',
        modelId: 'model-a',
        contextWindowTokens: 'not-a-number',
        maxOutputTokens: '0',
        apiKey: '',
      }),
    ).toBeNull();
  });
});

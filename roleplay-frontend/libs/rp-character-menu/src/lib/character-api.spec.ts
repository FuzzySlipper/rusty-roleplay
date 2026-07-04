import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CHARACTER_API_CONFIG,
  CharacterApi,
  mapCharacter,
} from './character-api';

describe('CharacterApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps snake_case character records into frontend models', () => {
    expect(
      mapCharacter({
        id: 'hero',
        name: 'Hero',
        description: 'Short description',
        personality: 'Curious',
        scenario: 'At the gate',
        first_message: 'Hello.',
        alternate_greetings: ['Hi.'],
        example_messages: ['Hero: Hello'],
        tags: ['player'],
        avatar_url: 'https://example.invalid/avatar.png',
        created_at: '2026-07-04T00:00:00Z',
        updated_at: '2026-07-04T00:00:01Z',
      }),
    ).toEqual({
      id: 'hero',
      name: 'Hero',
      description: 'Short description',
      personality: 'Curious',
      scenario: 'At the gate',
      firstMessage: 'Hello.',
      alternateGreetings: ['Hi.'],
      exampleMessages: ['Hero: Hello'],
      tags: ['player'],
      avatarUrl: 'https://example.invalid/avatar.png',
      status: 'active',
      createdAt: '2026-07-04T00:00:00Z',
      updatedAt: '2026-07-04T00:00:01Z',
      tagline: 'Short description',
    });
  });

  it('calls the list route with auth headers', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        data: { items: [{ id: 'hero', name: 'Hero' }] },
        meta: { request_id: 'req', schema_version: 1 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = createApi();

    const characters = await api.listCharacters('profile-a');

    expect(characters[0]?.id).toBe('hero');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://crew.test/v1/admin/roleplay/profiles/profile-a/characters',
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer token-a');
  });

  it('patches session character selection', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        data: { session: { session_id: 'session-a' } },
        meta: { request_id: 'req', schema_version: 1 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = createApi();

    await api.setSessionCharacter('session-a', 'hero');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://crew.test/v1/admin/roleplay/sessions/session-a',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ characterId: 'hero' }),
      }),
    );
  });
});

function createApi(): CharacterApi {
  TestBed.configureTestingModule({
    providers: [
      CharacterApi,
      {
        provide: CHARACTER_API_CONFIG,
        useValue: { baseUrl: 'http://crew.test', bearerToken: 'token-a' },
      },
    ],
  });
  return TestBed.inject(CharacterApi);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

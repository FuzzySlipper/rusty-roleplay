import { describe, expect, it } from 'vitest';

import {
  characterToTavernCardJson,
  parseCharacterCardJson,
  parsePngCharacterCard,
} from './character-card-codec';
import type { RpCharacter } from './character.model';

describe('character-card-codec', () => {
  it('maps SillyTavern v2 JSON cards into write requests', () => {
    const request = parseCharacterCardJson(
      JSON.stringify({
        spec: 'chara_card_v2',
        data: {
          name: 'Isolde',
          description: 'A court poet.',
          personality: 'Tender, dramatic',
          scenario: 'Moonlit balcony',
          first_mes: 'You came back.',
          alternate_greetings: ['You remembered the garden.'],
          mes_example: '<START>\n{{char}}: Stay.\n\n{{user}}: I cannot.',
          tags: ['romance', 'court'],
          avatar: 'https://example.invalid/isolde.png',
        },
      }),
    );

    expect(request).toEqual({
      name: 'Isolde',
      description: 'A court poet.',
      personality: 'Tender, dramatic',
      scenario: 'Moonlit balcony',
      firstMessage: 'You came back.',
      alternateGreetings: ['You remembered the garden.'],
      exampleMessages: ['<START>\n{{char}}: Stay.', '{{user}}: I cannot.'],
      tags: ['romance', 'court'],
      avatarUrl: 'https://example.invalid/isolde.png',
    });
  });

  it('reads PNG tEXt chara chunks', () => {
    const card = JSON.stringify({ data: { name: 'Png Hero' } });
    const png = pngWithTextChunk('chara', btoa(card));

    expect(parsePngCharacterCard(png).name).toBe('Png Hero');
  });

  it('exports a Tavern Card v2 compatible JSON shape', () => {
    const character: RpCharacter = {
      id: 'isolde',
      name: 'Isolde',
      description: 'A court poet.',
      personality: 'Tender',
      scenario: 'Balcony',
      firstMessage: 'You came back.',
      alternateGreetings: ['You remembered.'],
      exampleMessages: ['Example line.'],
      tags: ['romance'],
      avatarUrl: undefined,
      status: 'active',
      createdAt: undefined,
      updatedAt: undefined,
    };

    const exported = JSON.parse(characterToTavernCardJson(character)) as {
      data: Record<string, unknown>;
    };

    expect(exported.data['name']).toBe('Isolde');
    expect(exported.data['first_mes']).toBe('You came back.');
    expect(exported.data['alternate_greetings']).toEqual(['You remembered.']);
  });
});

function pngWithTextChunk(keyword: string, text: string): Uint8Array {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const chunkData = new TextEncoder().encode(`${keyword}\0${text}`);
  const chunk = [
    ...uint32(chunkData.length),
    ...new TextEncoder().encode('tEXt'),
    ...chunkData,
    0,
    0,
    0,
    0,
  ];
  return new Uint8Array([...signature, ...chunk]);
}

function uint32(value: number): readonly number[] {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

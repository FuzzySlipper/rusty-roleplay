import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { RpCharacter } from '../character.model';
import { RpCharacterManagerComponent } from './character-manager';

const CHARACTERS: readonly RpCharacter[] = [
  character({ id: 'b', name: 'Bravo', tags: ['rival'] }),
  character({ id: 'a', name: 'Alpha', tags: ['hero'] }),
];

describe('RpCharacterManagerComponent', () => {
  it('renders sorted characters and marks the active one', () => {
    const fixture = TestBed.createComponent(RpCharacterManagerComponent);
    fixture.componentRef.setInput('characters', CHARACTERS);
    fixture.componentRef.setInput('activeId', 'a');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text.indexOf('Alpha')).toBeLessThan(text.indexOf('Bravo'));
    expect(
      fixture.nativeElement.querySelector('li.active')?.textContent,
    ).toContain('Alpha');
  });

  it('filters characters by tag', () => {
    const fixture = TestBed.createComponent(RpCharacterManagerComponent);
    fixture.componentRef.setInput('characters', CHARACTERS);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector(
      'input[type="search"]',
    ) as HTMLInputElement;
    input.value = 'rival';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Bravo');
    expect(text).not.toContain('Alpha');
  });

  it('emits create requests from the editor', () => {
    const fixture = TestBed.createComponent(RpCharacterManagerComponent);
    fixture.componentRef.setInput('characters', []);
    const emitted: unknown[] = [];
    fixture.componentInstance.characterCreate.subscribe((event) =>
      emitted.push(event),
    );
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector('header button')
      .dispatchEvent(new Event('click'));
    fixture.detectChanges();
    const name = fixture.nativeElement.querySelector(
      'input[name="name"]',
    ) as HTMLInputElement;
    name.value = 'New Hero';
    name.dispatchEvent(new Event('input'));
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit'));

    expect(emitted).toMatchObject([{ name: 'New Hero' }]);
  });
});

function character(input: {
  id: string;
  name: string;
  tags: readonly string[];
}): RpCharacter {
  return {
    id: input.id,
    name: input.name,
    description: `${input.name} description`,
    personality: '',
    scenario: '',
    firstMessage: '',
    alternateGreetings: [],
    exampleMessages: [],
    tags: input.tags,
    avatarUrl: undefined,
    status: 'active',
    createdAt: undefined,
    updatedAt: undefined,
  };
}

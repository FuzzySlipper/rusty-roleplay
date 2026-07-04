import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import {
  RpCharacterMenuComponent,
  type RpCharacter,
} from './rp-character-menu';

const CHARACTERS: readonly RpCharacter[] = [
  character('xavier', 'Xavier', 'Duelist'),
  character('caleb', 'Caleb', 'Rival'),
];

describe('RpCharacterMenuComponent', () => {
  it('renders the characters and marks the active one', () => {
    const fixture = TestBed.createComponent(RpCharacterMenuComponent);
    fixture.componentRef.setInput('characters', CHARACTERS);
    fixture.componentRef.setInput('activeId', 'caleb');
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    const active = fixture.nativeElement.querySelector('button.active');
    expect(active?.textContent).toContain('Caleb');
  });

  it('emits the id when a character is activated', () => {
    const fixture = TestBed.createComponent(RpCharacterMenuComponent);
    fixture.componentRef.setInput('characters', CHARACTERS);
    fixture.detectChanges();
    let emitted: string | undefined;
    fixture.componentInstance.activate.subscribe((id) => (emitted = id));
    fixture.nativeElement.querySelector('button').click();
    expect(emitted).toBe('xavier');
  });
});

function character(id: string, name: string, tagline: string): RpCharacter {
  return {
    id,
    name,
    tagline,
    description: tagline,
    personality: '',
    scenario: '',
    firstMessage: '',
    alternateGreetings: [],
    exampleMessages: [],
    tags: [],
    avatarUrl: undefined,
    status: 'active',
    createdAt: undefined,
    updatedAt: undefined,
  };
}

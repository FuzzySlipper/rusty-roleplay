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

    buttonWithText(fixture.nativeElement, 'Scene').click();
    fixture.detectChanges();
    buttonWithText(fixture.nativeElement, 'Add greeting').click();
    fixture.detectChanges();
    const greeting = fixture.nativeElement.querySelector(
      'rp-string-list-editor textarea',
    ) as HTMLTextAreaElement;
    greeting.value = 'Welcome to the ruins.';
    greeting.dispatchEvent(new Event('input'));

    buttonWithText(fixture.nativeElement, 'Examples').click();
    fixture.detectChanges();
    buttonWithText(fixture.nativeElement, 'Add example').click();
    fixture.detectChanges();
    const example = fixture.nativeElement.querySelector(
      'rp-string-list-editor textarea',
    ) as HTMLTextAreaElement;
    example.value = '{{char}}: Stay close.';
    example.dispatchEvent(new Event('input'));

    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit'));

    expect(emitted).toMatchObject([
      {
        name: 'New Hero',
        alternateGreetings: ['Welcome to the ruins.'],
        exampleMessages: ['{{char}}: Stay close.'],
      },
    ]);
  });

  it('imports JSON character cards into the editor before saving', async () => {
    const fixture = TestBed.createComponent(RpCharacterManagerComponent);
    fixture.componentRef.setInput('characters', []);
    const emitted: unknown[] = [];
    fixture.componentInstance.characterCreate.subscribe((event) =>
      emitted.push(event),
    );
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector(
      'header input[type="file"]',
    ) as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [
        new File(
          [
            JSON.stringify({
              data: {
                name: 'Imported Hero',
                first_mes: 'A velvet-gloved hand reaches out.',
                tags: ['imported'],
              },
            }),
          ],
          'hero.json',
          { type: 'application/json' },
        ),
      ],
    });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(
      (fixture.nativeElement.querySelector('input[name="name"]') as HTMLInputElement)
        .value,
    ).toBe('Imported Hero');
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit'));

    expect(emitted).toMatchObject([
      {
        name: 'Imported Hero',
        firstMessage: 'A velvet-gloved hand reaches out.',
        tags: ['imported'],
      },
    ]);
  });

  it('renders first message preview and validation hints', () => {
    const fixture = TestBed.createComponent(RpCharacterManagerComponent);
    fixture.componentRef.setInput('characters', []);
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector('header button')
      .dispatchEvent(new Event('click'));
    fixture.detectChanges();
    buttonWithText(fixture.nativeElement, 'Scene').click();
    fixture.detectChanges();

    const textareas = fixture.nativeElement.querySelectorAll('textarea');
    const firstMessage = textareas[1] as HTMLTextAreaElement;
    firstMessage.value = 'The door opens with a silver sigh.';
    firstMessage.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('First message: 34/800 chars');
    expect(
      fixture.nativeElement.querySelector('.message-preview')?.textContent,
    ).toContain('The door opens with a silver sigh.');
  });

  it('shows a save confirmation after submitting', () => {
    const fixture = TestBed.createComponent(RpCharacterManagerComponent);
    fixture.componentRef.setInput('characters', []);
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector('header button')
      .dispatchEvent(new Event('click'));
    fixture.detectChanges();
    const name = fixture.nativeElement.querySelector(
      'input[name="name"]',
    ) as HTMLInputElement;
    name.value = 'Saved Hero';
    name.dispatchEvent(new Event('input'));
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Character saved.');
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
    firstMessage: 'Hello.',
    alternateGreetings: [],
    exampleMessages: [],
    tags: input.tags,
    avatarUrl: undefined,
    status: 'active',
    createdAt: undefined,
    updatedAt: undefined,
  };
}

function buttonWithText(element: HTMLElement, text: string): HTMLButtonElement {
  const button = [...element.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (button === undefined) {
    throw new Error(`Button ${text} was not found.`);
  }
  return button as HTMLButtonElement;
}

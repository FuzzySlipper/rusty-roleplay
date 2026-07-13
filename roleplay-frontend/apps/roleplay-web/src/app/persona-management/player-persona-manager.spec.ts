import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import type { PlayerPersona } from './player-persona.model';
import { PlayerPersonaManagerComponent } from './player-persona-manager';

const PERSONAS: readonly PlayerPersona[] = [
  {
    id: 'persona-a',
    profileId: 'profile-a',
    name: 'Jorge',
    avatarUrl: undefined,
    avatarAssetRef: undefined,
    description: 'A test persona',
    notes: '',
    tags: ['mage'],
    status: 'active',
    createdAt: undefined,
    updatedAt: undefined,
  },
];

describe('PlayerPersonaManagerComponent', () => {
  it('renders and activates personas', () => {
    const fixture = createFixture();
    const emitted: string[] = [];
    fixture.componentInstance.personaActivate.subscribe((event) =>
      emitted.push(event),
    );

    fixture.nativeElement.querySelector('.summary').click();

    expect(fixture.nativeElement.textContent).toContain('Jorge');
    expect(fixture.nativeElement.textContent).toContain('mage');
    expect(emitted).toEqual(['persona-a']);
  });

  it('emits avatar data URLs from uploaded files', async () => {
    const originalFileReader = globalThis.FileReader;
    class MockFileReader extends EventTarget {
      result: string | ArrayBuffer | null = null;
      readAsDataURL(): void {
        this.result = 'data:image/png;base64,avatar';
        this.dispatchEvent(new Event('load'));
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);
    const fixture = createFixture();
    const emitted: unknown[] = [];
    fixture.componentInstance.personaCreate.subscribe((event) =>
      emitted.push(event),
    );

    fixture.nativeElement.querySelector('header button').click();
    fixture.detectChanges();
    setInput(fixture.nativeElement.querySelector('input[name="name"]'), 'Jorge');
    const fileInput = fixture.nativeElement.querySelector(
      'input[name="avatarFile"]',
    ) as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['avatar'], 'avatar.png', { type: 'image/png' })],
    });
    fileInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));

    expect(emitted).toEqual([
      {
        name: 'Jorge',
        avatarUrl: 'data:image/png;base64,avatar',
        description: '',
        notes: '',
        tags: [],
      },
    ]);
    vi.stubGlobal('FileReader', originalFileReader);
  });
});

function createFixture() {
  const fixture = TestBed.createComponent(PlayerPersonaManagerComponent);
  fixture.componentRef.setInput('personas', PERSONAS);
  fixture.componentRef.setInput('activeId', 'persona-a');
  fixture.detectChanges();
  return fixture;
}

function setInput(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

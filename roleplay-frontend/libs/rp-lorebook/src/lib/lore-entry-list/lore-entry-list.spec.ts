import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { LoreEntryListComponent } from './lore-entry-list';
import type { LoreLayer } from '../lore-layer.model';
import { testEntries } from '../test-lore-entries';

describe('LoreEntryListComponent', () => {
  it('renders entries and canon filter chips', () => {
    const fixture = TestBed.createComponent(LoreEntryListComponent);
    fixture.componentRef.setInput('entries', testEntries);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.entry').length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('established 1');
    expect(fixture.nativeElement.textContent).toContain('speculative 1');
  });

  it('emits search query changes', () => {
    const fixture = TestBed.createComponent(LoreEntryListComponent);
    fixture.componentRef.setInput('entries', testEntries);
    fixture.detectChanges();
    let query = '';
    fixture.componentInstance.queryChange.subscribe((value) => {
      query = value;
    });

    const input = fixture.nativeElement.querySelector(
      'input',
    ) as HTMLInputElement;
    input.value = 'silver';
    input.dispatchEvent(new Event('input'));

    expect(query).toBe('silver');
  });

  it('shows promote only for auto-captured entries and emits request', () => {
    const fixture = TestBed.createComponent(LoreEntryListComponent);
    fixture.componentRef.setInput('entries', [
      {
        ...testEntries[0],
        sourceLayerId: 'story-events',
        sourceLayerWritePolicy: 'auto_capture',
        layerIds: ['story-events'],
      },
      {
        ...testEntries[1],
        sourceLayerId: 'world-main',
        sourceLayerWritePolicy: 'manual',
        layerIds: ['world-main'],
      },
    ]);
    fixture.componentRef.setInput('promoteTargetLayers', LAYERS);
    const emitted: unknown[] = [];
    fixture.componentInstance.promoteEntry.subscribe((request) =>
      emitted.push(request),
    );
    fixture.detectChanges();

    expect(buttonsWithText(fixture.nativeElement, 'Promote').length).toBe(1);
    buttonsWithText(fixture.nativeElement, 'Promote')[0]?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('World');

    buttonWithText(fixture.nativeElement, 'World').click();
    fixture.detectChanges();
    buttonWithText(fixture.nativeElement, 'Confirm').click();

    expect(emitted).toEqual([
      {
        entryId: 'a',
        sourceLayerId: 'story-events',
        targetLayerId: 'world-main',
      },
    ]);
  });
});

const LAYERS: readonly LoreLayer[] = [
  {
    layerId: 'story-events',
    profileId: 'profile',
    name: 'Story events',
    description: '',
    purpose: 'story',
    writePolicy: 'auto_capture',
    archived: false,
    entryCount: 1,
    createdAt: undefined,
    updatedAt: undefined,
  },
  {
    layerId: 'world-main',
    profileId: 'profile',
    name: 'World',
    description: '',
    purpose: 'world',
    writePolicy: 'manual',
    archived: false,
    entryCount: 0,
    createdAt: undefined,
    updatedAt: undefined,
  },
];

function buttonWithText(element: HTMLElement, text: string): HTMLButtonElement {
  const button = buttonsWithText(element, text)[0];
  if (button === undefined) {
    throw new Error(`Button ${text} was not found.`);
  }
  return button;
}

function buttonsWithText(
  element: HTMLElement,
  text: string,
): HTMLButtonElement[] {
  return [...element.querySelectorAll('button')].filter((button) =>
    button.textContent?.includes(text),
  ) as HTMLButtonElement[];
}

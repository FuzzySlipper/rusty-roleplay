import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { LorePromotePopoverComponent } from './lore-promote-popover';
import type { LoreLayer } from '../lore-layer.model';

describe('LorePromotePopoverComponent', () => {
  it('filters writable targets and emits the selected promotion', () => {
    const fixture = TestBed.createComponent(LorePromotePopoverComponent);
    fixture.componentRef.setInput('entryId', 'entry-a');
    fixture.componentRef.setInput('sourceLayerId', 'story-events');
    fixture.componentRef.setInput('layers', LAYERS);
    const emitted: unknown[] = [];
    fixture.componentInstance.promote.subscribe((request) =>
      emitted.push(request),
    );
    fixture.detectChanges();

    buttonWithText(fixture.nativeElement, 'Promote').click();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('World');
    expect(text).not.toContain('Readonly');
    expect(text).not.toContain('Story events');

    buttonWithText(fixture.nativeElement, 'World').click();
    fixture.detectChanges();
    buttonWithText(fixture.nativeElement, 'Confirm').click();

    expect(emitted).toEqual([
      {
        entryId: 'entry-a',
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
  {
    layerId: 'readonly',
    profileId: 'profile',
    name: 'Readonly',
    description: '',
    purpose: 'world',
    writePolicy: 'readonly',
    archived: false,
    entryCount: 0,
    createdAt: undefined,
    updatedAt: undefined,
  },
];

function buttonWithText(element: HTMLElement, text: string): HTMLButtonElement {
  const button = [...element.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (button === undefined) {
    throw new Error(`Button ${text} was not found.`);
  }
  return button as HTMLButtonElement;
}

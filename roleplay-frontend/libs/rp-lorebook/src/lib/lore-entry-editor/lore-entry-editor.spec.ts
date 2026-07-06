import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { LoreEntryEditorComponent } from './lore-entry-editor';
import { testEntries } from '../test-lore-entries';

describe('LoreEntryEditorComponent', () => {
  it('emits edited entry fields', () => {
    const fixture = TestBed.createComponent(LoreEntryEditorComponent);
    fixture.componentRef.setInput('entry', testEntries[0]);
    fixture.detectChanges();
    let title = '';
    fixture.componentInstance.entrySave.subscribe((request) => {
      title = request.title;
    });

    const input = fixture.nativeElement.querySelector(
      'input[name="title"]',
    ) as HTMLInputElement;
    input.value = 'Updated Taxes';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new SubmitEvent('submit'));

    expect(title).toBe('Updated Taxes');
  });
});

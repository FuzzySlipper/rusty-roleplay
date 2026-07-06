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

  it('emits advanced lore trigger controls', () => {
    const fixture = TestBed.createComponent(LoreEntryEditorComponent);
    fixture.componentRef.setInput('entry', testEntries[0]);
    fixture.detectChanges();
    let primaryKeys: readonly string[] = [];
    let constant = false;
    let insertionOrder = 0;
    fixture.componentInstance.entrySave.subscribe((request) => {
      primaryKeys = request.loreControls.primaryKeys;
      constant = request.loreControls.constant;
      insertionOrder = request.loreControls.insertionOrder;
    });

    const keysInput = fixture.nativeElement.querySelector(
      'input[name="primaryKeys"]',
    ) as HTMLInputElement;
    keysInput.value = 'clockmaker, dusk';
    keysInput.dispatchEvent(new Event('input', { bubbles: true }));

    const constantInput = fixture.nativeElement.querySelector(
      'input[name="constant"]',
    ) as HTMLInputElement;
    constantInput.checked = false;
    constantInput.dispatchEvent(new Event('change', { bubbles: true }));

    const orderInput = fixture.nativeElement.querySelector(
      'input[name="insertionOrder"]',
    ) as HTMLInputElement;
    orderInput.value = '5';
    orderInput.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new SubmitEvent('submit'));

    expect(primaryKeys).toEqual(['clockmaker', 'dusk']);
    expect(constant).toBe(false);
    expect(insertionOrder).toBe(5);
  });
});

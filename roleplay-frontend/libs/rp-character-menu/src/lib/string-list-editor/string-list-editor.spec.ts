import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { StringListEditorComponent } from './string-list-editor';

describe('StringListEditorComponent', () => {
  it('adds and edits an item inline', () => {
    const fixture = TestBed.createComponent(StringListEditorComponent);
    fixture.componentRef.setInput('items', []);
    fixture.componentRef.setInput('placeholder', 'Write one');
    const emitted: readonly string[][] = [];
    fixture.componentInstance.itemsChange.subscribe((items) =>
      emitted.push([...items]),
    );
    fixture.detectChanges();

    buttonWithText(fixture.nativeElement, 'Add').click();
    fixture.detectChanges();
    expect(last(emitted)).toEqual(['']);

    fixture.componentRef.setInput('items', last(emitted) ?? []);
    fixture.detectChanges();
    const textarea = fixture.nativeElement.querySelector(
      'textarea',
    ) as HTMLTextAreaElement;
    textarea.value = 'A new greeting';
    textarea.dispatchEvent(new Event('input'));

    expect(emitted.at(-1)).toEqual(['A new greeting']);
  });

  it('reorders and deletes items', () => {
    const fixture = TestBed.createComponent(StringListEditorComponent);
    fixture.componentRef.setInput('items', ['First', 'Second']);
    const emitted: readonly string[][] = [];
    fixture.componentInstance.itemsChange.subscribe((items) =>
      emitted.push([...items]),
    );
    fixture.detectChanges();

    buttonWithText(fixture.nativeElement, 'Down').click();
    expect(last(emitted)).toEqual(['Second', 'First']);

    fixture.componentRef.setInput('items', last(emitted) ?? []);
    fixture.detectChanges();
    buttonWithText(fixture.nativeElement, 'Delete').click();
    expect(last(emitted)).toEqual(['First']);
  });
});

function last<T>(items: readonly T[]): T | undefined {
  return items[items.length - 1];
}

function buttonWithText(element: HTMLElement, text: string): HTMLButtonElement {
  const button = [...element.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (button === undefined) {
    throw new Error(`Button ${text} was not found.`);
  }
  return button as HTMLButtonElement;
}

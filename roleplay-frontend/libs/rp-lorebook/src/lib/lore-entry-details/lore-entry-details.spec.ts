import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { LoreEntryDetailsComponent } from './lore-entry-details';
import { testEntries } from '../test-lore-entries';

describe('LoreEntryDetailsComponent', () => {
  it('renders body, tags, and provenance', () => {
    const fixture = TestBed.createComponent(LoreEntryDetailsComponent);
    fixture.componentRef.setInput('entry', testEntries[0]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Northmarch Taxes');
    expect(fixture.nativeElement.textContent).toContain('politics');
    expect(fixture.nativeElement.textContent).toContain('fixture');
  });
});

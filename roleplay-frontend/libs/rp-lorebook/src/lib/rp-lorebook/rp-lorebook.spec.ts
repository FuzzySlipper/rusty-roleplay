import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { RpLorebookPanelComponent } from './rp-lorebook';
import type { LoreEntry } from '../lore.model';

const ENTRIES: readonly LoreEntry[] = [
  {
    slug: 'a',
    title: 'Northmarch Taxes',
    summary: 'politics',
    canonLevel: 'canon',
    tags: ['politics'],
  },
  {
    slug: 'b',
    title: 'Silver Flame',
    summary: 'an order',
    canonLevel: 'canon',
    tags: ['faction'],
  },
];

describe('RpLorebookPanelComponent', () => {
  it('lists all entries by default', () => {
    const fixture = TestBed.createComponent(RpLorebookPanelComponent);
    fixture.componentRef.setInput('entries', ENTRIES);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.entry').length).toBe(2);
  });

  it('filters entries by the search query', () => {
    const fixture = TestBed.createComponent(RpLorebookPanelComponent);
    fixture.componentRef.setInput('entries', ENTRIES);
    fixture.detectChanges();
    const search = fixture.nativeElement.querySelector(
      'input',
    ) as HTMLInputElement;
    search.value = 'silver';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const entries = fixture.nativeElement.querySelectorAll('.entry');
    expect(entries.length).toBe(1);
    expect(entries[0].textContent).toContain('Silver Flame');
  });
});

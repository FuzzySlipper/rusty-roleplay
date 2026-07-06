import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { RpLorebookPanelComponent } from './rp-lorebook';
import type { LoreEntry } from '../lore.model';

const ENTRIES: readonly LoreEntry[] = [
  {
    recordId: 'a',
    revision: 1,
    layerIds: [],
    sourceLayerId: undefined,
    sourceLayerWritePolicy: undefined,
    slug: 'a',
    title: 'Northmarch Taxes',
    summary: 'politics',
    body: 'politics',
    canonLevel: 'established',
    tags: ['politics'],
    capturedBy: 'test',
    captureReason: 'fixture',
    capturedAt: '2026-07-05T00:00:00.000Z',
    supersedesRecordId: '',
    supersededByRecordId: '',
  },
  {
    recordId: 'b',
    revision: 1,
    layerIds: [],
    sourceLayerId: undefined,
    sourceLayerWritePolicy: undefined,
    slug: 'b',
    title: 'Silver Flame',
    summary: 'an order',
    body: 'an order',
    canonLevel: 'established',
    tags: ['faction'],
    capturedBy: 'test',
    captureReason: 'fixture',
    capturedAt: '2026-07-05T00:00:00.000Z',
    supersedesRecordId: '',
    supersededByRecordId: '',
  },
];

describe('RpLorebookPanelComponent', () => {
  it('lists all entries by default', () => {
    const fixture = TestBed.createComponent(RpLorebookPanelComponent);
    fixture.componentRef.setInput('entries', ENTRIES);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.entry').length).toBe(2);
  });

  it('emits search query changes', () => {
    const fixture = TestBed.createComponent(RpLorebookPanelComponent);
    fixture.componentRef.setInput('entries', ENTRIES);
    fixture.detectChanges();
    let query = '';
    fixture.componentInstance.queryChange.subscribe((value) => {
      query = value;
    });
    const search = fixture.nativeElement.querySelector(
      'input',
    ) as HTMLInputElement;
    search.value = 'silver';
    search.dispatchEvent(new Event('input'));
    expect(query).toBe('silver');
  });
});

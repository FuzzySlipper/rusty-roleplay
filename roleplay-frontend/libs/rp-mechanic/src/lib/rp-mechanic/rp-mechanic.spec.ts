import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { RpMechanicPanelComponent, type MechanicProposal } from './rp-mechanic';

const PROPOSALS: readonly MechanicProposal[] = [
  { id: 'p1', summary: 'Boost politics tag', reason: 'under-retrieved' },
];

describe('RpMechanicPanelComponent', () => {
  it('hides proposals in roleplay mode and shows them in mechanic mode', () => {
    const fixture = TestBed.createComponent(RpMechanicPanelComponent);
    fixture.componentRef.setInput('mode', 'roleplay');
    fixture.componentRef.setInput('proposals', PROPOSALS);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.proposal')).toBeNull();

    fixture.componentRef.setInput('mode', 'mechanic');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.proposal')).not.toBeNull();
  });

  it('toggles mode through the output', () => {
    const fixture = TestBed.createComponent(RpMechanicPanelComponent);
    fixture.componentRef.setInput('mode', 'roleplay');
    fixture.detectChanges();
    let next: string | undefined;
    fixture.componentInstance.modeChange.subscribe((m) => (next = m));
    fixture.nativeElement.querySelector('header button').click();
    expect(next).toBe('mechanic');
  });
});

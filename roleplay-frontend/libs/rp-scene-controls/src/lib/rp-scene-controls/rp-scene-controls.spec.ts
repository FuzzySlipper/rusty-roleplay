import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { RpSceneControlsComponent } from './rp-scene-controls';

describe('RpSceneControlsComponent', () => {
  it('shows the narrator phase label', () => {
    const fixture = TestBed.createComponent(RpSceneControlsComponent);
    fixture.componentRef.setInput('phase', 'exploring');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.phase').textContent).toContain(
      'Exploring',
    );
  });

  it('emits the chosen mood', () => {
    const fixture = TestBed.createComponent(RpSceneControlsComponent);
    fixture.detectChanges();
    let emitted: string | undefined;
    fixture.componentInstance.moodChange.subscribe((m) => (emitted = m));
    const select = fixture.nativeElement.querySelector(
      'select',
    ) as HTMLSelectElement;
    select.value = 'ominous';
    select.dispatchEvent(new Event('change'));
    expect(emitted).toBe('ominous');
  });
});

import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { RpProfileSelectorComponent } from './rp-profile';

const PROFILES = [
  { id: 'sister-a', name: 'Sister A', hasPassword: false },
] as const;

describe('RpProfileSelectorComponent', () => {
  it('reveals a stable accessible profile control', () => {
    const fixture = TestBed.createComponent(RpProfileSelectorComponent);
    fixture.componentRef.setInput('profiles', PROFILES);
    fixture.detectChanges();

    const profileButton = fixture.nativeElement.querySelector('button');
    expect(profileButton?.textContent).toContain('Sister A');

    profileButton?.click();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('form button')?.textContent,
    ).toContain('Enter as Sister A');
  });
});

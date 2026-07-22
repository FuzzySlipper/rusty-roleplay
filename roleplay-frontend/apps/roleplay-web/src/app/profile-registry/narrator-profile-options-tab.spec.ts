import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { RoleplayWorkbench } from '../roleplay-workbench';
import { NarratorProfileOptionsTabComponent } from './narrator-profile-options-tab';

describe('NarratorProfileOptionsTabComponent', () => {
  it('identifies narrator profiles as runtime configuration and switches on selection', async () => {
    const switchNarratorProfile = vi.fn();
    await TestBed.configureTestingModule({
      imports: [NarratorProfileOptionsTabComponent],
      providers: [
        {
          provide: RoleplayWorkbench,
          useValue: {
            activeProfile: signal({
              id: 'narrator-a',
              name: 'Narrator A',
              hasPassword: false,
            }),
            narratorProfiles: signal([
              {
                id: 'narrator-a',
                name: 'Narrator A',
                hasPassword: false,
                roleplayNarratorCapable: true,
              },
              {
                id: 'narrator-b',
                name: 'Narrator B',
                hasPassword: false,
                roleplayNarratorCapable: true,
              },
            ]),
            profilesLoading: signal(false),
            profileSwitching: signal(false),
            selectError: signal(undefined),
            switchNarratorProfile,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(NarratorProfileOptionsTabComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const select = host.querySelector('select');

    expect(host.textContent).toContain(
      'not a user account or character persona',
    );
    expect(select?.disabled).toBe(false);
    expect(select?.querySelectorAll('option')).toHaveLength(2);

    if (select === null) throw new Error('Expected narrator profile select.');
    select.value = 'narrator-b';
    select.dispatchEvent(new Event('change'));

    expect(switchNarratorProfile).toHaveBeenCalledWith('narrator-b');
  });

  it('keeps a single active narrator visible without offering a false switch', async () => {
    await TestBed.configureTestingModule({
      imports: [NarratorProfileOptionsTabComponent],
      providers: [
        {
          provide: RoleplayWorkbench,
          useValue: {
            activeProfile: signal({
              id: 'narrator-a',
              name: 'Narrator A',
              hasPassword: false,
            }),
            narratorProfiles: signal([
              {
                id: 'narrator-a',
                name: 'Narrator A',
                hasPassword: false,
                roleplayNarratorCapable: true,
              },
            ]),
            profilesLoading: signal(false),
            profileSwitching: signal(false),
            selectError: signal(undefined),
            switchNarratorProfile: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(NarratorProfileOptionsTabComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('select')?.disabled).toBe(true);
    expect(host.textContent).toContain(
      'No other Roleplay narrator profiles are currently available.',
    );
  });
});

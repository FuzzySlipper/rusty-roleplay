import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ProfileStore } from './profile-store';

describe('ProfileStore', () => {
  function store(): ProfileStore {
    return TestBed.configureTestingModule({}).inject(ProfileStore);
  }

  it('starts unauthenticated with seed profiles', () => {
    const s = store();
    expect(s.isAuthenticated()).toBe(false);
    expect(s.profiles().length).toBeGreaterThanOrEqual(2);
  });

  it('selects a password-free profile', () => {
    const s = store();
    expect(s.select('sister-a')).toEqual({ ok: true });
    expect(s.activeProfile()?.id).toBe('sister-a');
  });

  it('rejects a wrong password and accepts the right one', () => {
    const s = store();
    expect(s.select('sister-b', 'nope')).toEqual({
      ok: false,
      reason: 'wrong_password',
    });
    expect(s.isAuthenticated()).toBe(false);
    expect(s.select('sister-b', 'rose')).toEqual({ ok: true });
    expect(s.activeProfile()?.id).toBe('sister-b');
  });

  it('reports unknown profiles', () => {
    expect(store().select('ghost')).toEqual({
      ok: false,
      reason: 'unknown_profile',
    });
  });

  it('signs out back to the selector', () => {
    const s = store();
    s.select('sister-a');
    s.signOut();
    expect(s.isAuthenticated()).toBe(false);
  });
});

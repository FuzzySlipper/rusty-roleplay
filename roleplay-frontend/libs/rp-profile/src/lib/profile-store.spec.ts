import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ProfileStore } from './profile-store';

describe('ProfileStore', () => {
  function store(): ProfileStore {
    return TestBed.configureTestingModule({}).inject(ProfileStore);
  }

  it('starts unauthenticated without placeholder profiles', () => {
    const s = store();
    expect(s.isAuthenticated()).toBe(false);
    expect(s.profiles()).toEqual([]);
  });

  it('selects a password-free profile', () => {
    const s = store();
    const profile = s.addProfile('Sister A');
    expect(s.select(profile.id)).toEqual({ ok: true });
    expect(s.activeProfile()?.id).toBe(profile.id);
  });

  it('rejects a wrong password and accepts the right one', () => {
    const s = store();
    const profile = s.addProfile('Sister B', 'rose');
    expect(s.select(profile.id, 'nope')).toEqual({
      ok: false,
      reason: 'wrong_password',
    });
    expect(s.isAuthenticated()).toBe(false);
    expect(s.select(profile.id, 'rose')).toEqual({ ok: true });
    expect(s.activeProfile()?.id).toBe(profile.id);
  });

  it('reports unknown profiles', () => {
    expect(store().select('ghost')).toEqual({
      ok: false,
      reason: 'unknown_profile',
    });
  });

  it('replaces local profiles from a backend registry', () => {
    const s = store();
    s.addProfile('Sister A');
    s.setProfiles([
      { id: 'rp-narrator', name: 'RP Narrator', hasPassword: false },
    ]);

    expect(s.select('sister-a')).toEqual({
      ok: false,
      reason: 'unknown_profile',
    });
    expect(s.select('rp-narrator')).toEqual({ ok: true });
    expect(s.activeProfile()?.name).toBe('RP Narrator');
  });

  it('signs out back to the selector', () => {
    const s = store();
    const profile = s.addProfile('Sister A');
    s.select(profile.id);
    s.signOut();
    expect(s.isAuthenticated()).toBe(false);
  });
});

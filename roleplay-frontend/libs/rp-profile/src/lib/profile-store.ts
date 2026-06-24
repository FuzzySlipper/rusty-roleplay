import { computed, Injectable, signal } from '@angular/core';

import { Profile, ProfileSelectResult } from './profile.model';

/** Seed profiles for development. In a later task these load from disk/config. */
const SEED_PROFILES: readonly Profile[] = [
  { id: 'sister-a', name: 'Sister A', hasPassword: false },
  { id: 'sister-b', name: 'Sister B', hasPassword: true },
];

const SEED_PASSWORDS: Readonly<Record<string, string>> = {
  'sister-b': 'rose',
};

/**
 * Signals store for profile selection. Holds the profile list and the active
 * profile; enforces optional plain-text passwords. Profile-scoped — no state is
 * shared between profiles. This is the one container-level service the profile
 * shell injects; presentational components receive data via inputs.
 */
@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly profilesSig = signal<readonly Profile[]>(SEED_PROFILES);
  private readonly passwords = new Map<string, string>(
    Object.entries(SEED_PASSWORDS),
  );
  private readonly activeIdSig = signal<string | null>(null);

  readonly profiles = this.profilesSig.asReadonly();
  readonly activeProfile = computed<Profile | null>(() => {
    const id = this.activeIdSig();
    return this.profilesSig().find((p) => p.id === id) ?? null;
  });
  readonly isAuthenticated = computed<boolean>(
    () => this.activeProfile() !== null,
  );

  /** Selects a profile, checking the password when the profile requires one. */
  select(profileId: string, password?: string): ProfileSelectResult {
    const profile = this.profilesSig().find((p) => p.id === profileId);
    if (!profile) {
      return { ok: false, reason: 'unknown_profile' };
    }
    if (profile.hasPassword && this.passwords.get(profileId) !== password) {
      return { ok: false, reason: 'wrong_password' };
    }
    this.activeIdSig.set(profileId);
    return { ok: true };
  }

  /** Clears the active profile, returning to the selector. */
  signOut(): void {
    this.activeIdSig.set(null);
  }

  /** Adds a new profile, optionally with a plain-text password. */
  addProfile(name: string, password?: string): Profile {
    const id = slugify(name);
    const profile: Profile = { id, name, hasPassword: Boolean(password) };
    this.profilesSig.update((list) => [
      ...list.filter((p) => p.id !== id),
      profile,
    ]);
    if (password) {
      this.passwords.set(id, password);
    }
    return profile;
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

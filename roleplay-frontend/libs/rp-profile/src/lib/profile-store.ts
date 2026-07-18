import { computed, Injectable, signal } from '@angular/core';

import { Profile, ProfileSelectResult } from './profile.model';

/** Signals store for Crew runtime profiles and the active narrator profile. */
@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly profilesSig = signal<readonly Profile[]>([]);
  private readonly passwords = new Map<string, string>();
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

  /** Replaces the selectable profiles from a backend-owned registry. */
  setProfiles(profiles: readonly Profile[]): void {
    this.profilesSig.set(profiles);
    const activeId = this.activeIdSig();
    if (
      activeId !== null &&
      profiles.every((profile) => profile.id !== activeId)
    ) {
      this.activeIdSig.set(null);
    }
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

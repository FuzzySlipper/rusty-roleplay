/**
 * A user profile — an independent silo for sessions, campaigns, and state.
 * Profiles are frontend-managed (no backend auth middleware) per
 * docs/03-mechanic-ooc-agent.md. Passwords, when present, are plain text and
 * exist only to keep profiles visually separate on a trusted LAN — they are
 * not a security boundary.
 */
export interface Profile {
  readonly id: string;
  readonly name: string;
  readonly hasPassword: boolean;
}

/** Result of attempting to select (and optionally authenticate) a profile. */
export type ProfileSelectResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: 'wrong_password' | 'unknown_profile';
    };

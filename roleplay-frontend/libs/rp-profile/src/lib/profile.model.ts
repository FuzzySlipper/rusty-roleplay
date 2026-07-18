/**
 * A Rusty Crew runtime profile used to scope agent configuration and state.
 * It is not a Roleplay user identity or authentication boundary.
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

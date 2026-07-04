/** Structured RP character stored by rusty-crew for a profile. */
export interface RpCharacter {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly personality: string;
  readonly scenario: string;
  readonly firstMessage: string;
  readonly alternateGreetings: readonly string[];
  readonly exampleMessages: readonly string[];
  readonly tags: readonly string[];
  readonly avatarUrl: string | undefined;
  readonly status: 'active' | 'archived';
  readonly createdAt: string | undefined;
  readonly updatedAt: string | undefined;
  /** Compatibility with the older presentational menu. */
  readonly tagline?: string;
}

export interface CharacterWriteRequest {
  readonly id?: string;
  readonly name: string;
  readonly description: string;
  readonly personality: string;
  readonly scenario: string;
  readonly firstMessage: string;
  readonly alternateGreetings: readonly string[];
  readonly exampleMessages: readonly string[];
  readonly tags: readonly string[];
  readonly avatarUrl?: string;
}

export interface CharacterUpdateRequest {
  readonly id: string;
  readonly patch: CharacterWriteRequest;
}

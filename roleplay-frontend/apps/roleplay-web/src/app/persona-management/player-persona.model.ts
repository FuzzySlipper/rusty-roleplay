export type PlayerPersonaStatus = 'active' | 'archived';

export interface PlayerPersona {
  readonly id: string;
  readonly profileId: string;
  readonly name: string;
  readonly avatarUrl: string | undefined;
  readonly avatarAssetRef: string | undefined;
  readonly description: string;
  readonly notes: string;
  readonly tags: readonly string[];
  readonly status: PlayerPersonaStatus;
  readonly createdAt: string | undefined;
  readonly updatedAt: string | undefined;
}

export interface PlayerPersonaWriteRequest {
  readonly id?: string | undefined;
  readonly name: string;
  readonly avatarUrl?: string | undefined;
  readonly avatarAssetRef?: string | undefined;
  readonly description: string;
  readonly notes: string;
  readonly tags: readonly string[];
}

export interface PlayerPersonaUpdateRequest {
  readonly id: string;
  readonly patch: PlayerPersonaWriteRequest;
}

export interface RoleplaySessionSummary {
  readonly sessionId: string;
  readonly profileId: string;
  readonly agentId: string | undefined;
  readonly status: string;
  readonly displayName: string | undefined;
  readonly characterId: string | undefined;
  readonly characterName: string | undefined;
  readonly playerPersonaId: string | undefined;
  readonly playerPersonaName: string | undefined;
  readonly playerPersonaAvatarUrl: string | undefined;
  readonly activeLayerIds: readonly string[];
  readonly activeLayerCount: number;
  readonly lastMessagePreview: string | undefined;
  readonly archived: boolean;
  readonly createdAt: string | undefined;
  readonly updatedAt: string | undefined;
}

export interface CreateRoleplaySessionRequest {
  readonly displayName: string;
  readonly characterId: string | undefined;
  readonly playerPersonaId: string | undefined;
  readonly activeLayerIds: readonly string[];
}

export interface UpdateRoleplaySessionRequest {
  readonly sessionId: string;
  readonly displayName?: string | undefined;
  readonly characterId?: string | undefined;
  readonly playerPersonaId?: string | undefined;
  readonly activeLayerIds?: readonly string[] | undefined;
}

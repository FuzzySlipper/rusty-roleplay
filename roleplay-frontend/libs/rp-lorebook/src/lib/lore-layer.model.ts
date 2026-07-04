export type LoreLayerPurpose =
  | 'world'
  | 'story'
  | 'characters'
  | 'factions'
  | 'mixed';

export type LoreLayerWritePolicy = 'manual' | 'auto_capture' | 'readonly';

export interface LoreLayer {
  readonly layerId: string;
  readonly profileId: string;
  readonly name: string;
  readonly description: string;
  readonly purpose: LoreLayerPurpose;
  readonly writePolicy: LoreLayerWritePolicy;
  readonly archived: boolean;
  readonly entryCount: number;
  readonly createdAt: string | undefined;
  readonly updatedAt: string | undefined;
}

export interface ChatLoreLayer extends LoreLayer {
  readonly enabled: boolean;
  readonly priority: number;
}

export interface CreateLoreLayerRequest {
  readonly name: string;
  readonly description: string;
  readonly purpose: LoreLayerPurpose;
  readonly writePolicy: LoreLayerWritePolicy;
}

export interface ToggleLoreLayerRequest {
  readonly layerId: string;
  readonly enabled: boolean;
}

export interface ReorderLoreLayerRequest {
  readonly layerId: string;
  readonly direction: 'up' | 'down';
}

/**
 * A lorekeep entry as the frontend displays it. This mirrors the subset of the
 * lorekeep entry contract (contracts/v0/schemas/entry.schema.json) the lorebook
 * UI needs. The full HTTP client wiring is a follow-on task; this panel renders
 * whatever the LoreSource provides.
 */
export type LoreInsertionPosition =
  | 'before_history'
  | 'after_history'
  | 'before_author_note'
  | 'after_author_note'
  | 'system'
  | 'lore_block';

export type LoreRetrievalRole = 'system' | 'user' | 'assistant' | 'narrator';

export interface LoreControlSupport {
  readonly primaryKeys: string;
  readonly secondaryKeys: string;
  readonly enabled: string;
  readonly constant: string;
  readonly scanDepth: string;
  readonly insertionPosition: string;
  readonly insertionOrder: string;
  readonly probability: string;
  readonly retrievalRole: string;
}

export interface LoreControls {
  readonly primaryKeys: readonly string[];
  readonly secondaryKeys: readonly string[];
  readonly enabled: boolean;
  readonly constant: boolean;
  readonly scanDepth: number;
  readonly insertionPosition: LoreInsertionPosition;
  readonly insertionOrder: number;
  readonly probability: number;
  readonly retrievalRole: LoreRetrievalRole;
  readonly support: LoreControlSupport;
}

export const DEFAULT_LORE_CONTROL_SUPPORT: LoreControlSupport = {
  primaryKeys: 'stored_only',
  secondaryKeys: 'stored_only',
  enabled: 'stored_only',
  constant: 'layer_entry_recall',
  scanDepth: 'stored_only',
  insertionPosition: 'stored_only',
  insertionOrder: 'layer_entry_priority_recall',
  probability: 'stored_only',
  retrievalRole: 'stored_only',
};

export const DEFAULT_LORE_CONTROLS: LoreControls = {
  primaryKeys: [],
  secondaryKeys: [],
  enabled: true,
  constant: false,
  scanDepth: 4,
  insertionPosition: 'lore_block',
  insertionOrder: 0,
  probability: 1,
  retrievalRole: 'system',
  support: DEFAULT_LORE_CONTROL_SUPPORT,
};

export interface LoreEntry {
  readonly recordId: string;
  readonly revision: number;
  readonly layerIds: readonly string[];
  readonly sourceLayerId: string | undefined;
  readonly sourceLayerWritePolicy: string | undefined;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly body: string;
  readonly canonLevel: string;
  readonly tags: readonly string[];
  readonly loreControls: LoreControls;
  readonly capturedBy: string;
  readonly captureReason: string;
  readonly capturedAt: string;
  readonly supersedesRecordId: string;
  readonly supersededByRecordId: string;
}

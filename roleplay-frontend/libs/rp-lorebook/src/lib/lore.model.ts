/**
 * A lorekeep entry as the frontend displays it. This mirrors the subset of the
 * lorekeep entry contract (contracts/v0/schemas/entry.schema.json) the lorebook
 * UI needs. The full HTTP client wiring is a follow-on task; this panel renders
 * whatever the LoreSource provides.
 */
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
  readonly capturedBy: string;
  readonly captureReason: string;
  readonly capturedAt: string;
  readonly supersedesRecordId: string;
  readonly supersededByRecordId: string;
}

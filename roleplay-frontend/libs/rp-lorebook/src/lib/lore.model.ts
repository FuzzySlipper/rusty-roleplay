/**
 * A lorekeep entry as the frontend displays it. This mirrors the subset of the
 * lorekeep entry contract (contracts/v0/schemas/entry.schema.json) the lorebook
 * UI needs. The full HTTP client wiring is a follow-on task; this panel renders
 * whatever the LoreSource provides.
 */
export interface LoreEntry {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly canonLevel: string;
  readonly tags: readonly string[];
}

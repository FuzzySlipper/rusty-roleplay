import { InjectionToken } from '@angular/core';

import { LoreEntry } from './lore.model';

/** A campaign summary as the lorebook UI lists it. */
export interface LoreCampaignSummary {
  readonly id: string;
  readonly name: string;
}

/**
 * Data-access boundary for lore. The lorebook UI depends only on this interface,
 * never on a concrete source. v0 ships a MockLoreSource; once the lorekeep HTTP
 * client exists it is swapped in by re-providing LORE_SOURCE — no component
 * changes. This mirrors rusty-view's transport-interface + mock pattern.
 */
export interface LoreSource {
  searchEntries(
    campaignId: string,
    query: string,
  ): Promise<readonly LoreEntry[]>;
  getEntry(campaignId: string, slug: string): Promise<LoreEntry | null>;
  listCampaigns(profileId: string): Promise<readonly LoreCampaignSummary[]>;
}

export const LORE_SOURCE = new InjectionToken<LoreSource>('LORE_SOURCE');

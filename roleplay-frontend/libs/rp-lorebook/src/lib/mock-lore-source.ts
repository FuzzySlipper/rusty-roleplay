import { Provider } from '@angular/core';

import { LoreEntry } from './lore.model';
import { LORE_SOURCE, LoreCampaignSummary, LoreSource } from './lore-source';

const MOCK_ENTRIES: readonly LoreEntry[] = [
  {
    slug: 'northmarch-taxes',
    title: 'Northmarch Tax Dispute',
    summary:
      'The barons of Northmarch have withheld taxes from the crown for three seasons.',
    canonLevel: 'canon',
    tags: ['politics', 'conflict'],
  },
  {
    slug: 'silver-flame',
    title: 'Order of the Silver Flame',
    summary: 'A martial order loyal to the crown; Xavier is a sworn duelist.',
    canonLevel: 'canon',
    tags: ['faction'],
  },
  {
    slug: 'shadow-capital',
    title: 'The Shadow Capital',
    summary: 'A hidden city rumored to be controlled by the Black Flame.',
    canonLevel: 'rumor',
    tags: ['location', 'mystery'],
  },
];

const MOCK_CAMPAIGNS: readonly LoreCampaignSummary[] = [
  { id: 'eldoria', name: 'The Eldoria Chronicles' },
];

/**
 * In-memory LoreSource returning fixture data. Stands in for the lorekeep HTTP
 * client until that lands (see the lorekeep service, task #3210).
 */
export class MockLoreSource implements LoreSource {
  async searchEntries(
    _campaignId: string,
    query: string,
  ): Promise<readonly LoreEntry[]> {
    const q = query.trim().toLowerCase();
    if (!q) {
      return MOCK_ENTRIES;
    }
    return MOCK_ENTRIES.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  async getEntry(_campaignId: string, slug: string): Promise<LoreEntry | null> {
    return MOCK_ENTRIES.find((e) => e.slug === slug) ?? null;
  }

  async listCampaigns(
    _profileId: string,
  ): Promise<readonly LoreCampaignSummary[]> {
    return MOCK_CAMPAIGNS;
  }
}

/** Provides the mock LoreSource. Swap for an HTTP-backed provider later. */
export function provideMockLoreSource(): Provider {
  return { provide: LORE_SOURCE, useClass: MockLoreSource };
}

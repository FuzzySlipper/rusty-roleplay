import { describe, expect, it } from 'vitest';

import { MockLoreSource } from './mock-lore-source';

describe('MockLoreSource', () => {
  const source = new MockLoreSource();

  it('returns all entries for an empty query', async () => {
    const entries = await source.searchEntries('eldoria', '');
    expect(entries.length).toBeGreaterThanOrEqual(3);
  });

  it('filters entries by query', async () => {
    const entries = await source.searchEntries('eldoria', 'silver');
    expect(entries).toHaveLength(1);
    expect(entries[0].slug).toBe('silver-flame');
  });

  it('looks up a single entry by slug', async () => {
    expect(
      (await source.getEntry('eldoria', 'shadow-capital'))?.title,
    ).toContain('Shadow');
    expect(await source.getEntry('eldoria', 'nope')).toBeNull();
  });

  it('lists campaigns', async () => {
    const campaigns = await source.listCampaigns('sister-a');
    expect(campaigns[0]?.id).toBe('eldoria');
  });
});

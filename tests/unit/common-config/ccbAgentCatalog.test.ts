import { describe, expect, it } from 'vitest';
import { filterGuidCatalogAgents } from '@/common/config/ccbAgentCatalog';
import type { CcbAgentRecord } from '@/common/config/ccbAgents';

function agent(partial: Partial<CcbAgentRecord> & Pick<CcbAgentRecord, 'id' | 'name'>): CcbAgentRecord {
  return {
    schema_version: 1,
    enabled: true,
    recommended_prompts: [],
    mcp_allowlist: [],
    skills: { enabled: [], disabled: [] },
    source: 'user',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('filterGuidCatalogAgents', () => {
  it('hides default router only; shows WanD specialists and office bundled presets', () => {
    const filtered = filterGuidCatalogAgents([
      agent({ id: 'wande-orchestrator', name: 'Router', source: 'bundled', guid_primary: true }),
      agent({ id: 'ppt-creator', name: 'PPT', source: 'bundled' }),
      agent({ id: 'quotation-agent', name: 'quotation-agent', source: 'bundled', guid_primary: true }),
      agent({ id: 'accurate-agent', name: 'accurate-agent', source: 'bundled' }),
      agent({ id: 'word-creator', name: 'Word', source: 'bundled' }),
      agent({ id: 'custom', name: 'Custom', guid_primary: true }),
      agent({ id: 'hidden-user', name: 'Hidden', guid_primary: false }),
    ]);

    expect(filtered.map((item) => item.id)).toEqual([
      'ppt-creator',
      'quotation-agent',
      'accurate-agent',
      'word-creator',
      'custom',
    ]);
  });

  it('hides price-library-agent when requires_price_admin and caller is not admin', () => {
    const filtered = filterGuidCatalogAgents(
      [
        agent({
          id: 'price-library-agent',
          name: 'price-library-agent',
          source: 'bundled',
          guid_primary: true,
          requires_price_admin: true,
        }),
        agent({ id: 'quotation-agent', name: 'quotation-agent', source: 'bundled', guid_primary: true }),
      ],
      { isPriceAdmin: false },
    );
    expect(filtered.map((item) => item.id)).toEqual(['quotation-agent']);
  });

  it('shows price-library-agent when isPriceAdmin is true', () => {
    const filtered = filterGuidCatalogAgents(
      [
        agent({
          id: 'price-library-agent',
          name: 'price-library-agent',
          source: 'bundled',
          guid_primary: true,
          requires_price_admin: true,
        }),
      ],
      { isPriceAdmin: true },
    );
    expect(filtered.map((item) => item.id)).toEqual(['price-library-agent']);
  });
});

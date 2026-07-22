import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { filterGuidCatalogAgents } from '@/common/config/ccbAgentCatalog';
import { applyGuidZeroCardList, isGuidZeroCardEnabled } from '@/common/config/guidZeroCard';
import { STORAGE_KEYS } from '@/common/config/storageKeys';
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

  it('returns empty when zeroCard is true (Guid surface only)', () => {
    const filtered = filterGuidCatalogAgents(
      [
        agent({ id: 'quotation-agent', name: 'quotation-agent', source: 'bundled', guid_primary: true }),
        agent({ id: 'custom', name: 'Custom', guid_primary: true }),
      ],
      { zeroCard: true, isPriceAdmin: true },
    );
    expect(filtered).toEqual([]);
  });
});

describe('guidZeroCard flag (G2 default on)', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to on when unset (G2)', () => {
    expect(isGuidZeroCardEnabled()).toBe(true);
    expect(applyGuidZeroCardList([{ id: 'a' }])).toEqual([]);
  });

  it('shows Guid cards when localStorage flag is 0 (opt-out)', () => {
    localStorage.setItem(STORAGE_KEYS.CCB_GUID_ZERO_CARD, '0');
    expect(isGuidZeroCardEnabled()).toBe(false);
    expect(applyGuidZeroCardList([{ id: 'a' }, { id: 'b' }])).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('keeps zero-card when localStorage flag is 1', () => {
    localStorage.setItem(STORAGE_KEYS.CCB_GUID_ZERO_CARD, '1');
    expect(isGuidZeroCardEnabled()).toBe(true);
    expect(applyGuidZeroCardList([{ id: 'a' }])).toEqual([]);
  });
});

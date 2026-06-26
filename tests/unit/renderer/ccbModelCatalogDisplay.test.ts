import { describe, expect, it, vi } from 'vitest';
import { CCB_MINIMAX_M3_CATALOG } from '@/common/config/ccbModelSettingsShared';
import {
  enrichCcbModelCatalogEntries,
  resolveCcbModelDescription,
} from '@/renderer/utils/ccbModelCatalogDisplay';

describe('ccbModelCatalogDisplay', () => {
  it('enrichCcbModelCatalogEntries fills description keys when IPC omits them', () => {
    const enriched = enrichCcbModelCatalogEntries(
      [{ model_id: 'minimax-m3', model_label: 'MiniMax M3' }],
      { model_id: 'minimax-m3', model_label: 'MiniMax M3', description_i18n_key: 'settings.ccbModelGenericDescription' }
    );
    expect(enriched[0].description_i18n_key).toBe('settings.ccbModelMinimaxM3Description');
  });

  it('resolveCcbModelDescription returns zh default when key missing', () => {
    const t = vi.fn().mockImplementation((_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? '');
    expect(resolveCcbModelDescription('minimax-m3', t)).toContain('常规快速模式');
    expect(t).toHaveBeenCalledWith('settings.ccbModelMinimaxM3Description', expect.objectContaining({
      defaultValue: expect.stringContaining('常规快速模式'),
    }));
  });

  it('catalog entries use flat settings keys', () => {
    expect(CCB_MINIMAX_M3_CATALOG.map((entry) => entry.description_i18n_key)).toEqual([
      'settings.ccbModelMinimaxM3Description',
      'settings.ccbModelMinimaxM3ThinkingDescription',
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CCB_MINIMAX_M3_CATALOG, readCcbModelInfo, resolveCcbEffectiveModelId } from '@/common/config/ccbModelSettings';

describe('ccbModelSettings', () => {
  it('resolveCcbEffectiveModelId prefers env ANTHROPIC_MODEL then settings.model then defaults', () => {
    expect(resolveCcbEffectiveModelId({ model: 'opus-4', env: { ANTHROPIC_MODEL: 'custom-model' } })).toBe(
      'custom-model'
    );
    expect(resolveCcbEffectiveModelId({ model: 'opus-4' })).toBe('opus-4');
    expect(
      resolveCcbEffectiveModelId({
        env: {
          ANTHROPIC_DEFAULT_SONNET_MODEL: 'minimax-m3',
          ANTHROPIC_DEFAULT_OPUS_MODEL: 'opus',
        },
      })
    ).toBe('minimax-m3');
    expect(resolveCcbEffectiveModelId({}, { fallback: 'minimax-m3' })).toBe('minimax-m3');
    expect(resolveCcbEffectiveModelId({ env: { ANTHROPIC_MODEL: 'default' } })).toBe('minimax-m3-thinking');
  });

  it('readCcbModelInfo reads model and base_url from settings.json', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ccb-model-'));
    writeFileSync(
      join(dir, 'settings.json'),
      JSON.stringify({
        modelType: 'anthropic',
        env: {
          ANTHROPIC_BASE_URL: 'https://api.example.com/anthropic',
          ANTHROPIC_DEFAULT_SONNET_MODEL: 'minimax-m3',
        },
      }),
      'utf8'
    );

    const previous = process.env.CCB_WANDING_CONFIG_DIR;
    process.env.CCB_WANDING_CONFIG_DIR = dir;
    try {
      const info = await readCcbModelInfo(dir);
      expect(info).toEqual({
        model_id: 'minimax-m3',
        model_label: 'minimax-m3',
        base_url: 'https://api.example.com/anthropic',
        model_type: 'anthropic',
        source: 'ccb-wanding',
        available_variants: CCB_MINIMAX_M3_CATALOG,
      });
    } finally {
      if (previous === undefined) {
        delete process.env.CCB_WANDING_CONFIG_DIR;
      } else {
        process.env.CCB_WANDING_CONFIG_DIR = previous;
      }
    }
  });

  it('readCcbModelInfo falls back to minimax-m3 when install has empty model fields', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ccb-model-fallback-'));
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({ modelType: 'anthropic' }), 'utf8');

    const previous = process.env.CCB_WANDING_CONFIG_DIR;
    process.env.CCB_WANDING_CONFIG_DIR = dir;
    try {
      const info = await readCcbModelInfo(dir);
      expect(info?.model_id).toBe('minimax-m3-thinking');
    } finally {
      if (previous === undefined) {
        delete process.env.CCB_WANDING_CONFIG_DIR;
      } else {
        process.env.CCB_WANDING_CONFIG_DIR = previous;
      }
    }
  });

  it('readCcbModelInfo includes MiniMax M3 variants when minimax base URL is configured', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ccb-model-variants-'));
    writeFileSync(
      join(dir, 'settings.json'),
      JSON.stringify({
        modelType: 'anthropic',
        env: {
          ANTHROPIC_BASE_URL: 'https://api.minimaxi.com/anthropic',
          ANTHROPIC_DEFAULT_SONNET_MODEL: 'minimax-m3',
        },
      }),
      'utf8'
    );

    const previous = process.env.CCB_WANDING_CONFIG_DIR;
    process.env.CCB_WANDING_CONFIG_DIR = dir;
    try {
      const info = await readCcbModelInfo(dir);
      expect(info?.available_variants?.map((variant) => variant.model_id)).toEqual([
        'minimax-m3',
        'minimax-m3-thinking',
      ]);
    } finally {
      if (previous === undefined) {
        delete process.env.CCB_WANDING_CONFIG_DIR;
      } else {
        process.env.CCB_WANDING_CONFIG_DIR = previous;
      }
    }
  });
});

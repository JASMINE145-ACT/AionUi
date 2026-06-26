import { describe, expect, it } from 'vitest';
import {
  mergeCcbMiniMaxAcpModelInfo,
  normalizeCcbMiniMaxModelId,
  resolveCcbAuthorityAcpModelInfo,
  resolveCcbNewConversationPreferredModelId,
  resolveCcbNewConversationPreferredModelIdForAgent,
  resolveCcbSessionPreferredModelId,
  resolveBackendSessionModelId,
  sessionModelInfoHasCcbVariants,
  preserveCcbUserModelSelection,
} from '@/common/config/ccbAcpModelInfo';
import type { AcpModelInfo } from '@/common/types/platform/acpTypes';
import type { CcbModelInfo } from '@/common/config/ccbModelSettings';
import { CCB_MINIMAX_M3_CATALOG } from '@/common/config/ccbModelSettings';

const ccbMiniMax: CcbModelInfo = {
  model_id: 'minimax-m3',
  model_label: 'minimax-m3',
  source: 'ccb-wanding',
  available_variants: CCB_MINIMAX_M3_CATALOG,
};

const effortTierHandshake: AcpModelInfo = {
  current_model_id: 'minimax-m3/default',
  current_model_label: 'minimax-m3/default',
  available_models: [
    { id: '/default', label: 'Default (recommended) (default)' },
    { id: '/low', label: 'Default (recommended) (low)' },
    { id: '/medium', label: 'Default (recommended) (medium)' },
  ],
};

describe('ccbAcpModelInfo', () => {
  it('normalizeCcbMiniMaxModelId strips effort suffix from minimax ids', () => {
    expect(normalizeCcbMiniMaxModelId('minimax-m3/default')).toBe('minimax-m3');
    expect(normalizeCcbMiniMaxModelId('minimax-m3-thinking/high')).toBe('minimax-m3-thinking');
    expect(normalizeCcbMiniMaxModelId('opus/default')).toBe('opus/default');
  });

  it('mergeCcbMiniMaxAcpModelInfo replaces effort tiers with MiniMax variants', () => {
    const merged = mergeCcbMiniMaxAcpModelInfo(effortTierHandshake, ccbMiniMax);
    expect(merged?.available_models.map((m) => m.id)).toEqual(['minimax-m3', 'minimax-m3-thinking']);
    expect(merged?.current_model_id).toBe('minimax-m3');
    expect(merged?.current_model_label).toBe('MiniMax M3');
  });

  it('mergeCcbMiniMaxAcpModelInfo returns handshake when CCB has no variants', () => {
    expect(mergeCcbMiniMaxAcpModelInfo(effortTierHandshake, null)).toEqual(effortTierHandshake);
  });

  it('mergeCcbMiniMaxAcpModelInfo works with null handshake and CCB variants', () => {
    const merged = mergeCcbMiniMaxAcpModelInfo(null, ccbMiniMax);
    expect(merged?.available_models).toHaveLength(2);
    expect(merged?.current_model_id).toBe('minimax-m3');
  });

  it('resolveCcbAuthorityAcpModelInfo prefers session variant ids over effort tiers', () => {
    const sessionVariants: AcpModelInfo = {
      current_model_id: 'minimax-m3-thinking',
      current_model_label: 'MiniMax M3 (Thinking)',
      available_models: [
        { id: 'minimax-m3', label: 'MiniMax M3' },
        { id: 'minimax-m3-thinking', label: 'MiniMax M3 (Thinking)' },
      ],
    };
    const resolved = resolveCcbAuthorityAcpModelInfo(sessionVariants, ccbMiniMax);
    expect(sessionModelInfoHasCcbVariants(sessionVariants, ccbMiniMax)).toBe(true);
    expect(resolved?.current_model_id).toBe('minimax-m3-thinking');
    expect(resolved?.available_models.map((m) => m.id)).toEqual(['minimax-m3', 'minimax-m3-thinking']);
  });

  it('resolveCcbAuthorityAcpModelInfo normalizes effort-tier session current id', () => {
    const resolved = resolveCcbAuthorityAcpModelInfo(effortTierHandshake, ccbMiniMax);
    expect(resolved?.current_model_id).toBe('minimax-m3');
    expect(resolved?.available_models.map((m) => m.id)).toEqual(['minimax-m3', 'minimax-m3-thinking']);
  });

  it('resolveCcbNewConversationPreferredModelId defaults to thinking and upgrades generic m3', () => {
    expect(resolveCcbNewConversationPreferredModelId(undefined)).toBe('minimax-m3-thinking');
    expect(resolveCcbNewConversationPreferredModelId('minimax-m3')).toBe('minimax-m3-thinking');
    expect(resolveCcbNewConversationPreferredModelId('minimax-m3/default')).toBe('minimax-m3-thinking');
    expect(resolveCcbNewConversationPreferredModelId('minimax-m3-thinking')).toBe('minimax-m3-thinking');
  });

  it('resolveCcbNewConversationPreferredModelIdForAgent pins fast-m3 agents only without explicit variant', () => {
    expect(resolveCcbNewConversationPreferredModelIdForAgent('wande-orchestrator', undefined)).toBe('minimax-m3');
    expect(resolveCcbNewConversationPreferredModelIdForAgent('wande-orchestrator', 'minimax-m3-thinking')).toBe(
      'minimax-m3-thinking'
    );
    expect(resolveCcbNewConversationPreferredModelIdForAgent('wande-orchestrator', 'minimax-m3')).toBe('minimax-m3');
    expect(resolveCcbNewConversationPreferredModelIdForAgent('quotation-agent', undefined)).toBe('minimax-m3');
    expect(resolveCcbNewConversationPreferredModelIdForAgent('quotation-agent', 'minimax-m3-thinking')).toBe(
      'minimax-m3-thinking'
    );
    expect(resolveCcbNewConversationPreferredModelIdForAgent('accurate-agent', undefined)).toBe('minimax-m3');
    expect(resolveCcbNewConversationPreferredModelIdForAgent('cowork', undefined)).toBe('minimax-m3-thinking');
    expect(resolveCcbNewConversationPreferredModelIdForAgent('cowork', 'minimax-m3-thinking')).toBe(
      'minimax-m3-thinking'
    );
  });

  it('resolveCcbSessionPreferredModelId prefers ccb_preferred_model_id over current_model_id', () => {
    expect(
      resolveCcbSessionPreferredModelId({
        ccb_preferred_model_id: 'minimax-m3-thinking',
        current_model_id: 'minimax-m3',
      })
    ).toBe('minimax-m3-thinking');
    expect(resolveCcbSessionPreferredModelId({ current_model_id: 'minimax-m3/default' })).toBe('minimax-m3');
  });

  it('resolveBackendSessionModelId reads raw backend id without UI preservation', () => {
    expect(resolveBackendSessionModelId({ current_model_id: 'minimax-m3', available_models: [] })).toBe(
      'minimax-m3'
    );
    expect(
      resolveBackendSessionModelId({ current_model_id: 'minimax-m3-thinking', available_models: [] })
    ).toBe('minimax-m3-thinking');
    expect(
      resolveBackendSessionModelId({ current_model_id: 'MiniMax-M3', available_models: [] })
    ).toBe('minimax-m3');
  });

  it('preserveCcbUserModelSelection keeps thinking when backend reports generic MiniMax-M3', () => {
    const resolved = resolveCcbAuthorityAcpModelInfo(
      {
        current_model_id: 'MiniMax-M3',
        current_model_label: 'MiniMax-M3',
        available_models: [
          { id: 'minimax-m3', label: 'MiniMax M3' },
          { id: 'minimax-m3-thinking', label: 'MiniMax M3 (Thinking)' },
        ],
      },
      ccbMiniMax
    )!;
    const preserved = preserveCcbUserModelSelection(resolved, resolved, 'minimax-m3-thinking');
    expect(preserved.current_model_id).toBe('minimax-m3-thinking');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AcpModelInfo } from '@/common/types/platform/acpTypes';
import type { CcbModelInfo } from '@/common/config/ccbModelSettings';
import { CCB_MINIMAX_M3_CATALOG } from '@/common/config/ccbModelSettings';
import { ensureCcbSessionPreferredModel } from '@/common/config/ensureCcbSessionPreferredModel';

const { getModelMock, setModelMock } = vi.hoisted(() => ({
  getModelMock: vi.fn(),
  setModelMock: vi.fn(),
}));

vi.mock('@/common/adapter/acpConfigOptionsAdapter', () => ({
  acpAdapterGetModel: getModelMock,
  acpAdapterSetModel: setModelMock,
}));

const ccbMiniMax: CcbModelInfo = {
  model_id: 'minimax-m3',
  model_label: 'MiniMax M3',
  source: 'ccb-wanding',
  available_variants: CCB_MINIMAX_M3_CATALOG,
};

const sessionVariants = (current: string): AcpModelInfo => ({
  current_model_id: current,
  current_model_label: current,
  available_models: [
    { id: 'minimax-m3', label: 'MiniMax M3' },
    { id: 'minimax-m3-thinking', label: 'MiniMax M3 (Thinking)' },
  ],
});

describe('ensureCcbSessionPreferredModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setModelMock.mockResolvedValue({
      model_info: sessionVariants('minimax-m3-thinking'),
    });
  });

  it('calls setModel when session options still use effort tiers', async () => {
    getModelMock.mockResolvedValue({
      model_info: {
        current_model_id: 'minimax-m3-thinking',
        current_model_label: 'Thinking',
        available_models: [{ id: 'minimax-m3/default', label: 'Default' }],
      },
    });
    setModelMock.mockResolvedValue({
      model_info: sessionVariants('minimax-m3'),
    });

    const result = await ensureCcbSessionPreferredModel({
      conversation_id: 'conv-1',
      preferredModelId: 'minimax-m3',
      ccbModelInfo: ccbMiniMax,
    });

    expect(result.status).toBe('applied');
    expect(setModelMock).toHaveBeenCalledWith('conv-1', 'minimax-m3');
  });

  it('calls setModel when backend is minimax-m3 but preferred is thinking', async () => {
    getModelMock.mockResolvedValue({
      model_info: sessionVariants('minimax-m3'),
    });

    const result = await ensureCcbSessionPreferredModel({
      conversation_id: 'conv-1',
      preferredModelId: 'minimax-m3-thinking',
      ccbModelInfo: ccbMiniMax,
    });

    expect(result).toEqual({
      status: 'applied',
      previous_backend_model_id: 'minimax-m3',
      confirmed_model_id: 'minimax-m3-thinking',
    });
    expect(setModelMock).toHaveBeenCalledWith('conv-1', 'minimax-m3-thinking');
  });

  it('skips setModel when backend already matches preferred variant', async () => {
    getModelMock.mockResolvedValue({
      model_info: sessionVariants('minimax-m3-thinking'),
    });

    const result = await ensureCcbSessionPreferredModel({
      conversation_id: 'conv-1',
      preferredModelId: 'minimax-m3-thinking',
      ccbModelInfo: ccbMiniMax,
    });

    expect(result).toEqual({
      status: 'already_applied',
      backend_model_id: 'minimax-m3-thinking',
    });
    expect(setModelMock).not.toHaveBeenCalled();
  });
});

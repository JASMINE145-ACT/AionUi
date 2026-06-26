import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AcpModelInfo } from '@/common/types/platform/acpTypes';
import type { CcbModelInfo } from '@/common/config/ccbModelSettings';
import { CCB_MINIMAX_M3_CATALOG } from '@/common/config/ccbModelSettings';
import { ensureCcbSessionPreferredModel } from '@/common/config/ensureCcbSessionPreferredModel';

const { getModelInvokeMock, setModelInvokeMock } = vi.hoisted(() => ({
  getModelInvokeMock: vi.fn(),
  setModelInvokeMock: vi.fn(),
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  acpConversation: {
    getModel: { invoke: getModelInvokeMock },
    setModel: { invoke: setModelInvokeMock },
  },
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
    setModelInvokeMock.mockResolvedValue({
      model_info: sessionVariants('minimax-m3-thinking'),
    });
  });

  it('calls setModel when session options still use effort tiers', async () => {
    getModelInvokeMock.mockResolvedValue({
      model_info: {
        current_model_id: 'minimax-m3-thinking',
        current_model_label: 'Thinking',
        available_models: [{ id: 'minimax-m3/default', label: 'Default' }],
      },
    });
    setModelInvokeMock.mockResolvedValue({
      model_info: sessionVariants('minimax-m3'),
    });

    const result = await ensureCcbSessionPreferredModel({
      conversation_id: 'conv-1',
      preferredModelId: 'minimax-m3',
      ccbModelInfo: ccbMiniMax,
    });

    expect(result.status).toBe('applied');
    expect(setModelInvokeMock).toHaveBeenCalledWith({
      conversation_id: 'conv-1',
      model_id: 'minimax-m3',
    });
  });

  it('calls setModel when backend is minimax-m3 but preferred is thinking', async () => {
    getModelInvokeMock.mockResolvedValue({
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
    expect(setModelInvokeMock).toHaveBeenCalledWith({
      conversation_id: 'conv-1',
      model_id: 'minimax-m3-thinking',
    });
  });

  it('skips setModel when backend already matches preferred variant', async () => {
    getModelInvokeMock.mockResolvedValue({
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
    expect(setModelInvokeMock).not.toHaveBeenCalled();
  });
});

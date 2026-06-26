import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureCcbSessionPreferredMode } from '@/common/config/ensureCcbSessionPreferredMode';

const { getModeInvokeMock, setModeInvokeMock } = vi.hoisted(() => ({
  getModeInvokeMock: vi.fn(),
  setModeInvokeMock: vi.fn(),
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  acpConversation: {
    getMode: { invoke: getModeInvokeMock },
    setMode: { invoke: setModeInvokeMock },
  },
}));

describe('ensureCcbSessionPreferredMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setModeInvokeMock.mockResolvedValue({ mode: 'bypassPermissions' });
  });

  it('calls setMode when backend mode differs from Guid selection', async () => {
    getModeInvokeMock.mockResolvedValue({ mode: 'default', initialized: true });

    const result = await ensureCcbSessionPreferredMode({
      conversation_id: 'conv-1',
      preferredMode: 'bypassPermissions',
    });

    expect(result).toEqual({
      status: 'applied',
      previous_backend_mode: 'default',
      confirmed_mode: 'bypassPermissions',
    });
    expect(setModeInvokeMock).toHaveBeenCalledWith({
      conversation_id: 'conv-1',
      mode: 'bypassPermissions',
    });
  });

  it('skips setMode when backend already matches preferred mode', async () => {
    getModeInvokeMock.mockResolvedValue({ mode: 'bypassPermissions', initialized: true });

    const result = await ensureCcbSessionPreferredMode({
      conversation_id: 'conv-1',
      preferredMode: 'bypassPermissions',
    });

    expect(result).toEqual({
      status: 'already_applied',
      backend_mode: 'bypassPermissions',
    });
    expect(setModeInvokeMock).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertCcbSessionPreferredModeApplied,
  ensureCcbSessionPreferredMode,
} from '@/common/config/ensureCcbSessionPreferredMode';

const { getModeMock, setModeMock } = vi.hoisted(() => ({
  getModeMock: vi.fn(),
  setModeMock: vi.fn(),
}));

vi.mock('@/common/adapter/acpConfigOptionsAdapter', () => ({
  acpAdapterGetMode: getModeMock,
  acpAdapterSetMode: setModeMock,
}));

describe('ensureCcbSessionPreferredMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setModeMock.mockResolvedValue({ mode: 'bypassPermissions' });
  });

  it('calls setMode when backend mode differs from Guid selection', async () => {
    getModeMock.mockResolvedValue({ mode: 'default', initialized: true });

    const result = await ensureCcbSessionPreferredMode({
      conversation_id: 'conv-1',
      preferredMode: 'bypassPermissions',
    });

    expect(result).toEqual({
      status: 'applied',
      previous_backend_mode: 'default',
      confirmed_mode: 'bypassPermissions',
    });
    expect(setModeMock).toHaveBeenCalledWith('conv-1', 'bypassPermissions');
  });

  it('skips setMode when backend already matches preferred mode', async () => {
    getModeMock.mockResolvedValue({ mode: 'bypassPermissions', initialized: true });

    const result = await ensureCcbSessionPreferredMode({
      conversation_id: 'conv-1',
      preferredMode: 'bypassPermissions',
    });

    expect(result).toEqual({
      status: 'already_applied',
      backend_mode: 'bypassPermissions',
    });
    expect(setModeMock).not.toHaveBeenCalled();
  });

  it('assert throws when ensure failed', () => {
    expect(() =>
      assertCcbSessionPreferredModeApplied(
        { status: 'failed', error: 'setMode rejected' },
        'bypassPermissions',
      ),
    ).toThrow('setMode rejected');
  });

  it('assert throws when confirmed mode differs from preferred', () => {
    expect(() =>
      assertCcbSessionPreferredModeApplied(
        {
          status: 'applied',
          previous_backend_mode: 'default',
          confirmed_mode: 'default',
        },
        'bypassPermissions',
      ),
    ).toThrow('Permission mode not confirmed');
  });

  it('maps preferredMode yolo to bypassPermissions for Claude before setMode', async () => {
    getModeMock.mockResolvedValue({ mode: 'default', initialized: true });

    const result = await ensureCcbSessionPreferredMode({
      conversation_id: 'conv-1',
      preferredMode: 'yolo',
      backend: 'claude',
    });

    expect(result).toEqual({
      status: 'applied',
      previous_backend_mode: 'default',
      confirmed_mode: 'bypassPermissions',
    });
    expect(setModeMock).toHaveBeenCalledWith('conv-1', 'bypassPermissions');
  });

  it('assert accepts preferred yolo when confirmed is bypassPermissions', () => {
    expect(() =>
      assertCcbSessionPreferredModeApplied(
        {
          status: 'applied',
          previous_backend_mode: 'default',
          confirmed_mode: 'bypassPermissions',
        },
        'yolo',
        'claude',
      ),
    ).not.toThrow();
  });
});

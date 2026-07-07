import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resetWarmupConversationStateForTests,
  warmupConversation,
} from '@/renderer/pages/conversation/utils/warmupConversation';

const { warmupInvokeMock, stageFromConversationMock, stageEmployeeProfileMock, prepareContinuityMock } = vi.hoisted(() => ({
  warmupInvokeMock: vi.fn(),
  stageFromConversationMock: vi.fn(),
  stageEmployeeProfileMock: vi.fn(),
  prepareContinuityMock: vi.fn(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      warmup: {
        invoke: warmupInvokeMock,
      },
      get: {
        invoke: vi.fn().mockResolvedValue({ extra: {} }),
      },
    },
  },
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  ccbModelService: {
    stageConversationIdentity: {
      invoke: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

vi.mock('@/common/config/conversationContinuity', () => ({
  prepareConversationContinuity: prepareContinuityMock,
  persistConversationContinuityBinding: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/common/utils/ccbPresetConversationExtra', () => ({
  stageCcbAssistantProfileFromConversation: stageFromConversationMock,
}));

vi.mock('@/common/utils/stageEmployeeProfileForSession', () => ({
  stageEmployeeProfileForSession: stageEmployeeProfileMock,
}));

describe('warmupConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWarmupConversationStateForTests();
    stageFromConversationMock.mockResolvedValue(undefined);
    stageEmployeeProfileMock.mockResolvedValue(undefined);
    warmupInvokeMock.mockResolvedValue(undefined);
    prepareContinuityMock.mockResolvedValue({
      ccbAuthority: false,
      forceWarmup: false,
      needsRefresh: false,
    });
  });

  it('stages CCB profile and employee profile before warmup invoke', async () => {
    await warmupConversation('conv-1');

    expect(stageFromConversationMock).toHaveBeenCalledWith('conv-1');
    expect(stageEmployeeProfileMock).toHaveBeenCalled();
    expect(warmupInvokeMock).toHaveBeenCalledWith({ conversation_id: 'conv-1' });
  });

  it('coalesces concurrent warmups for the same conversation', async () => {
    let resolveWarmup: (() => void) | undefined;
    warmupInvokeMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveWarmup = resolve;
      })
    );

    const first = warmupConversation('conv-1');
    const second = warmupConversation('conv-1');
    await vi.waitUntil(() => warmupInvokeMock.mock.calls.length >= 1);

    expect(warmupInvokeMock).toHaveBeenCalledTimes(1);
    expect(warmupInvokeMock).toHaveBeenCalledWith({ conversation_id: 'conv-1' });

    resolveWarmup?.();
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
  });

  it('retries after a failed warmup', async () => {
    warmupInvokeMock.mockRejectedValueOnce(new Error('warmup failed')).mockResolvedValueOnce(undefined);

    await expect(warmupConversation('conv-1')).rejects.toThrow('warmup failed');
    await expect(warmupConversation('conv-1')).resolves.toBeUndefined();

    expect(warmupInvokeMock).toHaveBeenCalledTimes(2);
  });

  it('skips repeated warmup after a conversation is already ready', async () => {
    warmupInvokeMock.mockResolvedValue(undefined);

    await expect(warmupConversation('conv-1')).resolves.toBeUndefined();
    await expect(warmupConversation('conv-1')).resolves.toBeUndefined();

    expect(warmupInvokeMock).toHaveBeenCalledTimes(1);
  });
});

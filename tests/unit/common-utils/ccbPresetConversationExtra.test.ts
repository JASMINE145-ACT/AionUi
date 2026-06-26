import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getProfileInvokeMock, stageProfileInvokeMock, conversationGetMock, ccbAuthorityMock } = vi.hoisted(() => ({
  getProfileInvokeMock: vi.fn(),
  stageProfileInvokeMock: vi.fn(),
  conversationGetMock: vi.fn(),
  ccbAuthorityMock: vi.fn(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    ccbAssistantProfilesService: {
      getProfile: { invoke: getProfileInvokeMock },
      stageNextSessionProfile: { invoke: stageProfileInvokeMock },
    },
    conversation: {
      get: { invoke: conversationGetMock },
    },
  },
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  ccbModelService: {
    isAuthorityActive: { invoke: ccbAuthorityMock },
  },
}));

import {
  buildCcbPresetConversationExtra,
  stageCcbAssistantProfileForSession,
  stageCcbAssistantProfileFromConversation,
} from '@/common/utils/ccbPresetConversationExtra';

describe('buildCcbPresetConversationExtra', () => {
  beforeEach(() => {
    getProfileInvokeMock.mockReset();
    getProfileInvokeMock.mockResolvedValue({
      id: 'word-creator',
      instructions: { claude_md: 'Word assistant context' },
    });
  });

  it('returns empty extra when CCB authority is inactive', async () => {
    await expect(buildCcbPresetConversationExtra('word-creator', false)).resolves.toEqual({});
    expect(getProfileInvokeMock).not.toHaveBeenCalled();
  });

  it('hands off profile id only without preset_context', async () => {
    await expect(buildCcbPresetConversationExtra('builtin-word-creator', true)).resolves.toEqual({
      ccb_assistant_profile_id: 'word-creator',
      ccb_agent_id: 'word-creator',
      acp_meta: {
        ccbAssistantProfileId: 'word-creator',
        ccbAgentId: 'word-creator',
        preset_assistant_id: 'word-creator',
      },
    });
    expect(getProfileInvokeMock).toHaveBeenCalledWith({ id: 'word-creator' });
  });

  it('still returns profile id when profile lookup fails', async () => {
    getProfileInvokeMock.mockRejectedValue(new Error('not found'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(buildCcbPresetConversationExtra('missing-profile', true)).resolves.toEqual({
      ccb_assistant_profile_id: 'missing-profile',
      ccb_agent_id: 'missing-profile',
      acp_meta: {
        ccbAssistantProfileId: 'missing-profile',
        ccbAgentId: 'missing-profile',
        preset_assistant_id: 'missing-profile',
      },
    });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('stageCcbAssistantProfileForSession', () => {
  beforeEach(() => {
    stageProfileInvokeMock.mockReset();
    stageProfileInvokeMock.mockResolvedValue(undefined);
  });

  it('stages normalized profile id before session warmup', async () => {
    await stageCcbAssistantProfileForSession('builtin-word-creator');
    expect(stageProfileInvokeMock).toHaveBeenCalledWith({ profile_id: 'word-creator' });
  });

  it('no-ops for empty profile id', async () => {
    await stageCcbAssistantProfileForSession(undefined);
    expect(stageProfileInvokeMock).not.toHaveBeenCalled();
  });
});

describe('stageCcbAssistantProfileFromConversation', () => {
  beforeEach(() => {
    stageProfileInvokeMock.mockReset();
    stageProfileInvokeMock.mockResolvedValue(undefined);
    conversationGetMock.mockReset();
    ccbAuthorityMock.mockReset();
  });

  it('stages profile from conversation extra when CCB authority is active', async () => {
    ccbAuthorityMock.mockResolvedValue(true);
    conversationGetMock.mockResolvedValue({
      extra: { ccb_assistant_profile_id: 'quotation-agent' },
    });

    await stageCcbAssistantProfileFromConversation('conv-1');

    expect(conversationGetMock).toHaveBeenCalledWith({ id: 'conv-1' });
    expect(stageProfileInvokeMock).toHaveBeenCalledWith({ profile_id: 'quotation-agent' });
  });

  it('skips staging when CCB authority is inactive', async () => {
    ccbAuthorityMock.mockResolvedValue(false);

    await stageCcbAssistantProfileFromConversation('conv-1');

    expect(conversationGetMock).not.toHaveBeenCalled();
    expect(stageProfileInvokeMock).not.toHaveBeenCalled();
  });
});

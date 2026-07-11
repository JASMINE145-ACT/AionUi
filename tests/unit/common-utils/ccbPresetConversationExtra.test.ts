import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getProfileInvokeMock, stageProfileInvokeMock, conversationGetMock, ccbAuthorityMock, messagesGetMock } = vi.hoisted(() => ({
  getProfileInvokeMock: vi.fn(),
  stageProfileInvokeMock: vi.fn(),
  conversationGetMock: vi.fn(),
  ccbAuthorityMock: vi.fn(),
  messagesGetMock: vi.fn(),
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
    database: {
      getConversationMessages: { invoke: messagesGetMock },
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
  resolveCcbProfileIdFromConversationExtra,
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
      preset_assistant_id: 'word-creator',
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
      preset_assistant_id: 'missing-profile',
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
    messagesGetMock.mockReset();
    messagesGetMock.mockResolvedValue({ items: [], total: 0, has_more: false });
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

  it('stages profile from ccb_agent_id when ccb_assistant_profile_id missing', async () => {
    ccbAuthorityMock.mockResolvedValue(true);
    conversationGetMock.mockResolvedValue({
      extra: { ccb_agent_id: 'quotation-agent' },
    });

    await stageCcbAssistantProfileFromConversation('conv-2');

    expect(stageProfileInvokeMock).toHaveBeenCalledWith({ profile_id: 'quotation-agent' });
  });

  it('infers quotation-agent from message history when extra has no profile', async () => {
    ccbAuthorityMock.mockResolvedValue(true);
    conversationGetMock.mockResolvedValue({ extra: {} });
    messagesGetMock.mockResolvedValue({
      items: [
        {
          type: 'acp_tool_call',
          content: {
            update: { title: 'mcp__quotation__match_quotation execute', status: 'completed' },
          },
        },
      ],
      total: 1,
      has_more: false,
    });

    await stageCcbAssistantProfileFromConversation('conv-3');

    expect(messagesGetMock).toHaveBeenCalled();
    expect(stageProfileInvokeMock).toHaveBeenCalledWith({ profile_id: 'quotation-agent' });
  });

  it('skips staging when CCB authority is inactive', async () => {
    ccbAuthorityMock.mockResolvedValue(false);

    await stageCcbAssistantProfileFromConversation('conv-1');

    expect(conversationGetMock).not.toHaveBeenCalled();
    expect(stageProfileInvokeMock).not.toHaveBeenCalled();
  });
});

describe('resolveCcbProfileIdFromConversationExtra', () => {
  it('reads acp_meta.ccbAgentId', () => {
    expect(
      resolveCcbProfileIdFromConversationExtra({
        acp_meta: { ccbAgentId: 'accurate-agent' },
      })
    ).toBe('accurate-agent');
  });

  it('falls back to custom_agent_id for channel preset sessions', () => {
    expect(
      resolveCcbProfileIdFromConversationExtra({
        custom_agent_id: 'quotation-agent',
      })
    ).toBe('quotation-agent');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getProfileInvokeMock } = vi.hoisted(() => ({
  getProfileInvokeMock: vi.fn(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    ccbAssistantProfilesService: {
      getProfile: { invoke: getProfileInvokeMock },
    },
  },
}));

import { buildCcbPresetConversationExtra } from '@/common/utils/ccbPresetConversationExtra';

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

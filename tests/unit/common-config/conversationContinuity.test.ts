import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authorityMock, snapshotMock, conversationGetMock, conversationUpdateMock, syncKnowledgeMock } = vi.hoisted(() => ({
  authorityMock: vi.fn(),
  snapshotMock: vi.fn(),
  conversationGetMock: vi.fn(),
  conversationUpdateMock: vi.fn(),
  syncKnowledgeMock: vi.fn(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      get: { invoke: conversationGetMock },
      update: { invoke: conversationUpdateMock },
    },
  },
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  ccbModelService: {
    isAuthorityActive: { invoke: authorityMock },
    getContinuitySnapshot: { invoke: snapshotMock },
    syncKnowledgeContinuity: { invoke: syncKnowledgeMock },
  },
}));

vi.mock('@/common/config/ccbSessionPreferredModeStore', () => ({
  seedCcbSessionPreferredMode: vi.fn(),
}));

import {
  isCcbWandingConversation,
  needsConversationRefresh,
  persistConversationContinuityBinding,
  prepareConversationContinuity,
  resolveEffectiveInstalledVersion,
  type ConversationContinuityContext,
} from '@/common/config/conversationContinuity';
import type { CcbContinuitySnapshot } from '@/common/config/ccbContinuitySnapshotShared';

const CCB_CONVERSATION = {
  type: 'acp' as const,
  extra: { backend: 'claude', ccb_agent_id: 'quotation-agent' },
};

const SNAPSHOT: CcbContinuitySnapshot = {
  ship_config_generation: 5,
  user_config_generation: 5,
  installed_version: '1.1.7',
  app_version: '1.7.0',
  kb_content_hash: 'kb-hash',
};

function ctx(
  snapshot: Partial<CcbContinuitySnapshot> & Pick<CcbContinuitySnapshot, 'ship_config_generation'>,
  extra: { gen?: number; version?: string } = {},
): ConversationContinuityContext {
  const full: CcbContinuitySnapshot = {
    ship_config_generation: snapshot.ship_config_generation,
    user_config_generation: snapshot.user_config_generation ?? snapshot.ship_config_generation,
    installed_version: snapshot.installed_version ?? '1.1.7',
    app_version: snapshot.app_version ?? '1.7.0',
    kb_content_hash: snapshot.kb_content_hash ?? 'kb-hash',
  };
  return {
    conversation_id: 'conv-1',
    snapshot: full,
    extra: {},
    last_bound_config_generation: extra.gen ?? 0,
    last_bound_app_version: extra.version ?? '',
    effective_installed_version: resolveEffectiveInstalledVersion(full),
  };
}

describe('needsConversationRefresh', () => {
  it('returns true when ship config generation increased', () => {
    expect(needsConversationRefresh(ctx({ ship_config_generation: 6 }, { gen: 5 }))).toBe(true);
  });

  it('returns false when generation unchanged and version matches', () => {
    expect(
      needsConversationRefresh(
        ctx({ ship_config_generation: 5, installed_version: '1.1.7' }, { gen: 5, version: '1.1.7' }),
      ),
    ).toBe(false);
  });

  it('returns true when installed version changed even if last_bound version empty', () => {
    expect(
      needsConversationRefresh(
        ctx({ ship_config_generation: 5, installed_version: '1.1.8' }, { gen: 5, version: '' }),
      ),
    ).toBe(true);
  });

  it('returns false on second open same version (D2 idempotent)', () => {
    expect(
      needsConversationRefresh(
        ctx({ ship_config_generation: 5, installed_version: '1.1.7' }, { gen: 5, version: '1.1.7' }),
      ),
    ).toBe(false);
  });
});

describe('isCcbWandingConversation', () => {
  it('accepts claude acp with ccb profile extra', () => {
    expect(isCcbWandingConversation(CCB_CONVERSATION)).toBe(true);
  });

  it('accepts claude backend without explicit markers', () => {
    expect(
      isCcbWandingConversation({
        type: 'acp',
        extra: { backend: 'claude' },
      }),
    ).toBe(true);
  });

  it('rejects gemini backend', () => {
    expect(
      isCcbWandingConversation({
        type: 'acp',
        extra: { backend: 'gemini' },
      }),
    ).toBe(false);
  });

  it('rejects health check sessions', () => {
    expect(
      isCcbWandingConversation({
        type: 'acp',
        extra: { backend: 'claude', is_health_check: true },
      }),
    ).toBe(false);
  });

  it('rejects non-acp type', () => {
    expect(
      isCcbWandingConversation({
        type: 'chat',
        extra: { backend: 'claude' },
      }),
    ).toBe(false);
  });
});

describe('resolveEffectiveInstalledVersion', () => {
  it('prefers CCB install VERSION over app version', () => {
    expect(
      resolveEffectiveInstalledVersion({
        ship_config_generation: 1,
        user_config_generation: 1,
        installed_version: '1.1.7',
        app_version: '1.7.0',
        kb_content_hash: 'kb-hash',
      }),
    ).toBe('1.1.7');
  });
});

describe('prepareConversationContinuity (D4 throw paths)', () => {
  beforeEach(() => {
    authorityMock.mockReset();
    snapshotMock.mockReset();
    conversationGetMock.mockReset();
    conversationUpdateMock.mockReset();
    syncKnowledgeMock.mockReset();
    authorityMock.mockResolvedValue(true);
    conversationGetMock.mockResolvedValue({
      ...CCB_CONVERSATION,
      id: 'conv-1',
      extra: {
        ...CCB_CONVERSATION.extra,
        last_bound_config_generation: 5,
        last_bound_app_version: '1.1.7',
      },
    });
    snapshotMock.mockResolvedValue(SNAPSHOT);
  });

  it('returns early without throw for non-CCB conversation', async () => {
    conversationGetMock.mockResolvedValue({
      type: 'acp',
      extra: { backend: 'gemini' },
    });

    await expect(prepareConversationContinuity('conv-1')).resolves.toMatchObject({
      ccbAuthority: false,
      needsRefresh: false,
    });
    expect(snapshotMock).not.toHaveBeenCalled();
  });

  it('throws when continuity snapshot fetch fails', async () => {
    snapshotMock.mockRejectedValue(new Error('ipc unavailable'));

    await expect(prepareConversationContinuity('conv-1')).rejects.toThrow(
      '无法读取当前安装版本信息',
    );
  });

  it('throws when conversation.get fails', async () => {
    conversationGetMock.mockRejectedValue(new Error('404 not found'));

    await expect(prepareConversationContinuity('conv-1')).rejects.toThrow('无法加载会话信息');
  });

  it('defers refresh when conversation is processing (C6)', async () => {
    conversationGetMock.mockResolvedValue({
      ...CCB_CONVERSATION,
      id: 'conv-1',
      runtime: {
        state: 'running',
        is_processing: true,
        can_send_message: false,
        has_task: true,
        pending_confirmations: 0,
        turn_id: 't1',
      },
      extra: {
        ...CCB_CONVERSATION.extra,
        last_bound_config_generation: 0,
        last_bound_app_version: '',
      },
    });

    await expect(prepareConversationContinuity('conv-1')).resolves.toMatchObject({
      ccbAuthority: true,
      needsRefresh: true,
      refreshDeferred: true,
      forceWarmup: false,
    });
  });
});

describe('persistConversationContinuityBinding (D4 throw paths)', () => {
  beforeEach(() => {
    conversationUpdateMock.mockReset();
    syncKnowledgeMock.mockReset();
    syncKnowledgeMock.mockResolvedValue(undefined);
  });

  it('rethrows when conversation.update fails', async () => {
    conversationUpdateMock.mockRejectedValue(new Error('db locked'));

    await expect(persistConversationContinuityBinding('conv-1', SNAPSHOT)).rejects.toThrow(
      '会话版本绑定失败',
    );
  });

  it('persists binding without knowledge sync when no prior read', async () => {
    conversationUpdateMock.mockResolvedValue(undefined);

    await expect(persistConversationContinuityBinding('conv-1', SNAPSHOT)).resolves.toEqual({});
    expect(conversationUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'conv-1',
        merge_extra: true,
      }),
    );
    expect(syncKnowledgeMock).not.toHaveBeenCalled();
  });
});

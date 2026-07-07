/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IMcpServer } from '@/common/config/storage';
import { useGuidSend, type GuidSendDeps } from '@/renderer/pages/guid/hooks/useGuidSend';

const createConversationInvokeMock = vi.fn();
const swrMutateMock = vi.fn();
const buildCcbPresetExtraMock = vi.fn();
const stageCcbProfileMock = vi.fn();

vi.mock('@/common/utils/ccbPresetConversationExtra', () => ({
  buildCcbPresetConversationExtra: (...args: unknown[]) => buildCcbPresetExtraMock(...args),
  stageCcbAssistantProfileForSession: (...args: unknown[]) => stageCcbProfileMock(...args),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      create: {
        invoke: (...args: unknown[]) => createConversationInvokeMock(...args),
      },
    },
  },
}));

vi.mock('@/renderer/utils/emitter', () => ({
  emitter: {
    emit: vi.fn(),
  },
}));

vi.mock('swr', () => ({
  mutate: (...args: unknown[]) => swrMutateMock(...args),
}));

vi.mock('@/renderer/utils/workspace/workspaceHistory', () => ({
  updateWorkspaceTime: vi.fn(),
}));

vi.mock('@arco-design/web-react', () => ({
  Message: {
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

const createDeps = (): GuidSendDeps => ({
  input: 'hello',
  setInput: vi.fn(),
  files: [],
  setFiles: vi.fn(),
  dir: '',
  setDir: vi.fn(),
  setLoading: vi.fn(),
  loading: false,
  selectedAgent: 'claude',
  selectedAgentKey: 'preset-claude',
  selectedAgentInfo: {
    id: 'meta-1',
    key: 'preset-claude',
    name: 'Claude',
    agent_type: 'claude',
    backend: 'claude',
    custom_agent_id: 'assistant-1',
    is_preset: true,
    isExtension: false,
  } as never,
  is_presetAgent: true,
  selectedMode: 'bypassPermissions',
  selectedAcpModel: 'claude-opus',
  currentAcpCachedModelInfo: null,
  current_model: undefined,
  findAgentByKey: vi.fn(),
  getEffectiveAgentType: vi.fn(() => ({
    agent_type: 'claude',
    isAvailable: true,
  })),
  resolveEnabledSkills: vi.fn(() => ['skill-a']),
  resolveDisabledBuiltinSkills: vi.fn(() => ['skill-b']),
  guidDisabledBuiltinSkills: undefined,
  guidEnabledSkills: undefined,
  assistantDefaultSkillIds: undefined,
  assistantDefaultDisabledBuiltinSkillIds: undefined,
  availableMcpServers: [{ id: 'mcp-user', name: 'User MCP', enabled: true, builtin: false } as IMcpServer],
  selectedMcpServerIds: ['mcp-user'],
  assistantDefaultMcpIds: undefined,
  currentEffectiveAgentInfo: {
    agent_type: 'claude',
    isAvailable: true,
  } as never,
  isGoogleAuth: false,
  ccbAuthorityActive: false,
  setMentionOpen: vi.fn(),
  setMentionQuery: vi.fn(),
  setMentionSelectorOpen: vi.fn(),
  setMentionActiveIndex: vi.fn(),
  navigate: vi.fn(() => Promise.resolve()) as never,
  t: vi.fn((key: string, options?: { defaultValue?: string }) => options?.defaultValue || key) as never,
  localeKey: 'zh-CN',
});

describe('useGuidSend', () => {
  beforeEach(() => {
    createConversationInvokeMock.mockReset();
    createConversationInvokeMock.mockResolvedValue({ id: 'conv-1' });
    swrMutateMock.mockReset();
    swrMutateMock.mockResolvedValue(undefined);
    buildCcbPresetExtraMock.mockReset();
    buildCcbPresetExtraMock.mockImplementation(async (profileId: string | undefined, active: boolean) =>
      active && profileId
        ? {
            ccb_agent_id: profileId,
            ccb_assistant_profile_id: profileId,
            preset_assistant_id: profileId,
          }
        : {}
    );
    stageCcbProfileMock.mockReset();
    stageCcbProfileMock.mockResolvedValue(undefined);
  });

  it('passes selected mode into assistant conversation overrides when creating a preset ACP conversation', async () => {
    const { result } = renderHook(() => useGuidSend(createDeps()));

    await act(async () => {
      await result.current.handleSend();
    });

    expect(createConversationInvokeMock).toHaveBeenCalledTimes(1);
    const payload = createConversationInvokeMock.mock.calls[0][0];
    expect(payload.assistant?.conversation_overrides?.permission).toBe('bypassPermissions');
    expect(payload.assistant?.conversation_overrides?.model).toBe('claude-opus');
    expect(swrMutateMock).toHaveBeenCalledWith('guid.assistant.detail.assistant-1.zh-CN');
    expect(swrMutateMock).toHaveBeenCalledWith('assistants.list');
  });

  it('falls back to assistant default skill and MCP ids for preset conversations before local Guid overrides exist', async () => {
    const deps = createDeps();
    deps.guidEnabledSkills = undefined;
    deps.guidDisabledBuiltinSkills = undefined;
    deps.assistantDefaultSkillIds = ['assistant-skill'];
    deps.assistantDefaultDisabledBuiltinSkillIds = ['builtin-skill'];
    deps.selectedMcpServerIds = undefined;
    deps.assistantDefaultMcpIds = ['mcp-user'];

    const { result } = renderHook(() => useGuidSend(deps));

    await act(async () => {
      await result.current.handleSend();
    });

    const payload = createConversationInvokeMock.mock.calls[0][0];
    expect(payload.assistant?.conversation_overrides?.skill_ids).toEqual(['assistant-skill']);
    expect(payload.assistant?.conversation_overrides?.disabled_builtin_skill_ids).toEqual(['builtin-skill']);
    expect(payload.assistant?.conversation_overrides?.mcp_ids).toEqual(['mcp-user']);
    expect(payload.extra.selected_mcp_server_ids).toEqual(['mcp-user']);
  });

  it('preserves builtin MCP ids in assistant overrides while only sending user MCP ids to runtime selection', async () => {
    const deps = createDeps();
    deps.availableMcpServers = [
      { id: 'mcp-user', name: 'User MCP', enabled: true, builtin: false } as IMcpServer,
      { id: 'builtin-mcp', name: 'Builtin MCP', enabled: true, builtin: true } as IMcpServer,
    ];
    deps.selectedMcpServerIds = ['mcp-user', 'builtin-mcp'];

    const { result } = renderHook(() => useGuidSend(deps));

    await act(async () => {
      await result.current.handleSend();
    });

    const payload = createConversationInvokeMock.mock.calls[0][0];
    expect(payload.assistant?.conversation_overrides?.mcp_ids).toEqual(['mcp-user', 'builtin-mcp']);
    expect(payload.extra.selected_mcp_server_ids).toEqual(['mcp-user']);
    expect(payload.extra.selected_session_mcp_servers).toEqual([expect.objectContaining({ id: 'builtin-mcp' })]);
  });

  it('writes wande-orchestrator metadata when CCB authority is active without a preset card', async () => {
    const deps = createDeps();
    deps.is_presetAgent = false;
    deps.selectedAgentInfo = {
      id: 'claude-1',
      key: 'claude',
      name: 'Claude',
      agent_type: 'claude',
      backend: 'claude',
      is_preset: false,
      isExtension: false,
    } as never;
    deps.ccbAuthorityActive = true;

    const { result } = renderHook(() => useGuidSend(deps));

    await act(async () => {
      await result.current.handleSend();
    });

    expect(buildCcbPresetExtraMock).toHaveBeenCalledWith('wande-orchestrator', true);
    expect(stageCcbProfileMock).toHaveBeenCalledWith('wande-orchestrator');
    const payload = createConversationInvokeMock.mock.calls[0][0];
    expect(payload.extra.ccb_agent_id).toBe('wande-orchestrator');
  });

  it('does not write orchestrator metadata for aionrs when CCB active without preset', async () => {
    const deps = createDeps();
    deps.is_presetAgent = false;
    deps.selectedAgent = 'aionrs';
    deps.selectedAgentInfo = {
      id: 'aionrs-1',
      key: 'aionrs',
      name: 'Aion CLI',
      agent_type: 'aionrs',
      backend: 'aionrs',
      is_preset: false,
      isExtension: false,
    } as never;
    deps.ccbAuthorityActive = true;
    deps.current_model = { id: 'p1', use_model: 'claude-opus' } as never;

    const { result } = renderHook(() => useGuidSend(deps));

    await act(async () => {
      await result.current.handleSend();
    });

    expect(buildCcbPresetExtraMock).toHaveBeenCalledWith(undefined, true);
    expect(stageCcbProfileMock).not.toHaveBeenCalled();
  });

  it('does not write orchestrator metadata for gemini backend when CCB active without preset', async () => {
    const deps = createDeps();
    deps.is_presetAgent = false;
    deps.selectedAgent = 'gemini';
    deps.selectedAgentInfo = {
      id: 'gemini-1',
      key: 'gemini',
      name: 'Gemini',
      agent_type: 'gemini',
      backend: 'gemini',
      is_preset: false,
      isExtension: false,
    } as never;
    deps.getEffectiveAgentType = vi.fn(() => ({
      agent_type: 'gemini',
      isAvailable: true,
    }));
    deps.ccbAuthorityActive = true;

    const { result } = renderHook(() => useGuidSend(deps));

    await act(async () => {
      await result.current.handleSend();
    });

    expect(buildCcbPresetExtraMock).toHaveBeenCalledWith(undefined, true);
    expect(stageCcbProfileMock).not.toHaveBeenCalled();
    const payload = createConversationInvokeMock.mock.calls[0][0];
    expect(payload.extra?.ccb_agent_id).toBeUndefined();
  });
});

/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ASSISTANTS_LIST_SWR_KEY } from '@/common/assistants/fetchAssistantsCatalog';
import { DETECTED_AGENTS_SWR_KEY } from '@/renderer/utils/model/agentTypes';
import { useConversationAgents } from '@/renderer/pages/conversation/hooks/useConversationAgents';

const { fetchAssistantsCatalogMock, fetchDetectedAgentsMock } = vi.hoisted(() => ({
  fetchAssistantsCatalogMock: vi.fn(),
  fetchDetectedAgentsMock: vi.fn(),
}));

vi.mock('@/common/assistants/fetchAssistantsCatalog', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/common/assistants/fetchAssistantsCatalog')>();
  return {
    ...original,
    fetchAssistantsCatalog: fetchAssistantsCatalogMock,
  };
});

vi.mock('@/renderer/utils/model/agentTypes', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/renderer/utils/model/agentTypes')>();
  return {
    ...original,
    fetchDetectedAgents: fetchDetectedAgentsMock,
  };
});

function createSwrWrapper() {
  return function SwrWrapper({ children }: PropsWithChildren) {
    return createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);
  };
}

describe('useConversationAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchDetectedAgentsMock.mockResolvedValue([
      { id: 'claude', name: 'Claude Code', backend: 'claude', agent_type: 'acp', team_capable: true },
    ]);
    fetchAssistantsCatalogMock.mockResolvedValue([
      { id: 'quotation-agent', name: '万鼎报价专家', enabled: true, avatar: '💰', preset_agent_type: 'claude' },
      { id: 'legacy-disabled', name: 'Disabled', enabled: false, preset_agent_type: 'claude' },
    ]);
  });

  it('loads preset assistants via fetchAssistantsCatalog (shared ASSISTANTS_LIST_SWR_KEY)', async () => {
    const { result } = renderHook(() => useConversationAgents(), { wrapper: createSwrWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchAssistantsCatalogMock).toHaveBeenCalled();
    expect(result.current.presetAssistants).toEqual([
      { id: 'quotation-agent', name: '万鼎报价专家', enabled: true, avatar: '💰', preset_agent_type: 'claude' },
    ]);
    expect(result.current.cliAgents).toHaveLength(1);
  });

  it('exports the same SWR keys used by Guid and sidebar catalog consumers', () => {
    expect(ASSISTANTS_LIST_SWR_KEY).toBe('assistants.list');
    expect(DETECTED_AGENTS_SWR_KEY).toBeTruthy();
  });
});

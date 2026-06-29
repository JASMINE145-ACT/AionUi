/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import useSWR from 'swr';
import { ASSISTANTS_LIST_SWR_KEY, fetchAssistantsCatalog } from '@/common/assistants/fetchAssistantsCatalog';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import { DETECTED_AGENTS_SWR_KEY, fetchDetectedAgents } from '@/renderer/utils/model/agentTypes';
import type { AgentMetadata } from '@/renderer/utils/model/agentTypes';
import { isSupportedNewConversationAgent } from '@/renderer/utils/model/agentTypeSupportPolicy';

export type UseConversationAgentsResult = {
  /** Detected execution engines (acp, extension, remote, aionrs, gemini, etc.) */
  cliAgents: AgentMetadata[];
  /** Preset assistants from `fetchAssistantsCatalog` (CCB disk or `/api/assistants`) */
  presetAssistants: Assistant[];
  /** Loading state */
  isLoading: boolean;
  /** Refresh data */
  refresh: () => Promise<void>;
};

/**
 * Hook to fetch available CLI agents and preset assistants for the conversation tab dropdown.
 *
 * Two independent data sources:
 *   - Execution engines — from AgentRegistry via IPC (agents.detected)
 *   - Preset assistants — via `fetchAssistantsCatalog` (CCB disk agents when authority active,
 *     else backend `/api/assistants`); shares SWR cache with Guid / Settings / sidebar
 */
export const useConversationAgents = (): UseConversationAgentsResult => {
  // Execution engines from AgentRegistry (shared cache with useDetectedAgents / useGuidAgentSelection)
  const {
    data: cliAgents,
    isLoading: isLoadingAgents,
    mutate: mutateCliAgents,
  } = useSWR<AgentMetadata[]>(DETECTED_AGENTS_SWR_KEY, fetchDetectedAgents);

  // Preset assistants — same catalog + cache key as Guid, Settings, usePresetAssistantInfo
  const {
    data: presetAssistants,
    isLoading: isLoadingPresets,
    mutate: mutatePresetAssistants,
  } = useSWR<Assistant[]>(ASSISTANTS_LIST_SWR_KEY, async () => {
    try {
      return await fetchAssistantsCatalog();
    } catch (error) {
      console.error('Failed to load assistants for conversation selector:', error);
      return [] as Assistant[];
    }
  });

  const refresh = async () => {
    await Promise.all([mutateCliAgents(), mutatePresetAssistants()]);
  };

  return {
    cliAgents: (cliAgents || []).filter(isSupportedNewConversationAgent),
    presetAssistants: (presetAssistants ?? []).filter((assistant) => assistant.enabled !== false),
    isLoading: isLoadingAgents || isLoadingPresets,
    refresh,
  };
};

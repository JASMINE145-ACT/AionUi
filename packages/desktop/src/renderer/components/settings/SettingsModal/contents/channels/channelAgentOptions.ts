/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { fetchAssistantsCatalog } from '@/common/assistants/fetchAssistantsCatalog';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import { CCB_PRESET_AGENT_BACKEND } from '@/common/config/ccbWandingRuntime';
import { getAgents } from '@/renderer/hooks/agent/useAgents';
import { findCcbClaudeAgent } from '@/renderer/pages/guid/hooks/agentSelectionUtils';
import {
  isSupportedNewConversationAgent,
  normalizeSupportedAgentSelection,
} from '@/renderer/utils/model/agentTypeSupportPolicy';
import type { AgentMetadata } from '@/renderer/utils/model/agentTypes';

export type ChannelAgentOption = {
  key: string;
  agent_type: 'acp' | 'aionrs';
  backend?: string;
  id?: string;
  custom_agent_id?: string;
  name: string;
  cli_path?: string;
  isPreset: boolean;
};

export type ChannelAgentPersistPayload = {
  agent_type: string;
  backend?: string;
  id?: string;
  custom_agent_id?: string;
  name?: string;
  cli_path?: string;
};

export function channelAgentOptionKey(option: Pick<ChannelAgentOption, 'key'>): string {
  return option.key;
}

export function channelAgentOptionToPersistPayload(option: ChannelAgentOption): ChannelAgentPersistPayload {
  // Catalog/engine id (`id`) and preset assistant id (`custom_agent_id`) must stay distinct.
  // ACP session build looks up `extra.agent_id` in the agent registry; putting the assistant
  // id there (e.g. quotation-agent) causes: "ACP agent requires either agent_id or backend".
  const catalogId = option.id;
  const assistantId = option.isPreset ? option.custom_agent_id : option.id;
  return {
    agent_type: option.agent_type,
    backend: option.backend,
    id: catalogId,
    custom_agent_id: assistantId,
    name: option.name,
    ...(option.cli_path ? { cli_path: option.cli_path } : {}),
  };
}

function presetAssistantToOption(assistant: Assistant, claudeEngine?: AgentMetadata): ChannelAgentOption {
  return {
    key: `preset:${assistant.id}`,
    agent_type: 'acp',
    backend: assistant.preset_agent_type || CCB_PRESET_AGENT_BACKEND,
    id: claudeEngine?.id,
    custom_agent_id: assistant.id,
    name: assistant.name,
    isPreset: true,
  };
}

function detectedAgentToOption(agent: AgentMetadata): ChannelAgentOption {
  return {
    key: `cli:${agent.agent_type}:${agent.backend || ''}:${agent.id}`,
    agent_type: agent.agent_type === 'aionrs' ? 'aionrs' : 'acp',
    backend: agent.backend,
    id: agent.id,
    name: agent.name,
    isPreset: false,
  };
}

/** CCB preset assistants first, then detected CLI runtimes (Guid / conversation parity). */
export async function loadChannelAgentOptions(): Promise<ChannelAgentOption[]> {
  const [detectedAgents, presets] = await Promise.all([
    getAgents(),
    fetchAssistantsCatalog().catch(() => [] as Assistant[]),
  ]);

  const cliAgents = detectedAgents.filter(isSupportedNewConversationAgent);
  const claudeEngine = findCcbClaudeAgent(cliAgents);

  const presetOptions = presets
    .filter((assistant) => assistant.enabled !== false)
    .map((assistant) => presetAssistantToOption(assistant, claudeEngine));

  const cliOptions = cliAgents.map(detectedAgentToOption);

  return [...presetOptions, ...cliOptions];
}

export function matchSavedChannelAgent(
  options: ChannelAgentOption[],
  saved: Record<string, unknown> | null | undefined
): ChannelAgentOption | undefined {
  if (!saved || typeof saved !== 'object') return undefined;

  const savedCustomId =
    (typeof saved.custom_agent_id === 'string' && saved.custom_agent_id) ||
    (typeof saved.id === 'string' && saved.id) ||
    undefined;

  if (savedCustomId) {
    const presetMatch = options.find((o) => o.isPreset && o.custom_agent_id === savedCustomId);
    if (presetMatch) return presetMatch;
  }

  const normalized = normalizeSupportedAgentSelection(
    typeof saved.agent_type === 'string' ? saved.agent_type : undefined,
    typeof saved.backend === 'string' ? saved.backend : undefined
  );
  if (!normalized) return undefined;

  const savedName = typeof saved.name === 'string' ? saved.name : undefined;

  return options.find((option) => {
    if (option.isPreset) return false;
    if (option.agent_type !== normalized.agent_type) return false;
    if ((option.backend || '') !== (normalized.backend || '')) return false;
    if (savedCustomId && option.id && option.id !== savedCustomId) return false;
    if (savedName && option.name !== savedName) return false;
    return true;
  });
}

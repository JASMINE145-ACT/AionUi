/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure adapters between CCB assistant profiles and AionUI assistant UI shapes.
 */

import type { Assistant, AssistantDetail, AssistantSource } from '@/common/types/agent/assistantTypes';
import type { CcbAssistantProfile } from './ccbAssistantProfiles';

const CCB_MCP_ID_PREFIX = 'ccb-mcp:';

export function normalizeCcbAssistantCatalogId(id: string): string {
  return id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function ccbMcpIdFromName(name: string): string {
  return name.startsWith(CCB_MCP_ID_PREFIX) ? name : `${CCB_MCP_ID_PREFIX}${name}`;
}

export function ccbMcpNameFromId(id: string): string {
  return id.replace(/^ccb-mcp:/, '');
}

function assistantSourceFromProfile(profile: CcbAssistantProfile): AssistantSource {
  return profile.source === 'bundled' ? 'builtin' : 'user';
}

export function assistantFromCcbProfile(profile: CcbAssistantProfile, index = 0): Assistant {
  const source = assistantSourceFromProfile(profile);
  const sortOrder = typeof profile.sort_order === 'number' ? profile.sort_order : (index + 1) * 1000;
  const mcpIds = profile.defaults.mcp.enabled.map(ccbMcpIdFromName);

  return {
    id: profile.id,
    source,
    name: profile.name,
    name_i18n: {},
    description: profile.description,
    description_i18n: {},
    avatar: profile.avatar,
    enabled: profile.enabled !== false,
    sort_order: sortOrder,
    preset_agent_type: 'claude',
    enabled_skills: profile.defaults.skills.enabled,
    custom_skill_names: profile.source === 'bundled' ? [] : profile.defaults.skills.enabled,
    disabled_builtin_skills: profile.defaults.skills.disabled,
    context: profile.instructions.claude_md || profile.instructions.system_prompt,
    context_i18n: {},
    prompts: profile.recommended_prompts,
    prompts_i18n: {},
    models: profile.defaults.model ? [profile.defaults.model] : [],
  };
}

export function assistantDetailFromCcbProfile(profile: CcbAssistantProfile, index = 0): AssistantDetail {
  const assistant = assistantFromCcbProfile(profile, index);
  const mcpIds = profile.defaults.mcp.enabled.map(ccbMcpIdFromName);

  return {
    id: profile.id,
    source: assistant.source,
    profile: {
      name: profile.name,
      name_i18n: {},
      description: profile.description,
      description_i18n: {},
      avatar: profile.avatar,
    },
    state: {
      enabled: profile.enabled !== false,
      sort_order: assistant.sort_order,
    },
    engine: {
      agent_backend: 'claude',
    },
    rules: {
      content: profile.instructions.claude_md || '',
      storage_mode: 'ccb_profile',
    },
    prompts: {
      recommended: profile.recommended_prompts,
      recommended_i18n: {},
    },
    defaults: {
      model: profile.defaults.model ? { mode: 'fixed', value: profile.defaults.model } : { mode: 'auto' },
      permission: profile.defaults.permission_mode
        ? { mode: 'fixed', value: profile.defaults.permission_mode }
        : { mode: 'auto' },
      skills: { mode: 'fixed', value: profile.defaults.skills.enabled },
      mcps: { mode: mcpIds.length > 0 ? 'fixed' : 'auto', value: mcpIds },
    },
    capabilities: {
      default_skill_ids: profile.defaults.skills.enabled,
      custom_skill_names: profile.source === 'bundled' ? [] : profile.defaults.skills.enabled,
      default_disabled_builtin_skill_ids: profile.defaults.skills.disabled,
    },
    preferences: {
      last_model_id: profile.defaults.model ?? undefined,
      last_permission_value: profile.defaults.permission_mode ?? undefined,
      last_skill_ids: profile.defaults.skills.enabled,
      last_disabled_builtin_skill_ids: profile.defaults.skills.disabled,
      last_mcp_ids: mcpIds,
    },
  };
}

export function sortCcbProfileAssistants(profiles: CcbAssistantProfile[]): CcbAssistantProfile[] {
  return [...profiles].sort((a, b) => {
    const aOrder = typeof a.sort_order === 'number' ? a.sort_order : Number.MAX_SAFE_INTEGER;
    const bOrder = typeof b.sort_order === 'number' ? b.sort_order : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name);
  });
}

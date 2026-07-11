/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure adapters between CCB agent records and AionUI assistant UI shapes.
 */

import type { Assistant, AssistantDetail } from '@/common/types/agent/assistantTypes';
import type { CcbAssistantProfile } from './ccbAssistantProfiles';
import {
  assistantDetailFromCcbProfile,
  assistantFromCcbProfile,
} from './ccbAssistantCatalog';
import type { CcbAgentInput, CcbAgentRecord } from './ccbAgents';
import type { CcbAssistantProfileInput } from './ccbAssistantProfiles';

/** Default CCB-Wanding Guid session agent when no preset card is selected */
export const CCB_DEFAULT_SESSION_AGENT_ID = 'wande-orchestrator';

/** Bundled agents retained for WanD routing + office presets; prune migration deletes others */
export const CCB_WANDING_KEEP_AGENT_IDS = new Set([
  'wande-orchestrator',
  'quotation-agent',
  'accurate-agent',
  'price-library-agent',
  'work-tasks-agent',
  'word-creator',
  'ppt-creator',
  'excel-creator',
]);

/** Hidden from Guid preset cards — default session still binds wande-orchestrator */
export const CCB_GUID_HIDDEN_AGENT_IDS = new Set(['wande-orchestrator']);

/** Office Guid presets — also delegatable from default router */
export const CCB_WANDING_OFFICE_PRESET_IDS = new Set([
  'word-creator',
  'ppt-creator',
  'excel-creator',
]);

/** Agents kept in fleet but not delegatable from default router (Guid-only specialists). */
export const CCB_GUID_ONLY_AGENT_IDS = new Set(['price-library-agent']);

/** Specialists the default router may delegate to (keep set minus orchestrator and Guid-only). */
export function isRouterDelegatableAgentId(id: string): boolean {
  if (CCB_GUID_ONLY_AGENT_IDS.has(id)) return false;
  return CCB_WANDING_KEEP_AGENT_IDS.has(id) && id !== CCB_DEFAULT_SESSION_AGENT_ID;
}

/** @deprecated Use isRouterDelegatableAgentId */
export const CCB_WANDING_DELEGATABLE_AGENT_IDS = new Set(
  [...CCB_WANDING_KEEP_AGENT_IDS].filter((id) => id !== CCB_DEFAULT_SESSION_AGENT_ID),
);

/** L1 body: system_prompt wins; legacy sidecar-only claude_md folds into body on save. */
export function resolveEffectiveSystemPrompt(
  systemPrompt: string | undefined,
  claudeMd: string | undefined,
): string | undefined {
  const body = systemPrompt?.trim() ?? '';
  const legacy = claudeMd?.trim() ?? '';
  if (body) return body;
  if (legacy) return legacy;
  return undefined;
}

export function ccbAgentInputFromProfile(
  profile: CcbAssistantProfile | CcbAssistantProfileInput
): CcbAgentInput {
  const defaults =
    profile.defaults ??
    ({
      model: null,
      permission_mode: null,
      skills: { enabled: [], disabled: [] },
      mcp: { enabled: [], disabled: [] },
    } as CcbAssistantProfile['defaults']);
  const instructions =
    profile.instructions ??
    ({} as NonNullable<CcbAssistantProfile['instructions']>);

  const effectiveSystemPrompt = resolveEffectiveSystemPrompt(
    instructions.system_prompt,
    instructions.claude_md,
  );

  // Frontmatter `name` is Agent() subagent_type (must match agent id / filename).
  // Human-readable Guid labels live in sidecar `display_name` (from profile.name).
  const displayName = profile.name?.trim();
  return {
    id: profile.id,
    name: profile.id,
    ...(displayName && displayName !== profile.id ? { display_name: displayName } : {}),
    ...(profile.description ? { description: profile.description } : {}),
    model: defaults.model ?? null,
    permission_mode: defaults.permission_mode ?? null,
    ...(effectiveSystemPrompt ? { system_prompt: effectiveSystemPrompt } : {}),
    ...(profile.avatar ? { avatar: profile.avatar } : {}),
    ...(typeof profile.sort_order === 'number' ? { sort_order: profile.sort_order } : {}),
    recommended_prompts: profile.recommended_prompts ?? [],
    mcp_allowlist: defaults.mcp?.enabled ?? [],
    skills: {
      enabled: defaults.skills?.enabled ?? [],
      disabled: defaults.skills?.disabled ?? [],
    },
    enabled: profile.enabled !== false,
    source: profile.source ?? 'user',
    guid_primary:
      profile.source === 'bundled' && !CCB_GUID_HIDDEN_AGENT_IDS.has(profile.id)
        ? true
        : false,
    delegatable:
      profile.id === CCB_DEFAULT_SESSION_AGENT_ID
        ? false
        : isRouterDelegatableAgentId(profile.id)
          ? true
          : undefined,
    ...(profile.created_at ? { created_at: profile.created_at } : {}),
    ...(profile.updated_at ? { updated_at: profile.updated_at } : {}),
  };
}

export function ccbAssistantProfileFromAgent(agent: CcbAgentRecord): CcbAssistantProfile {
  const displayName = agent.display_name?.trim() || agent.name;
  return {
    schema_version: 1,
    id: agent.id,
    name: displayName,
    ...(agent.description ? { description: agent.description } : {}),
    ...(agent.avatar ? { avatar: agent.avatar } : {}),
    enabled: agent.enabled !== false,
    ...(typeof agent.sort_order === 'number' ? { sort_order: agent.sort_order } : {}),
    source: agent.source,
    created_at: agent.created_at,
    updated_at: agent.updated_at,
    instructions: {
      ...(agent.system_prompt ? { system_prompt: agent.system_prompt } : {}),
      ...(agent.claude_md ? { claude_md: agent.claude_md } : {}),
    },
    recommended_prompts: agent.recommended_prompts,
    defaults: {
      model: agent.model ?? null,
      permission_mode: agent.permission_mode ?? null,
      skills: {
        enabled: agent.skills.enabled,
        disabled: agent.skills.disabled,
      },
      mcp: {
        enabled: agent.mcp_allowlist,
        disabled: [],
      },
    },
  };
}

export function assistantFromCcbAgent(agent: CcbAgentRecord, index = 0): Assistant {
  return assistantFromCcbProfile(ccbAssistantProfileFromAgent(agent), index);
}

export function assistantDetailFromCcbAgent(agent: CcbAgentRecord, index = 0): AssistantDetail {
  return assistantDetailFromCcbProfile(ccbAssistantProfileFromAgent(agent), index);
}

export function sortCcbAgents(agents: CcbAgentRecord[]): CcbAgentRecord[] {
  return [...agents].sort((a, b) => {
    const aOrder = typeof a.sort_order === 'number' ? a.sort_order : Number.MAX_SAFE_INTEGER;
    const bOrder = typeof b.sort_order === 'number' ? b.sort_order : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name);
  });
}

export type GuidCatalogFilterOptions = {
  /** When false, agents with requires_price_admin are hidden */
  isPriceAdmin?: boolean;
};

export function filterGuidCatalogAgents(
  agents: CcbAgentRecord[],
  options?: GuidCatalogFilterOptions,
): CcbAgentRecord[] {
  const isPriceAdmin = options?.isPriceAdmin === true;
  return agents.filter((agent) => {
    if (agent.enabled === false) return false;
    if (CCB_GUID_HIDDEN_AGENT_IDS.has(agent.id)) return false;
    if (agent.requires_price_admin === true && !isPriceAdmin) return false;
    if (agent.source === 'bundled') return true;
    return agent.guid_primary === true;
  });
}

/** @deprecated Use filterGuidCatalogAgents */
export function filterGuidPrimaryAgents(agents: CcbAgentRecord[]): CcbAgentRecord[] {
  return filterGuidCatalogAgents(agents);
}


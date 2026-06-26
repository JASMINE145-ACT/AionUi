/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure helpers for seeding AionUI builtin assistants into CCB-Wanding profiles.
 */

import type { Assistant, AssistantDetail, AssistantDefaults } from '@/common/types/agent/assistantTypes';
import type { CcbAssistantProfile } from './ccbAssistantProfiles';
import { normalizeCcbAssistantProfile, normalizeCcbAssistantProfileId } from './ccbAssistantProfiles';
import { stripBuiltinAssistantIdPrefix } from './ccbWandingRuntime';

export type AssistantProfileSeedInput = {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  rulesContent?: string;
  recommendedPrompts?: string[];
  enabledSkills?: string[];
  disabledBuiltinSkills?: string[];
  mcpNames?: string[];
  permissionMode?: string | null;
  model?: string | null;
};

export function resolveAssistantDefaultScalar(defaults: AssistantDefaults | undefined, key: 'model' | 'permission'): string | null {
  const entry = defaults?.[key];
  if (!entry || entry.mode !== 'fixed' || typeof entry.value !== 'string') {
    return null;
  }
  const trimmed = entry.value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveAssistantDefaultMcpNames(defaults: AssistantDefaults | undefined): string[] {
  const mcps = defaults?.mcps;
  if (!mcps || mcps.mode !== 'fixed' || !Array.isArray(mcps.value)) {
    return [];
  }
  return mcps.value
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.replace(/^ccb-mcp:/, '').trim());
}

export function buildBundledCcbAssistantProfile(
  input: AssistantProfileSeedInput,
  now = new Date().toISOString()
): CcbAssistantProfile | null {
  const profile = normalizeCcbAssistantProfile(
    {
      schema_version: 1,
      id: normalizeCcbAssistantProfileId(stripBuiltinAssistantIdPrefix(input.id)),
      name: input.name,
      description: input.description,
      avatar: input.avatar,
      enabled: true,
      source: 'bundled',
      created_at: now,
      updated_at: now,
      instructions: {
        ...(input.rulesContent?.trim() ? { claude_md: input.rulesContent.trim() } : {}),
      },
      recommended_prompts: input.recommendedPrompts ?? [],
      defaults: {
        model: input.model ?? null,
        permission_mode: input.permissionMode ?? null,
        skills: {
          enabled: input.enabledSkills ?? [],
          disabled: input.disabledBuiltinSkills ?? [],
        },
        mcp: {
          enabled: input.mcpNames ?? [],
          disabled: [],
        },
      },
    },
    now
  );

  return profile;
}

export function assistantListRowToProfileSeed(assistant: Assistant, rulesContent = ''): AssistantProfileSeedInput {
  const name =
    assistant.name_i18n?.['zh-CN'] ?? assistant.name_i18n?.['en-US'] ?? assistant.name;
  const description =
    assistant.description_i18n?.['zh-CN'] ??
    assistant.description_i18n?.['en-US'] ??
    assistant.description;
  const recommended =
    assistant.prompts_i18n?.['zh-CN'] ?? assistant.prompts_i18n?.['en-US'] ?? assistant.prompts ?? [];
  const contextFallback =
    assistant.context_i18n?.['zh-CN'] ?? assistant.context_i18n?.['en-US'] ?? assistant.context ?? '';

  return {
    id: assistant.id,
    name,
    description,
    avatar: assistant.avatar,
    rulesContent: rulesContent.trim() || contextFallback.trim(),
    recommendedPrompts: recommended,
    enabledSkills: assistant.enabled_skills,
    disabledBuiltinSkills: assistant.disabled_builtin_skills,
  };
}

export function assistantDetailToProfileSeed(detail: AssistantDetail, fallbackName: string): AssistantProfileSeedInput {
  const recommended =
    detail.prompts.recommended_i18n?.['zh-CN'] ??
    detail.prompts.recommended_i18n?.['en-US'] ??
    detail.prompts.recommended ??
    [];

  const skillIds =
    detail.capabilities.default_skill_ids.length > 0
      ? detail.capabilities.default_skill_ids
      : detail.defaults.skills.mode === 'fixed'
        ? detail.defaults.skills.value
        : [];

  const mcpFromDefaults = resolveAssistantDefaultMcpNames(detail.defaults);

  return {
    id: detail.id,
    name: detail.profile.name_i18n?.['zh-CN'] ?? detail.profile.name_i18n?.['en-US'] ?? detail.profile.name ?? fallbackName,
    description:
      detail.profile.description_i18n?.['zh-CN'] ??
      detail.profile.description_i18n?.['en-US'] ??
      detail.profile.description,
    avatar: detail.profile.avatar,
    rulesContent: detail.rules.content,
    recommendedPrompts: recommended,
    enabledSkills: skillIds,
    disabledBuiltinSkills: detail.capabilities.default_disabled_builtin_skill_ids,
    mcpNames: mcpFromDefaults,
    permissionMode: resolveAssistantDefaultScalar(detail.defaults, 'permission'),
    model: resolveAssistantDefaultScalar(detail.defaults, 'model'),
  };
}
